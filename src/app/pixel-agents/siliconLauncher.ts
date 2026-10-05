"use client";

import { useSyncExternalStore } from "react";

// Shared client store for the pipeline launcher (/api/pixel-agents/silicon-launch).
// Used by the bottom composer (describe + launch) and the right sidebar
// (environment, console, stop) so both see the same state with one poller.

export interface LauncherView {
  running: boolean; pid: number | null; startedAt: number | null; exitCode: number | null;
  prompt: string | null; runId: string | null; logTail: string;
}
export interface EnvView {
  docker: boolean; dockerVersion: string | null; image: boolean; containerRunning: boolean;
  scriptFound: boolean; launcher: LauncherView;
}
export interface LauncherSnapshot {
  env: EnvView | null;
  envError: boolean;
  busy: boolean;
  message: { kind: "error" | "ok"; text: string } | null;
}

let snap: LauncherSnapshot = { env: null, envError: false, busy: false, message: null };
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setTimeout> | null = null;
let gen = 0; // bumps when polling (re)starts/stops so stale loops die

function emit(patch: Partial<LauncherSnapshot>) {
  snap = { ...snap, ...patch };
  listeners.forEach((l) => l());
}

export function isRunning(s: LauncherSnapshot): boolean {
  return Boolean(s.env?.launcher.running || s.env?.containerRunning);
}

export function blockerOf(s: LauncherSnapshot): string | null {
  if (s.envError) return "No se pudo consultar el estado del servidor.";
  if (s.env && !s.env.docker) return "Docker no está disponible: abre Docker Desktop y espera a que inicie.";
  if (s.env && !s.env.image) return "Falta la imagen siliconia-pipeline. Constrúyela una vez: .\\run_pipeline.ps1 -Build";
  return null;
}

export async function refreshLauncher() {
  try {
    const r = await fetch("/api/pixel-agents/silicon-launch", { cache: "no-store" });
    if (!r.ok) throw new Error(String(r.status));
    emit({ env: (await r.json()) as EnvView, envError: false });
  } catch {
    emit({ envError: true });
  }
}

function loop(my: number) {
  timer = setTimeout(async () => {
    await refreshLauncher();
    if (my === gen && listeners.size > 0) loop(my);
  }, isRunning(snap) ? 2000 : 4000);
}

function subscribe(l: () => void) {
  listeners.add(l);
  if (!timer) { gen++; refreshLauncher(); loop(gen); }
  return () => {
    listeners.delete(l);
    if (listeners.size === 0 && timer) { clearTimeout(timer); timer = null; gen++; }
  };
}

export function useLauncher(): LauncherSnapshot {
  return useSyncExternalStore(subscribe, () => snap, () => snap);
}

export function setLauncherMessage(message: LauncherSnapshot["message"]) {
  emit({ message });
}

/** Starts a pipeline run. Returns true when the server accepted it. */
export async function launchPipeline(prompt: string, opts: { autoApprove: boolean; openGui: boolean }): Promise<boolean> {
  if (snap.busy || isRunning(snap)) return false;
  emit({ busy: true, message: null });
  try {
    const r = await fetch("/api/pixel-agents/silicon-launch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, ...opts }),
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) {
      emit({ message: { kind: "error", text: d.error ?? `Error ${r.status}` } });
      return false;
    }
    emit({
      message: { kind: "ok", text: "Pipeline lanzado. Siguiendo el run en vivo…" },
      env: snap.env ? { ...snap.env, launcher: d.launcher } : snap.env,
    });
    // Jump to the live view (drops ?run / ?replay) so the stream follows the new run.
    const q = new URLSearchParams(window.location.search);
    if (q.has("run") || q.has("replay") || q.has("loop")) {
      ["run", "replay", "loop", "speed"].forEach((k) => q.delete(k));
      const qs = q.toString();
      window.location.search = qs ? `?${qs}` : "";
    }
    return true;
  } catch (e) {
    emit({ message: { kind: "error", text: `No se pudo contactar al servidor: ${(e as Error).message}` } });
    return false;
  } finally {
    emit({ busy: false });
    refreshLauncher();
  }
}

export async function stopPipeline() {
  emit({ busy: true });
  try {
    await fetch("/api/pixel-agents/silicon-launch", { method: "DELETE" });
    emit({ message: { kind: "ok", text: "Pipeline detenido." } });
  } finally {
    emit({ busy: false });
    refreshLauncher();
  }
}
