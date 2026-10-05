"use client";

import { useEffect, useRef, useState } from "react";
import { useAgentData } from "./AgentDataContext";
import {
  blockerOf, isRunning, launchPipeline, setLauncherMessage, stopPipeline, useLauncher,
} from "./siliconLauncher";

// Bottom-center composer: a compact "describe your circuit" bar docked under the
// pixel office. Clicking it unfolds a card upward with the full editor
// (multi-line text, voice dictation, examples, options) and the launch button.
// The dock reserves only the bar height; the card grows upward over the office
// so opening it never shifts the page layout.

const EXAMPLES = [
  "Diseña un sumador de 32 bits con acarreo de entrada y salida",
  "Quiero un contador de 16 bits con reset asíncrono y habilitación",
  "Un multiplicador de 8x8 bits combinacional, con salida de 16 bits",
  "Una ALU de 8 bits con suma, resta, AND, OR y XOR",
];

const STAGE_LABEL: Record<string, string> = {
  pdk: "PDK", spec: "Spec", rtl: "RTL", verify: "Verificación", logic_synth: "Síntesis",
  floorplan: "Floorplan", place: "Placement", cts: "CTS", route: "Routing", finish: "GDSII",
};

interface SpeechRec {
  lang: string; continuous: boolean; interimResults: boolean;
  onresult: ((e: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  start(): void; stop(): void;
}

export function SiliconComposer() {
  const launcher = useLauncher();
  const { pipeline } = useAgentData();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [autoApprove, setAutoApprove] = useState(true);
  const [openGui, setOpenGui] = useState(false);
  const [listening, setListening] = useState(false);
  const [speechOk, setSpeechOk] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const taRef = useRef<HTMLTextAreaElement | null>(null);
  const recRef = useRef<SpeechRec | null>(null);
  const baseRef = useRef("");

  const running = isRunning(launcher);
  const blocker = blockerOf(launcher);
  const busy = launcher.busy;
  const canLaunch = text.trim().length >= 5 && !running && !busy && !blocker;
  const message = launcher.message;
  const isOpen = open && !running;

  useEffect(() => {
    const w = window as unknown as { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown };
    setSpeechOk(Boolean(w.SpeechRecognition || w.webkitSpeechRecognition));
    return () => recRef.current?.stop();
  }, []);

  // Close on outside click / Escape (the text is kept).
  useEffect(() => {
    if (!isOpen) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { setOpen(false); taRef.current?.blur(); } };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
  }, [isOpen]);

  // Errors pop the card open so they are not missed.
  useEffect(() => { if (message?.kind === "error") setOpen(true); }, [message]);

  function expand() {
    if (running) return;
    setOpen(true);
    requestAnimationFrame(() => taRef.current?.focus());
  }

  function toggleMic(e: React.MouseEvent) {
    e.stopPropagation();
    if (listening) { recRef.current?.stop(); return; }
    const w = window as unknown as { SpeechRecognition?: new () => SpeechRec; webkitSpeechRecognition?: new () => SpeechRec };
    const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!Ctor) return;
    setOpen(true);
    const rec = new Ctor();
    rec.lang = "es-MX";
    rec.continuous = true;
    rec.interimResults = true;
    baseRef.current = text ? text.replace(/\s*$/, " ") : "";
    rec.onresult = (ev) => {
      let finals = "";
      let interim = "";
      for (let i = 0; i < ev.results.length; i++) {
        const r = ev.results[i];
        if (r.isFinal) finals += r[0].transcript; else interim += r[0].transcript;
      }
      setText((baseRef.current + finals + interim).slice(0, 6000));
      if (finals) baseRef.current += finals;
    };
    rec.onerror = (ev) => {
      if (ev.error !== "no-speech" && ev.error !== "aborted") {
        setLauncherMessage({ kind: "error", text: `Dictado no disponible (${ev.error}). Revisa el permiso del micrófono.` });
      }
    };
    rec.onend = () => setListening(false);
    recRef.current = rec;
    try { rec.start(); setListening(true); } catch { setListening(false); }
  }

  async function launch(e?: React.MouseEvent) {
    e?.stopPropagation();
    if (!canLaunch) { if (!isOpen) expand(); return; }
    if (listening) recRef.current?.stop();
    const ok = await launchPipeline(text, { autoApprove, openGui });
    if (ok) { setOpen(false); setText(""); }
  }

  const runningStage = pipeline ? Object.entries(pipeline.stages).find(([, s]) => s === "running")?.[0] : undefined;
  const pct = pipeline?.progress ?? 0;

  return (
    <div ref={rootRef} id="silicon-composer" className={`si-composer${isOpen ? " si-composer-open" : ""}${running ? " si-composer-busy" : ""}`}>
      <div className="si-composer-shell">
        {/* Card that unfolds upward */}
        <div className="si-composer-card" aria-hidden={!isOpen}>
          <div className="si-composer-card-inner">
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span className="si-composer-badge">✦</span>
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <span style={{ fontSize: 11, letterSpacing: "0.18em", color: "#fbbf24", fontWeight: 700 }}>NUEVO CIRCUITO</span>
                <span style={{ fontSize: 10.5, color: "rgba(255,255,255,0.45)" }}>Describe en lenguaje natural lo que quieres diseñar: función, anchos de bus, reloj…</span>
              </div>
              <button type="button" className="si-composer-x" tabIndex={isOpen ? 0 : -1}
                onClick={() => setOpen(false)} title="Cerrar (Esc)">✕</button>
            </div>

            <div style={{ fontSize: 9, letterSpacing: "0.14em", color: "rgba(255,255,255,0.35)", marginTop: 14 }}>EJEMPLOS</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 6 }}>
              {EXAMPLES.map((ex) => (
                <button key={ex} type="button" className={`si-chip-example${text === ex ? " si-chip-example-on" : ""}`}
                  tabIndex={isOpen ? 0 : -1}
                  onClick={() => { setText(ex); taRef.current?.focus(); }}>
                  {ex}
                </button>
              ))}
            </div>

            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 18, marginTop: 14, fontSize: 11, color: "rgba(255,255,255,0.65)" }}>
              <label style={{ display: "flex", gap: 7, alignItems: "center", cursor: "pointer" }}>
                <input type="checkbox" checked={autoApprove} tabIndex={isOpen ? 0 : -1} onChange={(e) => setAutoApprove(e.target.checked)} />
                Auto-aprobar las pausas de CoreSmith
              </label>
              <label style={{ display: "flex", gap: 7, alignItems: "center", cursor: "pointer" }}>
                <input type="checkbox" checked={openGui} tabIndex={isOpen ? 0 : -1} onChange={(e) => setOpenGui(e.target.checked)} />
                Abrir OpenROAD GUI al terminar
              </label>
            </div>

            {blocker && (
              <div style={{ marginTop: 10, fontSize: 11, color: "#fbbf24", lineHeight: 1.5 }}>⚠ {blocker}</div>
            )}
            {message && (
              <div style={{ marginTop: 10, fontSize: 11, lineHeight: 1.5, color: message.kind === "error" ? "#f43f5e" : "#34d399" }}>
                {message.kind === "error" ? "✗ " : "✓ "}{message.text}
              </div>
            )}
            <div className="si-composer-sep" />
          </div>
        </div>

        {/* Always-visible bar */}
        <div className="si-composer-bar" onClick={expand}>
          <span className={`si-composer-icon${blocker && !running ? " si-composer-icon-warn" : ""}`} title={blocker ?? undefined}>
            {running ? <span className="si-spin" /> : blocker ? "⚠" : "✦"}
          </span>
          {running ? (
            <span className="si-composer-running">
              <b style={{ color: "#38bdf8" }}>Pipeline en ejecución</b>
              {runningStage ? ` · ${STAGE_LABEL[runningStage] ?? runningStage}` : ""}
              {pipeline ? ` · ${pct}%` : ""}
              {launcher.env?.launcher.prompt ? <span style={{ opacity: 0.5 }}> — “{launcher.env.launcher.prompt.slice(0, 80)}”</span> : null}
            </span>
          ) : (
            <textarea
              ref={taRef}
              id="silicon-prompt-input"
              className="si-composer-input"
              rows={1}
              value={text}
              maxLength={6000}
              placeholder={isOpen
                ? "ej. «Diseña un sumador de 32 bits con acarreo de entrada y salida, para reloj de 50 MHz»"
                : "Describe el circuito que quieres diseñar…"}
              onFocus={() => setOpen(true)}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); launch(); }
              }}
            />
          )}
          {!running && speechOk && (
            <button id="silicon-mic" type="button" className={listening ? "si-composer-mic si-mic-on" : "si-composer-mic"}
              onClick={toggleMic} title={listening ? "Detener dictado" : "Dictar por voz (español)"}>
              {listening ? "■" : "🎙"}
            </button>
          )}
          {running ? (
            <button id="silicon-stop" type="button" className="si-stop" style={{ padding: "7px 12px", fontSize: 11 }} disabled={busy}
              onClick={(e) => { e.stopPropagation(); stopPipeline(); }}>
              ■ Detener
            </button>
          ) : (
            <button id="silicon-launch" type="button" className="si-composer-send" disabled={isOpen && !canLaunch} onClick={launch}
              title={blocker ?? "Lanzar pipeline (Ctrl + Enter)"}>
              {busy ? "Lanzando…" : isOpen ? "▶ Lanzar pipeline" : "▶"}
            </button>
          )}
          {running && <span className="si-composer-progress" style={{ width: `${pct}%` }} />}
        </div>

        {isOpen && (
          <div className="si-composer-foot">
            <span>{listening ? "● escuchando…" : "Ctrl + Enter para lanzar · Esc para cerrar"}</span>
            <span>{text.length}/6000</span>
          </div>
        )}
      </div>
    </div>
  );
}
