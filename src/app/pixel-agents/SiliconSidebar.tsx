"use client";

import { useEffect, useRef, useState } from "react";
import { SiliconHistory } from "./SiliconHistory";
import { isRunning, stopPipeline, useLauncher } from "./siliconLauncher";

// Right-hand column: history of designed circuits + pipeline environment
// (Docker / image status, last launch, console, stop). The "describe your
// circuit" editor lives in the bottom-center composer (SiliconComposer).

function Chip({ ok, label, hint }: { ok: boolean | null; label: string; hint?: string }) {
  const rgb = ok === null ? "148,163,184" : ok ? "52,211,153" : "244,63,94";
  return (
    <span
      title={hint}
      style={{
        fontSize: 10, padding: "2px 8px", borderRadius: 9999, display: "inline-flex", alignItems: "center", gap: 5,
        color: `rgb(${rgb})`, background: `rgba(${rgb},0.1)`, border: `1px solid rgba(${rgb},0.28)`,
      }}
    >
      <span style={{ width: 5, height: 5, borderRadius: "50%", background: `rgb(${rgb})` }} />
      {label}
    </span>
  );
}

export function SiliconSidebar() {
  const launcher = useLauncher();
  const { env, busy } = launcher;
  const running = isRunning(launcher);
  const [showLog, setShowLog] = useState(false);
  const logRef = useRef<HTMLPreElement | null>(null);
  const exit = env?.launcher.exitCode;

  useEffect(() => {
    if (running) setShowLog(true);
  }, [running]);

  useEffect(() => {
    if (showLog && logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [showLog, env?.launcher.logTail]);

  return (
    <aside id="silicon-sidebar" className="si-panel">
      <SiliconHistory />

      <div className="si-card">
        <div style={{ fontSize: 10, letterSpacing: "0.12em", color: "rgba(255,255,255,0.4)", marginBottom: 8 }}>ENTORNO</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          <Chip ok={env ? env.docker : null} label={env?.docker ? `Docker ${env.dockerVersion ?? ""}` : "Docker apagado"} hint="Motor de Docker Desktop" />
          <Chip ok={env ? env.image : null} label={env?.image ? "imagen lista" : "sin imagen"} hint="siliconia-pipeline:latest" />
          <Chip ok={running ? true : null} label={running ? "pipeline ejecutando" : "pipeline libre"} />
        </div>

        {env?.launcher.prompt && (
          <div style={{ marginTop: 10, fontSize: 11, color: "rgba(255,255,255,0.55)", lineHeight: 1.5 }}>
            Último lanzamiento: “{env.launcher.prompt.slice(0, 140)}{env.launcher.prompt.length > 140 ? "…" : ""}”
            {env.launcher.runId && <span style={{ color: "rgba(255,255,255,0.4)" }}> · run {env.launcher.runId}</span>}
            {!env.launcher.running && exit !== null && exit !== undefined && (
              exit === 0 && env.launcher.runId
                ? <span style={{ color: "#34d399" }}> · terminó correctamente</span>
                : <span style={{ color: "#f43f5e" }}> · {exit === 0 ? "terminó sin crear ningún run (revisa la consola)" : `falló con código ${exit} (revisa la consola)`}</span>
            )}
          </div>
        )}
        {running && (
          <div style={{ marginTop: 10 }}>
            <button id="silicon-stop-side" type="button" className="si-stop" style={{ padding: "6px 12px", fontSize: 11 }}
              disabled={busy} onClick={stopPipeline}>
              ■ Detener pipeline
            </button>
          </div>
        )}

        {(env?.launcher.logTail || running) && (
          <>
            <button type="button" className="si-link" onClick={() => setShowLog((v) => !v)}>
              {showLog ? "▾ ocultar consola" : "▸ ver consola del pipeline"}
            </button>
            {showLog && (
              <pre ref={logRef} className="si-log">
                {env?.launcher.logTail || "Iniciando contenedor y compilando log..."}
              </pre>
            )}
          </>
        )}
      </div>

      <div style={{ fontSize: 10, color: "rgba(255,255,255,0.28)", lineHeight: 1.6, padding: "0 4px" }}>
        El pipeline corre en Docker (CoreSmith → OpenROAD · Sky130). Un run completo puede tardar de minutos a horas según el diseño.
      </div>
    </aside>
  );
}
