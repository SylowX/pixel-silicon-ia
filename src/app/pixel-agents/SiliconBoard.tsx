"use client";

import { useEffect, useMemo, useState } from "react";
import { useAgentData } from "./AgentDataContext";
import type { AgentTask, FeedItem, SiliconRole, StepState, TaskStep } from "@/lib/siliconia";
import { OpenGuiButton } from "./SiliconGui";

// Left-hand progress board: what every agent is doing right now, which task it
// owns, and how far along it is (completed checklist steps / total steps — not
// a time estimate).

const ROLES: { role: SiliconRole; name: string; seat: number; rgb: string }[] = [
  { role: "supervisor", name: "supervisor", seat: 0, rgb: "251,191,36" },
  { role: "architect",  name: "architect",  seat: 1, rgb: "167,139,250" },
  { role: "rtl",        name: "rtl-coder",  seat: 2, rgb: "56,189,248" },
  { role: "dv",         name: "verifier",   seat: 3, rgb: "52,211,153" },
  { role: "synth",      name: "synthesis",  seat: 4, rgb: "244,114,182" },
  { role: "pnr",        name: "pnr",        seat: 5, rgb: "129,140,248" },
];

const STAGE_LABEL: Record<string, string> = {
  pdk: "PDK", spec: "Spec", rtl: "RTL", verify: "Verif", logic_synth: "Synth",
  floorplan: "Floor", place: "Place", cts: "CTS", route: "Route", finish: "GDSII",
};
const STAGE_COLOR: Record<string, string> = {
  pending: "rgba(255,255,255,0.10)", running: "#38bdf8", ok: "#34d399", error: "#f43f5e", skipped: "rgba(255,255,255,0.28)",
};
const STATUS_LABEL: Record<AgentTask["status"], string> = {
  idle: "en espera", working: "trabajando", done: "completado", blocked: "bloqueado", skipped: "omitido",
};
const STATUS_RGB: Record<AgentTask["status"], string> = {
  idle: "148,163,184", working: "56,189,248", done: "52,211,153", blocked: "244,63,94", skipped: "148,163,184",
};
const STEP_ICON: Record<StepState, string> = { pending: "○", running: "●", done: "✓", failed: "✗", skipped: "–" };
const STEP_COLOR: Record<StepState, string> = {
  pending: "rgba(255,255,255,0.28)", running: "#38bdf8", done: "#34d399", failed: "#f43f5e", skipped: "rgba(255,255,255,0.28)",
};
const FEED_COLOR: Record<FeedItem["kind"], string> = {
  info: "rgba(255,255,255,0.55)", ok: "#34d399", error: "#f43f5e", warn: "#fbbf24",
};
const METRICS: { key: string; label: string; fmt: (v: number) => string }[] = [
  { key: "design_area_um2", label: "área", fmt: (v) => `${Math.round(v).toLocaleString("es-MX")} µm²` },
  { key: "utilization_pct", label: "util", fmt: (v) => `${v}%` },
  { key: "total_power_w", label: "potencia", fmt: (v) => (v < 1e-3 ? `${(v * 1e6).toFixed(1)} µW` : `${(v * 1e3).toFixed(2)} mW`) },
  { key: "cell_count", label: "celdas", fmt: (v) => v.toLocaleString("es-MX") },
];

function fmtElapsed(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(r).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

function Avatar({ seat }: { seat: number }) {
  // char_N.png: 112×96 sheet, 16×32 frames → col 0,row 0 is the idle front pose. Scale ×2, head + torso only.
  return (
    <div style={{
      width: 32, height: 44, flexShrink: 0, borderRadius: 6, overflow: "hidden",
      background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
    }}>
      <div style={{
        width: 32, height: 64,
        backgroundImage: `url(/pixel-agents/char_${seat}.png)`,
        backgroundSize: "224px 192px", backgroundPosition: "0px 0px",
        backgroundRepeat: "no-repeat", imageRendering: "pixelated",
      }} />
    </div>
  );
}

function StepChip({ step }: { step: TaskStep }) {
  const dim = !step.counted && step.state === "pending";
  return (
    <span
      className={step.state === "running" ? "si-step-running" : undefined}
      title={`${step.label}${step.optional ? " (opcional)" : ""}${step.extra ? " (no cuenta en el %)" : ""}`}
      style={{
        display: "inline-flex", alignItems: "center", gap: 4, fontSize: 10, padding: "1px 6px", borderRadius: 9999,
        color: STEP_COLOR[step.state], border: `1px solid ${STEP_COLOR[step.state]}33`,
        background: `${STEP_COLOR[step.state]}12`, opacity: dim ? 0.45 : 1, whiteSpace: "nowrap",
      }}
    >
      {STEP_ICON[step.state]} {step.label}
      {step.frac > 0 && step.frac < 1 && <span style={{ opacity: 0.7 }}>{Math.round(step.frac * 100)}%</span>}
      {step.attempts > 0 && <span title="reintentos" style={{ color: "#fbbf24" }}>↻{step.attempts}</span>}
    </span>
  );
}

function AgentCard({ meta, task, detail, now }: {
  meta: (typeof ROLES)[number]; task: AgentTask | undefined; detail: string | undefined; now: number;
}) {
  const status = task?.status ?? "idle";
  const pct = task?.pct ?? 0;
  const rgb = meta.rgb;
  const active = status === "working";
  return (
    <div
      className="si-card"
      style={{
        borderColor: active ? `rgba(${rgb},0.45)` : "rgba(255,255,255,0.08)",
        boxShadow: active ? `0 0 0 1px rgba(${rgb},0.15), 0 0 24px -8px rgba(${rgb},0.55)` : "none",
      }}
    >
      <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
        <Avatar seat={meta.seat} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: `rgb(${rgb})`, letterSpacing: "0.04em" }}>{meta.name}</span>
            <span
              style={{
                marginLeft: "auto", fontSize: 9, padding: "1px 7px", borderRadius: 9999, textTransform: "uppercase", letterSpacing: "0.08em",
                color: `rgb(${STATUS_RGB[status]})`, background: `rgba(${STATUS_RGB[status]},0.12)`, border: `1px solid rgba(${STATUS_RGB[status]},0.3)`,
              }}
            >
              {active && <span className="si-dot" style={{ background: `rgb(${STATUS_RGB[status]})` }} />}
              {STATUS_LABEL[status]}
            </span>
          </div>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.7)", marginTop: 2 }}>{task?.title ?? "—"}</div>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
        <div className="si-track">
          <div
            className={active ? "si-fill si-fill-active" : "si-fill"}
            style={{ width: `${pct}%`, background: `linear-gradient(90deg, rgba(${rgb},0.55), rgb(${rgb}))` }}
          />
        </div>
        <span style={{ fontSize: 13, fontWeight: 700, minWidth: 38, textAlign: "right", color: status === "skipped" ? "rgba(255,255,255,0.3)" : "#fff" }}>
          {status === "skipped" ? "—" : `${pct}%`}
        </span>
      </div>
      <div style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", marginTop: 2 }}>
        {status === "skipped" ? "omitido en este run" : `${task?.doneSteps ?? 0}/${task?.totalSteps ?? 0} pasos`}
      </div>

      {(task?.current || detail) && status !== "skipped" && (
        <div style={{ marginTop: 6, fontSize: 11, color: "rgba(255,255,255,0.8)", display: "flex", gap: 6, alignItems: "baseline" }}>
          {active && <span className="si-spin" />}
          <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={detail}>
            {task?.current ?? detail}
          </span>
          {active && task?.currentSince != null && (
            <span style={{ marginLeft: "auto", color: "rgba(255,255,255,0.35)", flexShrink: 0 }}>{fmtElapsed(now - task.currentSince)}</span>
          )}
        </div>
      )}
      {task?.current && detail && (
        <div style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={detail}>
          {detail}
        </div>
      )}

      {task && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 8 }}>
          {task.steps.map((s) => <StepChip key={s.id} step={s} />)}
        </div>
      )}
    </div>
  );
}

export function SiliconBoard() {
  const { pipeline, agents } = useAgentData();
  const [, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const details = useMemo(() => {
    const m = new Map<string, string | undefined>();
    for (const a of agents.values()) if (a.agentId.startsWith("si-")) m.set(a.agentId.slice(3), a.detail);
    return m;
  }, [agents]);

  if (!pipeline) {
    return (
      <aside id="silicon-board" className="si-panel">
        <PanelTitle title="TABLERO DE PROGRESO" />
        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", lineHeight: 1.6, padding: "24px 4px" }}>
          Sin ningún run todavía.<br />
          Describe el circuito en el panel de la derecha y presiona <b style={{ color: "#fbbf24" }}>Lanzar pipeline</b>;
          aquí verás en qué trabaja cada agente y su avance.
        </div>
      </aside>
    );
  }

  const live = pipeline.mode === "live" && pipeline.status === "running";
  const now = live ? Date.now() / 1000 : pipeline.updatedTs; // `tick` re-renders every second
  const elapsed = pipeline.startedTs !== null ? now - pipeline.startedTs : 0;
  const statusRgb = pipeline.status === "done" ? "52,211,153" : pipeline.status === "error" ? "244,63,94" : pipeline.status === "running" ? "56,189,248" : "148,163,184";
  const statusText = pipeline.status === "done" ? "completado" : pipeline.status === "error" ? "con error" : pipeline.status === "running" ? "en curso" : "inactivo";
  const metrics = METRICS.filter((m) => pipeline.metrics[m.key] !== undefined);
  const feed = [...pipeline.feed].reverse();

  return (
    <aside id="silicon-board" className="si-panel">
      <PanelTitle title="TABLERO DE PROGRESO" />

      <div className="si-card" style={{ background: "rgba(255,255,255,0.035)" }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
          <span id="silicon-overall-pct" style={{ fontSize: 30, fontWeight: 800, lineHeight: 1 }}>{pipeline.progress}<span style={{ fontSize: 14, opacity: 0.6 }}>%</span></span>
          <span style={{ fontSize: 11, color: "rgba(255,255,255,0.5)" }}>
            {Object.values(pipeline.stages).filter((s) => s === "ok" || s === "skipped").length}/10 etapas
          </span>
          <span
            style={{
              marginLeft: "auto", fontSize: 10, padding: "2px 8px", borderRadius: 9999, textTransform: "uppercase", letterSpacing: "0.08em",
              color: `rgb(${statusRgb})`, background: `rgba(${statusRgb},0.12)`, border: `1px solid rgba(${statusRgb},0.3)`,
            }}
          >
            {statusText}
          </span>
        </div>

        <div style={{ display: "flex", gap: 3, marginTop: 10 }}>
          {Object.entries(pipeline.stages).map(([k, s]) => (
            <div key={k} title={`${STAGE_LABEL[k]} · ${s}`} style={{ flex: 1, minWidth: 0 }}>
              <div className={s === "running" ? "si-seg si-seg-active" : "si-seg"} style={{ background: STAGE_COLOR[s] }} />
              <div style={{ fontSize: 8, marginTop: 3, color: s === "pending" ? "rgba(255,255,255,0.3)" : STAGE_COLOR[s], textAlign: "center", overflow: "hidden", textOverflow: "clip", whiteSpace: "nowrap" }}>
                {STAGE_LABEL[k]}
              </div>
            </div>
          ))}
        </div>

        <div style={{ display: "flex", gap: 14, marginTop: 10, fontSize: 11, color: "rgba(255,255,255,0.5)", flexWrap: "wrap" }}>
          <span>⏱ {fmtElapsed(elapsed)}</span>
          {pipeline.design && <span>◧ {pipeline.design}</span>}
          {pipeline.blocks.length > 0 && <span title={pipeline.blocks.join(", ")}>▦ {pipeline.blocks.length} bloque{pipeline.blocks.length !== 1 ? "s" : ""}</span>}
          {pipeline.synthetic && <span title="Run anterior a la telemetría: línea de tiempo reconstruida de pipeline_report.json">⟲ reconstruido</span>}
        </div>

        {pipeline.prompt && (
          <div style={{ marginTop: 8, fontSize: 11, color: "rgba(255,255,255,0.65)", lineHeight: 1.5, maxHeight: 66, overflow: "auto" }}>
            “{pipeline.prompt}”
          </div>
        )}

        {metrics.length > 0 && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(80px, 1fr))", gap: 6, marginTop: 10 }}>
            {metrics.map((m) => (
              <div key={m.key} style={{ background: "rgba(0,0,0,0.3)", borderRadius: 6, padding: "5px 8px", border: "1px solid rgba(255,255,255,0.06)" }}>
                <div style={{ fontSize: 9, color: "rgba(255,255,255,0.35)", textTransform: "uppercase", letterSpacing: "0.08em" }}>{m.label}</div>
                <div style={{ fontSize: 12, fontWeight: 700 }}>{m.fmt(pipeline.metrics[m.key])}</div>
              </div>
            ))}
          </div>
        )}

        {pipeline.status === "done" && (
          <div className="si-done-cta">
            <div style={{ fontSize: 11, color: "#34d399", marginBottom: 6 }}>
              ✓ Circuito terminado{pipeline.design ? ` · ${pipeline.design}` : ""} — GDSII listo
            </div>
            <OpenGuiButton runId={pipeline.runId} id="silicon-open-gui" />
          </div>
        )}
      </div>

      {ROLES.map((meta) => (
        <AgentCard key={meta.role} meta={meta} task={pipeline.tasks?.[meta.role]} detail={details.get(meta.role)} now={now} />
      ))}

      <div className="si-card">
        <div style={{ fontSize: 10, letterSpacing: "0.12em", color: "rgba(255,255,255,0.4)", marginBottom: 6 }}>ACTIVIDAD</div>
        <div id="silicon-feed" style={{ display: "flex", flexDirection: "column", gap: 3, maxHeight: 220, overflow: "auto" }}>
          {feed.length === 0 && <span style={{ fontSize: 11, color: "rgba(255,255,255,0.3)" }}>—</span>}
          {feed.map((f, i) => {
            const meta = ROLES.find((r) => r.role === f.role);
            return (
              <div key={`${f.ts}-${i}`} style={{ fontSize: 10.5, display: "flex", gap: 6, lineHeight: 1.4 }}>
                <span style={{ color: `rgb(${meta?.rgb ?? "255,255,255"})`, flexShrink: 0, minWidth: 66 }}>{meta?.name}</span>
                <span style={{ color: FEED_COLOR[f.kind], wordBreak: "break-word" }}>{f.text}</span>
              </div>
            );
          })}
        </div>
      </div>
    </aside>
  );
}

export function PanelTitle({ title, hint }: { title: string; hint?: string }) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", gap: 8, padding: "2px 2px 0" }}>
      <span style={{ fontSize: 11, letterSpacing: "0.18em", color: "rgba(251,191,36,0.85)", fontWeight: 700 }}>{title}</span>
      {hint && <span style={{ fontSize: 10, color: "rgba(255,255,255,0.3)" }}>{hint}</span>}
    </div>
  );
}
