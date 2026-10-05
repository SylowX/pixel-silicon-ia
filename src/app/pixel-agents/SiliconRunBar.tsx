"use client";

import { useEffect, useState } from "react";
import { useAgentData } from "./AgentDataContext";

// Minimal SiliconIA controls: run picker, live/replay switch and a one-line
// progress readout. (The full pipeline HUD is Phase 3.)

interface RunInfo { id: string; prompt: string; hasEvents: boolean; hasReport: boolean; success: boolean | null }

const STAGE_LABEL: Record<string, string> = {
  pdk: "PDK", spec: "Spec", rtl: "RTL", verify: "Verif", logic_synth: "Synth",
  floorplan: "Floorplan", place: "Place", cts: "CTS", route: "Route", finish: "GDSII",
};
const STATUS_COLOR: Record<string, string> = {
  pending: "rgba(255,255,255,0.18)", running: "#38bdf8", ok: "#34d399", error: "#f43f5e", skipped: "rgba(255,255,255,0.35)",
};

function navigate(patch: Record<string, string | null>) {
  const q = new URLSearchParams(window.location.search);
  for (const [k, v] of Object.entries(patch)) { if (v === null) q.delete(k); else q.set(k, v); }
  const qs = q.toString();
  window.location.search = qs ? `?${qs}` : "";
}

export function SiliconRunBar() {
  const { pipeline } = useAgentData();
  const [runs, setRuns] = useState<RunInfo[]>([]);
  const [params, setParams] = useState<{ run: string | null; replay: boolean }>({ run: null, replay: false });

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    setParams({ run: q.get("run"), replay: q.get("replay") === "1" });
    fetch("/api/pixel-agents/silicon-runs").then((r) => r.json()).then((d) => setRuns(d.runs ?? [])).catch(() => {});
  }, []);

  const font = { fontFamily: "monospace", fontSize: 11 } as const;
  const control = { ...font, background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.75)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 4, padding: "2px 6px" } as const;
  const running = pipeline ? Object.entries(pipeline.stages).find(([, s]) => s === "running")?.[0] : undefined;

  return (
    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10, marginBottom: 12, ...font }}>
      <span style={{ color: "rgba(251,191,36,0.85)", letterSpacing: "0.1em" }}>SILICONIA</span>

      <select id="silicon-run-select" style={control} value={params.run ?? ""}
        onChange={(e) => navigate({ run: e.target.value || null })}>
        <option value="">auto · run activo</option>
        {runs.map((r) => (
          <option key={r.id} value={r.id}>
            {r.success === true ? "✓" : r.success === false ? "✗" : "…"} {r.id}{!r.hasEvents && r.hasReport ? " (reporte)" : ""}
          </option>
        ))}
      </select>

      <button id="silicon-mode-toggle" style={{ ...control, cursor: "pointer" }}
        onClick={() => navigate(params.replay ? { replay: null, loop: null } : { replay: "1", loop: "1" })}>
        {params.replay ? "▶ replay · cambiar a live" : "● live · cambiar a replay"}
      </button>

      {pipeline && (
        <>
          <span style={{ display: "flex", gap: 4 }} title={pipeline.lastEvent ?? ""}>
            {Object.entries(pipeline.stages).map(([k, s]) => (
              <span key={k} style={{ color: STATUS_COLOR[s], borderBottom: `2px solid ${STATUS_COLOR[s]}`, padding: "0 2px" }}>
                {STAGE_LABEL[k] ?? k}
              </span>
            ))}
          </span>
          <span style={{ color: "rgba(255,255,255,0.35)" }}>
            {pipeline.status}{running ? ` · ${STAGE_LABEL[running]}` : ""}{pipeline.design ? ` · ${pipeline.design}` : ""}
            {pipeline.synthetic ? " · reconstruido de pipeline_report.json" : ""}
          </span>
          {pipeline.prompt && (
            <span style={{ color: "rgba(255,255,255,0.5)", flexBasis: "100%" }}>“{pipeline.prompt.slice(0, 160)}”</span>
          )}
        </>
      )}
    </div>
  );
}
