// ─── OpenROAD GUI launcher ────────────────────────────────────────────────────
//
// Opens the physical layout of a finished SiliconIA run in the OpenROAD GUI.
// Runs the same image as the pipeline, displayed through WSLg (the Windows
// X server shipped with WSL2), exactly like `run_pipeline.ps1 -ShowGUI`, but:
//   · one container per run (`siliconia-gui-<run>`), so it never collides with
//     a pipeline that is running (`siliconia`) and several layouts can be open;
//   · no ports published.
//
// GET    → { wslg, guis: [{ runId, running, startedAt, exitCode, error }] }
// POST   → { runId }  open the GUI for that run
// DELETE → ?runId=…   close it (docker stop)
//
// SECURITY: executes local commands → same loopback/same-origin guard as the
// pipeline launcher. runId is validated against the run-id regex and must be an
// existing run with a layout database; nothing user-provided reaches a shell
// except the validated runId.

import { execFile, spawn } from "child_process";
import fs from "fs";
import path from "path";
import { localOnlyGuard as guard, stripAnsi } from "@/lib/localGuard";
import { RUNS_DIR, findRunOdb, isValidRunId } from "@/lib/siliconia";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const IMAGE = "siliconia-pipeline:latest";
const PREFIX = "siliconia-gui-";
const OPENROAD_EXE = "/OpenROAD-flow-scripts/tools/install/OpenROAD/bin/openroad";
const WORKSPACE = path.resolve(process.env.SILICONIA_WORKSPACE ?? path.join(process.cwd(), "SiliconIA"));
const LOG_DIR = path.join(WORKSPACE, ".launcher-logs");
const MAX_OPEN = 4;

interface GuiState {
  runId: string;
  pid: number | null;
  running: boolean;
  startedAt: number;
  exitCode: number | null;
  logFile: string;
  odb: string;
  /** closed from the web UI (docker stop) → non-zero exit is expected, not an error */
  closedByUser?: boolean;
}

const g = globalThis as unknown as { __siliconGuis?: Map<string, GuiState> };
const guis: Map<string, GuiState> = (g.__siliconGuis ??= new Map());

function run(cmd: string, args: string[], timeout = 5000): Promise<{ ok: boolean; out: string }> {
  return new Promise((resolve) => {
    execFile(cmd, args, { timeout, windowsHide: true }, (err, stdout) => {
      resolve({ ok: !err, out: String(stdout ?? "").trim() });
    });
  });
}

/** WSLg X11 socket + runtime mounts (same detection as run_pipeline.ps1). */
function wslgMounts(): { x11: string; mnt: string } | null {
  const distro = process.env.SILICONIA_WSL_DISTRO ?? "Ubuntu";
  for (const root of [`\\\\wsl.localhost\\${distro}`, `\\\\wsl$\\${distro}`]) {
    const x11 = `${root}\\tmp\\.X11-unix`;
    try {
      if (fs.existsSync(x11)) return { x11, mnt: `${root}\\mnt\\wslg` };
    } catch { /* not reachable */ }
  }
  return null;
}

function tail(file: string, max = 1200): string {
  try {
    const t = fs.readFileSync(file, "utf8");
    return stripAnsi(t).trim().slice(-max);
  } catch {
    return "";
  }
}

function view(s: GuiState) {
  return {
    runId: s.runId,
    running: s.running,
    startedAt: s.startedAt,
    exitCode: s.exitCode,
    odb: s.odb,
    error: !s.running && !s.closedByUser && s.exitCode !== null && s.exitCode !== 0 && s.exitCode !== 143 ? tail(s.logFile) : null,
  };
}

/** Containers that are actually up (survives dev-server restarts / HMR). */
async function liveContainers(): Promise<Set<string>> {
  const ps = await run("docker", ["ps", "--format", "{{.Names}}", "--filter", `name=^/${PREFIX}`]);
  return new Set(ps.ok ? ps.out.split(/\r?\n/).filter(Boolean).map((n) => n.slice(PREFIX.length)) : []);
}

async function snapshot() {
  const live = await liveContainers();
  for (const id of live) {
    if (!guis.has(id)) {
      guis.set(id, { runId: id, pid: null, running: true, startedAt: Date.now() / 1000, exitCode: null, logFile: "", odb: "" });
    }
  }
  for (const s of guis.values()) {
    if (s.running && s.pid === null && !live.has(s.runId)) { s.running = false; s.exitCode = 0; }
  }
  return [...guis.values()].map(view);
}

export async function GET(req: Request) {
  const denied = guard(req, false);
  if (denied) return denied;
  return Response.json({ wslg: wslgMounts() !== null, guis: await snapshot() });
}

export async function POST(req: Request) {
  const denied = guard(req, true);
  if (denied) return denied;

  let body: { runId?: unknown };
  try { body = await req.json(); } catch { return Response.json({ error: "JSON inválido" }, { status: 400 }); }
  const runId = typeof body.runId === "string" ? body.runId : "";
  if (!isValidRunId(runId) || !fs.existsSync(path.join(RUNS_DIR, runId))) {
    return Response.json({ error: "Run inválido" }, { status: 400 });
  }
  const odb = findRunOdb(runId);
  if (!odb) {
    return Response.json({ error: "Este run no tiene layout (.odb): el flujo físico no llegó a generarlo." }, { status: 404 });
  }

  await snapshot();
  const existing = guis.get(runId);
  if (existing?.running) {
    return Response.json({ ok: true, already: true, gui: view(existing) });
  }
  if ([...guis.values()].filter((s) => s.running).length >= MAX_OPEN) {
    return Response.json({ error: `Ya hay ${MAX_OPEN} ventanas de OpenROAD abiertas; cierra alguna.` }, { status: 409 });
  }

  const wslg = wslgMounts();
  if (!wslg) {
    return Response.json({
      error: "No se detectó WSLg (\\\\wsl.localhost\\Ubuntu\\tmp\\.X11-unix). Inicia la distro Ubuntu de WSL2 o define SILICONIA_WSL_DISTRO.",
    }, { status: 503 });
  }
  const ver = await run("docker", ["version", "--format", "{{.Server.Version}}"]);
  if (!ver.ok) {
    return Response.json({ error: "Docker no está disponible. Abre Docker Desktop." }, { status: 503 });
  }

  // TCL loader next to the database (same approach as OpenROADGUIPhase.open_gui).
  const containerOdb = `/workspace/silicon-runs/${runId}/outputs/${odb.file}`;
  const tclName = "open_gui_web.tcl";
  fs.writeFileSync(
    path.join(path.dirname(odb.hostPath), tclName),
    `# SiliconIA — OpenROAD GUI (lanzado desde el visualizador web)\nread_db ${containerOdb}\n`,
    "utf8",
  );

  fs.mkdirSync(LOG_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[-:T.Z]/g, "").slice(0, 14);
  const logFile = path.join(LOG_DIR, `gui-${runId}-${stamp}.log`);
  const name = `${PREFIX}${runId}`;
  await run("docker", ["rm", "-f", name]); // stale container with the same name, if any

  const args = [
    "run", "--rm", "--name", name,
    "-v", `${RUNS_DIR}:/workspace/silicon-runs`,
    "-e", "DISPLAY=:0",
    "-e", "QT_QPA_PLATFORM=xcb",
    "-e", `OPENROAD_EXE=${OPENROAD_EXE}`,
    "-v", `${wslg.x11}:/tmp/.X11-unix`,
    "-v", `${wslg.mnt}:/mnt/wslg`,
    IMAGE,
    "-c", `exec "\${OPENROAD_EXE:-openroad}" -gui /workspace/silicon-runs/${runId}/outputs/${tclName}`,
  ];

  const fd = fs.openSync(logFile, "a");
  let child;
  try {
    child = spawn("docker", args, { windowsHide: true, stdio: ["ignore", fd, fd] });
  } catch (e) {
    fs.closeSync(fd);
    return Response.json({ error: `No se pudo lanzar Docker: ${(e as Error).message}` }, { status: 500 });
  }
  fs.closeSync(fd);

  const state: GuiState = {
    runId, pid: child.pid ?? null, running: true, startedAt: Date.now() / 1000, exitCode: null, logFile, odb: odb.file,
  };
  guis.set(runId, state);
  child.on("exit", (code) => { state.running = false; state.exitCode = code ?? -1; state.pid = null; });
  child.on("error", () => { state.running = false; state.exitCode = -1; state.pid = null; });

  // Catch immediate failures (bad mount, missing image, X11 refused…) so the
  // user gets the reason right away instead of a silent nothing.
  await new Promise((r) => setTimeout(r, 3000));
  if (!state.running && state.exitCode !== 0) {
    return Response.json({ error: `OpenROAD GUI no pudo abrir (código ${state.exitCode}).`, detail: tail(logFile, 800) }, { status: 500 });
  }
  return Response.json({ ok: true, gui: view(state) }, { status: 202 });
}

export async function DELETE(req: Request) {
  const denied = guard(req, false);
  if (denied) return denied;
  const runId = new URL(req.url).searchParams.get("runId") ?? "";
  if (!isValidRunId(runId)) return Response.json({ error: "Run inválido" }, { status: 400 });
  const s = guis.get(runId);
  if (s) s.closedByUser = true;
  await run("docker", ["stop", "-t", "2", `${PREFIX}${runId}`], 15000);
  if (s) { s.running = false; s.exitCode = s.exitCode ?? 0; }
  return Response.json({ ok: true });
}
