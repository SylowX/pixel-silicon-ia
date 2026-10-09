"use client";

import { useCallback, useEffect, useState } from "react";
import { PanelTitle } from "./SiliconBoard";
import { closeGui, openGui, useSiliconGui } from "./SiliconGui";
import { useAgentData } from "./AgentDataContext";

// History of designed circuits. Clicking a finished design opens its layout in
// the OpenROAD GUI; "ver en tablero" replays the run on the progress board.

interface RunInfo {
  id: string;
  prompt: string;
  mtimeMs: number;
  hasEvents: boolean;
  hasReport: boolean;
  success: boolean | null;
  design: string | null;
  finishedMs: number | null;
  metrics: Record<string, number>;
  hasOdb: boolean;
  failedPhase: string | null;
}

const PHASE_ES: Record<string, string> = { pdk: "PDK", coresmith: "CoreSmith (RTL)", orfs: "flujo físico" };

function fmtDate(ms: number | null): string {
  if (!ms) return "";
  const d = new Date(ms);
  const today = new Date();
  const sameDay = d.toDateString() === today.toDateString();
  const time = d.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });
  return sameDay ? `hoy ${time}` : `${d.toLocaleDateString("es-MX", { day: "numeric", month: "short" })} ${time}`;
}

function replay(id: string) {
  const q = new URLSearchParams(window.location.search);
  q.set("run", id); q.set("replay", "1"); q.set("speed", "3"); q.delete("loop");
  window.location.search = `?${q.toString()}`;
}

export function SiliconHistory() {
  const [runs, setRuns] = useState<RunInfo[] | null>(null);
  const [activeRun, setActiveRun] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const gui = useSiliconGui();
  const { pipeline, dispatch } = useAgentData();

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/pixel-agents/silicon-runs", { cache: "no-store" });
      const d = await r.json();
      setRuns(d.runs ?? []);
      setActiveRun(d.current?.status === "running" ? d.current.run_id ?? null : null);
    } catch { /* keep last */ }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, 10000);
    return () => clearInterval(id);
  }, [load]);

  useEffect(() => {
    if (!confirmDeleteId) return;
    const t = setTimeout(() => setConfirmDeleteId(null), 4000);
    return () => clearTimeout(t);
  }, [confirmDeleteId]);

  const handleDelete = async (id: string) => {
    if (confirmDeleteId !== id) {
      setConfirmDeleteId(id);
      return;
    }
    setDeletingId(id);
    try {
      const res = await fetch(`/api/pixel-agents/silicon-runs?runId=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setConfirmDeleteId(null);
        const q = new URLSearchParams(window.location.search);
        if (q.get("run") === id) {
          q.delete("run");
          q.delete("replay");
          const qs = q.toString();
          window.history.replaceState(null, "", qs ? `?${qs}` : window.location.pathname);
        }
        if (pipeline?.runId === id) {
          dispatch({ type: "session_change", sessionId: "none" });
          dispatch({ type: "pipeline", pipeline: null });
        }
        window.dispatchEvent(new CustomEvent("silicon-run-deleted", { detail: { runId: id } }));
        await load();
      }
    } catch {
      /* keep last */
    } finally {
      setDeletingId(null);
    }
  };

  const list = (runs ?? []).slice().sort((a, b) => (b.finishedMs ?? b.mtimeMs) - (a.finishedMs ?? a.mtimeMs));
  const ok = list.filter((r) => r.success).length;

  return (
    <section id="silicon-history" className="si-card" style={{ padding: "10px 10px 6px" }}>
      <div style={{ display: "flex", alignItems: "baseline", marginBottom: 8, padding: "0 2px" }}>
        <PanelTitle title="HISTORIAL DE CIRCUITOS" />
        <span style={{ marginLeft: "auto", fontSize: 10, color: "rgba(255,255,255,0.35)" }}>
          {list.length ? `${ok}/${list.length} completados` : ""}
        </span>
      </div>

      {gui.wslg === false && (
        <div style={{ fontSize: 10, color: "#fbbf24", marginBottom: 6, padding: "0 2px" }}>
          ⚠ WSLg no detectado: la GUI de OpenROAD necesita la distro Ubuntu de WSL2 encendida.
        </div>
      )}

      {runs === null && <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", padding: 6 }}>cargando…</div>}
      {runs !== null && list.length === 0 && (
        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", padding: 6 }}>Aún no hay circuitos diseñados.</div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 420, overflowY: "auto", paddingRight: 2 }}>
        {list.map((r) => {
          const inProgress = r.id === activeRun;
          const isAborted = r.failedPhase === "aborted" || (!r.hasReport && !inProgress && r.success !== true);
          const g = gui.guis[r.id];
          const open = Boolean(g?.running);
          const busy = Boolean(gui.pending[r.id]);
          const err = gui.errors[r.id] || g?.error || "";
          const canOpen = r.hasOdb && !inProgress;
          const icon = inProgress ? "⏳" : r.success ? "✓" : "✗";
          const iconColor = inProgress ? "#38bdf8" : r.success ? "#34d399" : "#f43f5e";
          const area = r.metrics.design_area_um2;
          const cells = r.metrics.cell_count;
          return (
            <div
              key={r.id}
              role={canOpen ? "button" : undefined}
              tabIndex={canOpen ? 0 : -1}
              className={`si-hist${canOpen ? " si-hist-click" : ""}${open ? " si-hist-open" : ""}`}
              title={canOpen ? "Clic para abrir el layout en OpenROAD GUI" : r.id}
              onClick={() => { if (canOpen && !open && !busy) openGui(r.id); }}
              onKeyDown={(e) => { if ((e.key === "Enter" || e.key === " ") && canOpen && !open && !busy) { e.preventDefault(); openGui(r.id); } }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ color: iconColor, fontWeight: 700, width: 14, textAlign: "center" }}>{icon}</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: "#fff" }}>{r.design ?? r.id.replace(/-\d{8}-\d{6}$/, "")}</span>
                <span style={{ marginLeft: "auto", fontSize: 10, color: "rgba(255,255,255,0.35)", whiteSpace: "nowrap" }}>
                  {inProgress ? "en curso" : isAborted ? "abortado" : fmtDate(r.finishedMs ?? r.mtimeMs)}
                </span>
                <button
                  type="button"
                  title={confirmDeleteId === r.id ? "Haz clic de nuevo para confirmar eliminación" : "Eliminar del historial"}
                  disabled={deletingId === r.id || inProgress}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(r.id);
                  }}
                  style={{
                    background: confirmDeleteId === r.id ? "rgba(244,63,94,0.25)" : "transparent",
                    border: confirmDeleteId === r.id ? "1px solid rgba(244,63,94,0.6)" : "none",
                    borderRadius: 4,
                    color: confirmDeleteId === r.id ? "#f43f5e" : "rgba(255,255,255,0.28)",
                    fontSize: confirmDeleteId === r.id ? 9 : 11,
                    cursor: inProgress ? "not-allowed" : "pointer",
                    padding: confirmDeleteId === r.id ? "1px 6px" : "1px 4px",
                    lineHeight: 1,
                    transition: "color 0.2s, background 0.2s, border 0.2s",
                  }}
                  onMouseEnter={(e) => {
                    if (confirmDeleteId !== r.id) {
                      e.currentTarget.style.color = "#f43f5e";
                      e.currentTarget.style.background = "rgba(244,63,94,0.12)";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (confirmDeleteId !== r.id) {
                      e.currentTarget.style.color = "rgba(255,255,255,0.28)";
                      e.currentTarget.style.background = "transparent";
                    }
                  }}
                >
                  {deletingId === r.id ? "…" : confirmDeleteId === r.id ? "eliminar?" : "🗑"}
                </button>
              </div>
              {r.prompt && (
                <div className="si-hist-prompt">{r.prompt}</div>
              )}
              <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6, marginTop: 5, fontSize: 10 }}>
                {area !== undefined && <span className="si-hist-chip">{Math.round(area).toLocaleString("es-MX")} µm²</span>}
                {cells !== undefined && <span className="si-hist-chip">{cells} celdas</span>}
                {r.metrics.utilization_pct !== undefined && <span className="si-hist-chip">{r.metrics.utilization_pct}% util</span>}
                {!inProgress && (r.success === false || isAborted) && (
                  <span style={{ color: "#f43f5e" }}>
                    {r.failedPhase === "aborted" || isAborted ? "diseño abortado" : `falló en ${PHASE_ES[r.failedPhase ?? ""] ?? r.failedPhase ?? "?"}`}
                  </span>
                )}
                <span style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
                  {(r.hasEvents || r.hasReport) && (
                    <button type="button" className="si-link" style={{ marginTop: 0 }}
                      onClick={(e) => { e.stopPropagation(); replay(r.id); }}>
                      ⟲ tablero
                    </button>
                  )}
                  {canOpen && (
                    open ? (
                      <button type="button" className="si-hist-gui si-hist-gui-on" disabled={busy}
                        onClick={(e) => { e.stopPropagation(); closeGui(r.id); }} title="Cerrar OpenROAD GUI">
                        ● abierta · cerrar
                      </button>
                    ) : (
                      <span className="si-hist-gui">{busy ? "abriendo…" : "🔬 abrir GUI"}</span>
                    )
                  )}
                </span>
              </div>
              {err && !open && (
                <div style={{ fontSize: 10, color: "#f43f5e", marginTop: 4, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>✗ {err}</div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
