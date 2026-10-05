"use client";

import React, { useEffect, useRef, useState } from "react";
import { useAgentData } from "./AgentDataContext";
import type { AgentRole, MultiAgentState, AgentEntry } from "./AgentDataContext";

// ─── Sprite / Canvas Constants ────────────────────────────────────────────────

// SC scales dynamically with container width — sprites resize with background
const BASE_SC   = 4;      // scale at REF_WIDTH
const REF_WIDTH = 1280;   // px — reference width where BASE_SC=4 looks correct

const BG_W = 2064;
const BG_H = 512;

// Workstation center X fractions measured from pixel-agents-desk-bg.png (2064×512px)
const SEAT_X_FRACTIONS = [0.079, 0.251, 0.421, 0.585, 0.750, 0.913];
const FLOOR_Y_FRACTION = 0.98;  // Y mientras caminan
const SEAT_Y_FRACTION  = 0.783; // Y cuando están sentados en la silla
const SEAT_Y_OFFSETS   = [-5, -10, 0, 0, 0, 0]; // px fine-tune per seat (negative = up)

const BASE_SPEED = 150; // px/s at REF_WIDTH — scales with container width

const AMBER = "sepia(1) saturate(2.5) hue-rotate(5deg) brightness(0.95)";
const CYAN  = "sepia(1) saturate(2.5) hue-rotate(155deg) brightness(1.0)";

// Monitor glow calibration — ajustar hasta que coincida con las pantallas
const SCREEN_Y_FRACTION = 0.10;  // Y desde arriba (0=top, 1=bottom)
const SCREEN_Y_NUDGE    = 50;    // desplazamiento adicional en px (positivo = abajo)
const SCREEN_W_MULT     = 2.4;   // ancho del glow en múltiplos de fw
const SCREEN_H_MULT     = 0.75;  // alto del glow en múltiplos de fh
const SCREEN_X_OFFSET   = 1.5;   // centrado horizontal (fw * este valor = desplazamiento izq)
const SCREEN_X_NUDGES   = [50, 35, 26, 26, 23, 23]; // px per seat (positivo = derecha)
const SEAT_BRIGHTNESS   = [1.0, 1.0, 1.0, 0.80, 1.0, 1.0]; // brightness per seat (char_3 más oscuro)

// ─── Animation Types ──────────────────────────────────────────────────────────

interface Anim { row: number; frames: number[]; fps: number }

const WALK: Anim = { row: 2, frames: [0, 1, 2, 1], fps: 8 };

const ANIMS: Record<MultiAgentState, Anim> = {
  idle:      { row: 0, frames: [0, 1, 2, 1], fps: 3 },
  thinking:  { row: 0, frames: [5, 6],       fps: 2 },
  reading:   { row: 0, frames: [5, 6],       fps: 2 },
  editing:   { row: 0, frames: [3, 4],       fps: 8 },
  running:   { row: 2, frames: [0, 1, 2, 1], fps: 8 },
  searching: { row: 1, frames: [0, 1, 2, 1], fps: 4 },
  waiting:   { row: 0, frames: [0, 1],       fps: 2 },
  spawning:  { row: 2, frames: [0, 1, 2, 1], fps: 6 },
};

const RGB: Record<MultiAgentState, string> = {
  idle:      "255,255,255",
  thinking:  "56,189,248",
  reading:   "99,102,241",
  editing:   "245,158,11",
  running:   "16,185,129",
  searching: "167,139,250",
  waiting:   "244,63,94",
  spawning:  "34,211,238",
};


// ─── Per-Agent Motion State ───────────────────────────────────────────────────

interface AgentMotion {
  x: number;
  targetX: number;
  moving: boolean;
  facing: 1 | -1;
  walkingOut: boolean;
  seatIndex: number;     // 0-5
  frameTime: number;     // accumulated time for sprite animation (seconds)
  frameIdx: number;      // current frame index in anim sequence
}

// ─── Agent name mapping ───────────────────────────────────────────────────────

function agentLabel(role: AgentRole, agentType?: string): string {
  if (role === "main") return "claude";
  const map: Record<string, string> = {
    "gsd-executor":          "executor",
    "gsd-planner":           "planner",
    "gsd-verifier":          "verifier",
    "gsd-phase-researcher":  "researcher",
    "gsd-plan-checker":      "checker",
    "gsd-debugger":          "debugger",
    "gsd-codebase-mapper":   "mapper",
    "general-purpose":       "agent",
    "Explore":               "explorer",
  };
  if (agentType && map[agentType]) return map[agentType];
  if (agentType) return agentType.replace(/^gsd-/, "").slice(0, 10);
  return "sub";
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function spriteCSS(anim: Anim, frameIdx: number, charN: number, sc: number): React.CSSProperties {
  const col = anim.frames[frameIdx % anim.frames.length];
  const fw = 16 * sc;
  const fh = 32 * sc;
  const sw = 112 * sc;
  const sh = 96 * sc;
  return {
    backgroundImage: `url(/pixel-agents/char_${charN}.png)`,
    backgroundPosition: `${-(col * fw)}px ${-(anim.row * fh)}px`,
    backgroundSize: `${sw}px ${sh}px`,
    backgroundRepeat: "no-repeat",
    imageRendering: "pixelated",
  };
}

function assignSeat(role: AgentRole, occupied: Set<number>, preferred?: number): number {
  if (preferred !== undefined && preferred >= 0 && preferred <= 5 && !occupied.has(preferred)) return preferred;
  if (role === "main") return 0;
  for (let i = 1; i <= 5; i++) {
    if (!occupied.has(i)) return i;
  }
  return -1; // overflow — more than 5 sub-agents, hide
}

// ─── DeskCanvas ───────────────────────────────────────────────────────────────

export function DeskCanvas() {
  const { agents } = useAgentData();
  const containerRef = useRef<HTMLDivElement>(null);
  const containerWidthRef = useRef<number>(0);
  const [containerWidth, setContainerWidth] = useState(0);
  const motionRef = useRef<Map<string, AgentMotion>>(new Map());
  // localAgentsRef: separate from context — keeps agents alive during walk-out
  const localAgentsRef = useRef<Map<string, AgentEntry>>(new Map());
  const rafRef = useRef<number>(0);
  const [renderTick, setRenderTick] = useState(0); // triggers re-render
  const occupiedSeatsRef = useRef<Set<number>>(new Set());

  // ─── ResizeObserver: track container dimensions ──────────────────────────

  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver((entries) => {
      const newCw = entries[0].contentRect.width;
      const oldCw = containerWidthRef.current;
      const ratio  = oldCw > 0 ? newCw / oldCw : 1;
      containerWidthRef.current = newCw;
      setContainerWidth(newCw);
      const newFw = Math.round(16 * BASE_SC * (newCw / REF_WIDTH));
      // Scale existing positions proportionally + recalculate targets
      motionRef.current.forEach((motion) => {
        motion.x *= ratio;
        if (!motion.walkingOut) {
          motion.targetX = SEAT_X_FRACTIONS[motion.seatIndex] * newCw - newFw / 2;
        } else {
          motion.targetX = motion.facing === 1 ? newCw + newFw : -newFw;
        }
      });
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  // ─── Shared RAF loop: movement + frame animation ─────────────────────────

  useEffect(() => {
    let last = performance.now();
    function step(now: number) {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      let changed = false;

      const speed = BASE_SPEED * (containerWidthRef.current > 0 ? containerWidthRef.current / REF_WIDTH : 1);
      motionRef.current.forEach((motion, agentId) => {
        // Movement toward targetX
        const diff = motion.targetX - motion.x;
        if (Math.abs(diff) > 1.5) {
          motion.x += Math.min(Math.abs(diff), speed * dt) * Math.sign(diff);
          motion.moving = true;
          motion.facing = diff > 0 ? 1 : -1;
          changed = true;
        } else {
          motion.moving = false;
        }

        // Frame animation
        const entry = localAgentsRef.current.get(agentId);
        if (entry) {
          const anim = motion.moving ? WALK : ANIMS[entry.state];
          motion.frameTime += dt;
          const frameDuration = 1 / anim.fps;
          while (motion.frameTime >= frameDuration) {
            motion.frameTime -= frameDuration;
            motion.frameIdx = (motion.frameIdx + 1) % anim.frames.length;
            changed = true;
          }
        }

        // Walk-out completion — agent reached edge, remove from local state
        if (motion.walkingOut && Math.abs(motion.x - motion.targetX) < 2) {
          localAgentsRef.current.delete(agentId);
          motionRef.current.delete(agentId);
          occupiedSeatsRef.current.delete(motion.seatIndex);
          changed = true;
        }
      });

      if (changed) setRenderTick((t) => t + 1);
      rafRef.current = requestAnimationFrame(step);
    }

    rafRef.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  // ─── Agents sync: walk-in for new agents, walk-out for removed ───────────

  useEffect(() => {
    const cw = containerWidthRef.current;

    // New agents → walk-in from edge
    agents.forEach((entry, agentId) => {
      if (!motionRef.current.has(agentId)) {
        const seatIdx = assignSeat(entry.role, occupiedSeatsRef.current, entry.seat);
        if (seatIdx === -1) return; // overflow — ignore
        occupiedSeatsRef.current.add(seatIdx);
        const fw0 = Math.round(16 * BASE_SC * (cw / REF_WIDTH));
        const seatX = SEAT_X_FRACTIONS[seatIdx] * cw - fw0 / 2;
        // Main agent enters from left, sub-agents from right
        const startX = entry.role === "main" ? -fw0 : cw;
        const facing: 1 | -1 = entry.role === "main" ? 1 : -1;
        motionRef.current.set(agentId, {
          x: startX,
          targetX: seatX,
          moving: true,
          facing,
          walkingOut: false,
          seatIndex: seatIdx,
          frameTime: 0,
          frameIdx: 0,
        });
        localAgentsRef.current.set(agentId, entry);
      } else {
        // Update existing agent entry (state may have changed)
        localAgentsRef.current.set(agentId, entry);
      }
    });

    // Removed from context → trigger walk-out
    motionRef.current.forEach((motion, agentId) => {
      if (!agents.has(agentId) && !motion.walkingOut) {
        motion.walkingOut = true;
        const fwOut = Math.round(16 * BASE_SC * (containerWidthRef.current / REF_WIDTH));
        motion.targetX = motion.facing === 1
          ? containerWidthRef.current + fwOut
          : -fwOut;
        motion.moving = true;
      }
    });
  }, [agents]);

  // ─── Render ──────────────────────────────────────────────────────────────

  // Consume renderTick to silence unused-variable lint
  void renderTick;

  const cw = containerWidth; // state — triggers re-render on resize
  const ch = cw * (BG_H / BG_W); // derive height from aspect ratio
  const sc = cw > 0 ? BASE_SC * (cw / REF_WIDTH) : BASE_SC;
  const fw = Math.round(16 * sc);
  const fh = Math.round(32 * sc);

  // DEMO MODE — muestra los 6 asientos con agentes ficticios para calibración visual
  // Cambiar a false cuando las posiciones estén calibradas
  const DEMO_MODE = false;
  const demoStates: MultiAgentState[] = ["editing", "searching", "searching", "searching", "searching", "searching"];
  const demoEntries: [string, AgentEntry][] = DEMO_MODE
    ? SEAT_X_FRACTIONS.map((_, i) => [`demo-${i}`, {
        agentId: i === 0 ? "main" : `demo-${i}`,
        state: demoStates[i],
        role: (i === 0 ? "main" : "sub") as AgentRole,
        sessionId: `demo-${i}`,
        lastSeen: new Date().toISOString(),
      }])
    : [];
  const demoFacing: (1 | -1)[] = [-1, -1, 1, 1, -1, -1]; // -1 = flipped (facing screen)
  const demoMotions = DEMO_MODE
    ? SEAT_X_FRACTIONS.map((fx, i) => { const sx = fx * cw - fw / 2; return { x: sx, targetX: sx, moving: false, facing: demoFacing[i], walkingOut: false, seatIndex: i, frameTime: 0, frameIdx: 0 }; })
    : [];

  const renderEntries: [string, AgentEntry][] = DEMO_MODE
    ? demoEntries
    : Array.from(localAgentsRef.current.entries());
  const getMotion = (agentId: string, i: number): AgentMotion | undefined =>
    DEMO_MODE ? demoMotions[i] : motionRef.current.get(agentId);

  return (
    <div
      ref={containerRef}
      style={{
        position: "relative",
        width: "100%",
        paddingBottom: `${(BG_H / BG_W) * 100}%`,
        overflow: "hidden",
        backgroundImage: "url(/pixel-agents-desk-bg.webp)",
        backgroundSize: "100% 100%",
        backgroundRepeat: "no-repeat",
        imageRendering: "pixelated",
      }}
    >
{/* Sprite characters — one per local agent */}
      {renderEntries.map(([agentId, entry], i) => {
        const motion = getMotion(agentId, i);
        if (!motion) return null;
        const seatIdx = motion.seatIndex;
        const charN = Math.min(seatIdx, 5);
        const anim = motion.moving ? WALK : ANIMS[entry.state];
        const css = spriteCSS(anim, motion.frameIdx, charN, sc);
        const floorY = motion.moving ? ch * FLOOR_Y_FRACTION - fh : ch * SEAT_Y_FRACTION - fh + (SEAT_Y_OFFSETS[seatIdx] ?? 0);
        const bMult = SEAT_BRIGHTNESS[seatIdx] ?? 1.0;
        const tint = bMult !== 1.0 ? `brightness(${bMult})` : undefined;
        const rgb = RGB[entry.state];
        const screenScale = sc / BASE_SC; // scales nudges proportionally with canvas size
        return (
          <React.Fragment key={`agent-${agentId}`}>
            {/* Monitor screen glow — state color backlight */}
            {!motion.moving && (
              <div className="animate-pulse" style={{ animationDuration: "4s",
                position: "absolute",
                left: SEAT_X_FRACTIONS[seatIdx] * cw - fw * SCREEN_X_OFFSET + (SCREEN_X_NUDGES[seatIdx] ?? 40) * screenScale,
                top: ch * SCREEN_Y_FRACTION + SCREEN_Y_NUDGE * screenScale,
                width: fw * SCREEN_W_MULT,
                height: fh * SCREEN_H_MULT,
                background: `rgba(${rgb}, 0.28)`,
                filter: "blur(10px)",
                transition: "background 0.7s ease",
                pointerEvents: "none",
                zIndex: 0,
              }} />
            )}
            {/* Sprite */}
            <div style={{
              position: "absolute",
              left: motion.x,
              top: floorY,
              width: fw,
              height: fh,
              filter: tint,
              transform: motion.facing === -1 ? "scaleX(-1)" : undefined,
              transition: motion.moving ? undefined : "top 0.4s ease",
              pointerEvents: "none",
              zIndex: 1,
              ...css,
            }} />
            {/* Name + state labels */}
            {!motion.moving && (
              <div style={{
                position: "absolute",
                left: motion.x + fw / 2,
                top: floorY - Math.max(20, fw * 0.55),
                transform: "translateX(-50%)",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: Math.max(1, fw * 0.02),
                pointerEvents: "none",
                zIndex: 2,
              }}>
                {/* Agent name */}
                <div style={{
                  color: entry.role === "main" ? "rgba(251,191,36,0.9)" : "rgba(255,255,255,0.55)",
                  background: "rgba(0,0,0,0.55)",
                  fontSize: Math.max(6, Math.min(10, fw * 0.16)),
                  fontFamily: "monospace",
                  letterSpacing: "0.08em",
                  padding: `${Math.max(1, fw * 0.02)}px ${Math.max(2, fw * 0.07)}px`,
                  borderRadius: 3,
                  whiteSpace: "nowrap",
                }}>
                  {entry.label ?? agentLabel(entry.role, entry.agentType)}
                </div>
                {/* State */}
                <div style={{
                  color: `rgb(${rgb})`,
                  background: "rgba(0,0,0,0.65)",
                  fontSize: Math.max(7, Math.min(12, fw * 0.19)),
                  fontFamily: "monospace",
                  letterSpacing: "0.05em",
                  padding: `${Math.max(1, fw * 0.03)}px ${Math.max(2, fw * 0.08)}px`,
                  borderRadius: 3,
                  whiteSpace: "nowrap",
                  transition: "color 0.5s ease",
                }}>
                  {entry.state}
                </div>
              </div>
            )}
          </React.Fragment>
        );
      })}

      {/* DEBUG markers — uncomment to calibrate seat positions
      {SEAT_X_FRACTIONS.map((fx, i) => (
        <div key={i} style={{ position: "absolute", left: `${fx * 100}%`, top: `${FLOOR_Y_FRACTION * 100}%`, width: 4, height: 20, background: "red", transform: "translate(-50%, -100%)", pointerEvents: "none", zIndex: 10 }}>
          <span style={{ position: "absolute", top: -18, left: -4, color: "red", fontSize: 10, fontWeight: "bold", whiteSpace: "nowrap" }}>{i}</span>
        </div>
      ))}
      */}
    </div>
  );
}
