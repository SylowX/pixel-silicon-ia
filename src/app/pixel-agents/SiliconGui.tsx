"use client";

import { useSyncExternalStore } from "react";

// Shared client store for OpenROAD GUI windows (one poller for the whole page)
// plus the reusable "open layout" button.

export interface GuiView {
  runId: string; running: boolean; startedAt: number; exitCode: number | null; odb: string; error: string | null;
}
interface Snapshot {
  wslg: boolean | null;
  guis: Record<string, GuiView>;
  pending: Record<string, boolean>;
  errors: Record<string, string>;
}

let snap: Snapshot = { wslg: null, guis: {}, pending: {}, errors: {} };
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | null = null;

function emit(patch: Partial<Snapshot>) {
  snap = { ...snap, ...patch };
  listeners.forEach((l) => l());
}

async function refresh() {
  try {
    const r = await fetch("/api/pixel-agents/silicon-gui", { cache: "no-store" });
    if (!r.ok) return;
    const d = (await r.json()) as { wslg: boolean; guis: GuiView[] };
    emit({ wslg: d.wslg, guis: Object.fromEntries(d.guis.map((x) => [x.runId, x])) });
  } catch { /* offline */ }
}

function subscribe(l: () => void) {
  listeners.add(l);
  if (!timer) { refresh(); timer = setInterval(refresh, 3000); }
  return () => {
    listeners.delete(l);
    if (listeners.size === 0 && timer) { clearInterval(timer); timer = null; }
  };
}

export async function openGui(runId: string) {
  emit({ pending: { ...snap.pending, [runId]: true }, errors: { ...snap.errors, [runId]: "" } });
  try {
    const r = await fetch("/api/pixel-agents/silicon-gui", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ runId }),
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) {
      const detail = d.detail ? `\n${String(d.detail).split("\n").slice(-3).join("\n")}` : "";
      emit({ errors: { ...snap.errors, [runId]: `${d.error ?? `Error ${r.status}`}${detail}` } });
    }
  } catch (e) {
    emit({ errors: { ...snap.errors, [runId]: (e as Error).message } });
  } finally {
    emit({ pending: { ...snap.pending, [runId]: false } });
    refresh();
  }
}

export async function closeGui(runId: string) {
  emit({ pending: { ...snap.pending, [runId]: true } });
  try {
    await fetch(`/api/pixel-agents/silicon-gui?runId=${encodeURIComponent(runId)}`, { method: "DELETE" });
  } finally {
    emit({ pending: { ...snap.pending, [runId]: false } });
    refresh();
  }
}

export function useSiliconGui(): Snapshot {
  return useSyncExternalStore(subscribe, () => snap, () => snap);
}

/** Big call-to-action used when a run finished: opens / closes the layout viewer. */
export function OpenGuiButton({ runId, compact = false, id }: { runId: string; compact?: boolean; id?: string }) {
  const s = useSiliconGui();
  const gui = s.guis[runId];
  const busy = Boolean(s.pending[runId]);
  const open = Boolean(gui?.running);
  const err = s.errors[runId] || gui?.error || "";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <div style={{ display: "flex", gap: 6 }}>
        <button
          id={id}
          type="button"
          className={compact ? "si-gui-btn si-gui-btn-sm" : "si-gui-btn"}
          disabled={busy || open}
          onClick={(e) => { e.stopPropagation(); openGui(runId); }}
          title="Abre el layout final (.odb) en OpenROAD GUI vía WSLg"
        >
          {busy ? "Abriendo OpenROAD…" : open ? "● GUI abierta" : "🔬 Ver circuito en OpenROAD GUI"}
        </button>
        {open && (
          <button type="button" className="si-gui-close" disabled={busy}
            onClick={(e) => { e.stopPropagation(); closeGui(runId); }} title="Cerrar la ventana de OpenROAD">
            ✕
          </button>
        )}
      </div>
      {open && !compact && (
        <span style={{ fontSize: 10, color: "rgba(255,255,255,0.4)" }}>
          La ventana de OpenROAD se abre en tu escritorio (puede tardar unos segundos).
        </span>
      )}
      {err && !open && (
        <span style={{ fontSize: 10, color: "#f43f5e", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>✗ {err}</span>
      )}
    </div>
  );
}
