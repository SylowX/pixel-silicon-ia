// ─── SiliconIA launcher ───────────────────────────────────────────────────────
//
// Lets the web UI start a pipeline run from a natural-language prompt.
// It does exactly what a user would do in a terminal:
//
//   powershell -File SiliconIA/run_pipeline.ps1 -PromptFile prompt-<ts>.md [-AutoApprove] [-NoGUI]
//
// GET    → environment status (Docker engine / image / container) + launcher state
// POST   → start a run   { prompt, autoApprove?, openGui? }
// DELETE → stop the run (docker stop + kill the launcher process tree)
//
// SECURITY: this endpoint executes a local command, so it only answers to
// same-origin JSON requests addressed to a loopback host. Bind the dev server
// to loopback as well:  next dev -p 3031 -H 127.0.0.1
//
// No shell is ever involved: the prompt is written to a file and the command
// is spawned with an argv array.

import { execFile, spawn } from "child_process";
import fs from "fs";
import path from "path";
import { localOnlyGuard as guard, stripAnsi } from "@/lib/localGuard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const IMAGE = "siliconia-pipeline:latest";
const CONTAINER = "siliconia";
const WORKSPACE = path.resolve(process.env.SILICONIA_WORKSPACE ?? path.join(process.cwd(), "SiliconIA"));
const SCRIPT = path.join(WORKSPACE, "run_pipeline.ps1");
const LOG_DIR = path.join(WORKSPACE, ".launcher-logs");
const MAX_PROMPT = 6000;

interface LauncherState {
  running: boolean;
  pid: number | null;
  startedAt: number | null;
  exitCode: number | null;
  promptFile: string | null;
  logFile: string | null;
  prompt: string | null;
}

interface Globals {
  __siliconLauncher?: LauncherState;
  __siliconEnvCache?: { at: number; value: EnvStatus };
}
const g = globalThis as unknown as Globals;
const launcher: LauncherState = (g.__siliconLauncher ??= {
  running: false, pid: null, startedAt: null, exitCode: null, promptFile: null, logFile: null, prompt: null,
});

interface EnvStatus { docker: boolean; dockerVersion: string | null; image: boolean; containerRunning: boolean }

// ─── helpers ──────────────────────────────────────────────────────────────────

function run(cmd: string, args: string[], timeout = 4000): Promise<{ ok: boolean; out: string }> {
  return new Promise((resolve) => {
    execFile(cmd, args, { timeout, windowsHide: true }, (err, stdout) => {
      resolve({ ok: !err, out: String(stdout ?? "").trim() });
    });
  });
}

async function envStatus(force = false): Promise<EnvStatus> {
  const cached = g.__siliconEnvCache;
  if (!force && cached && Date.now() - cached.at < 4000) return cached.value;
  const ver = await run("docker", ["version", "--format", "{{.Server.Version}}"]);
  let value: EnvStatus = { docker: false, dockerVersion: null, image: false, containerRunning: false };
  if (ver.ok && ver.out) {
    const [img, ps] = await Promise.all([
      run("docker", ["images", "-q", IMAGE]),
      run("docker", ["ps", "-q", "--filter", `name=^/${CONTAINER}$`]),
    ]);
    value = { docker: true, dockerVersion: ver.out, image: img.ok && img.out.length > 0, containerRunning: ps.ok && ps.out.length > 0 };
  }
  g.__siliconEnvCache = { at: Date.now(), value };
  return value;
}

function logTail(max = 6000): string {
  if (!launcher.logFile) return "";
  try {
    const st = fs.statSync(launcher.logFile);
    const fd = fs.openSync(launcher.logFile, "r");
    try {
      const len = Math.min(st.size, max * 2);
      const buf = Buffer.alloc(len);
      fs.readSync(fd, buf, 0, len, st.size - len);
      // PowerShell may write UTF-16; fall back if NULs show up.
      const text = buf.includes(0) ? buf.toString("utf16le") : buf.toString("utf8");
      return stripAnsi(text).slice(-max);
    } finally {
      fs.closeSync(fd);
    }
  } catch {
    return "";
  }
}

/** Run directory created by the current/last launch (newest dir in silicon-runs started after launch). */
function launchedRunId(): string | null {
  if (!launcher.startedAt) return null;
  const runsDir = path.join(WORKSPACE, "silicon-runs");
  try {
    const since = launcher.startedAt * 1000 - 5000;
    const hit = fs.readdirSync(runsDir, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => ({ id: d.name, t: fs.statSync(path.join(runsDir, d.name)).birthtimeMs }))
      .filter((r) => r.t >= since)
      .sort((a, b) => b.t - a.t)[0];
    return hit?.id ?? null;
  } catch {
    return null;
  }
}

function launcherView() {
  return {
    running: launcher.running,
    pid: launcher.pid,
    startedAt: launcher.startedAt,
    exitCode: launcher.exitCode,
    prompt: launcher.prompt,
    runId: launchedRunId(),
    logTail: logTail(),
  };
}

function sanitizePrompt(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  // eslint-disable-next-line no-control-regex
  const s = raw.replace(/\r\n/g, "\n").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "").trim();
  if (s.length < 5 || s.length > MAX_PROMPT) return null;
  return s;
}

// ─── handlers ─────────────────────────────────────────────────────────────────

export async function GET(req: Request) {
  const denied = guard(req, false);
  if (denied) return denied;
  const env = await envStatus();
  return Response.json({
    ...env,
    scriptFound: fs.existsSync(SCRIPT),
    launcher: launcherView(),
  });
}

export async function POST(req: Request) {
  const denied = guard(req, true);
  if (denied) return denied;

  let body: { prompt?: unknown; autoApprove?: unknown; openGui?: unknown };
  try { body = await req.json(); } catch { return Response.json({ error: "JSON inválido" }, { status: 400 }); }

  const prompt = sanitizePrompt(body.prompt);
  if (!prompt) {
    return Response.json({ error: `Describe el circuito (5–${MAX_PROMPT} caracteres).` }, { status: 400 });
  }
  if (!fs.existsSync(SCRIPT)) {
    return Response.json({ error: `No se encontró run_pipeline.ps1 en ${WORKSPACE}` }, { status: 500 });
  }
  if (launcher.running) {
    return Response.json({ error: "Ya hay un pipeline ejecutándose." }, { status: 409 });
  }

  const env = await envStatus(true);
  if (!env.docker) {
    return Response.json({ error: "Docker no está disponible. Abre Docker Desktop y espera a que el motor inicie." }, { status: 503 });
  }
  if (!env.image) {
    return Response.json({
      error: `Falta la imagen ${IMAGE}. Constrúyela una vez con: .\\run_pipeline.ps1 -Build (30–60 min).`,
    }, { status: 412 });
  }
  if (env.containerRunning) {
    return Response.json({ error: "Hay un contenedor 'siliconia' en ejecución (otro run)." }, { status: 409 });
  }

  const stamp = new Date().toISOString().replace(/[-:T.Z]/g, "").slice(0, 14);
  const promptFile = path.join(WORKSPACE, `prompt-${stamp}.md`);
  fs.mkdirSync(LOG_DIR, { recursive: true });
  const logFile = path.join(LOG_DIR, `launch-${stamp}.log`);
  fs.writeFileSync(promptFile, prompt + "\n", "utf8");

  // NOTE: do NOT use `detached: true` here — on Windows it starts PowerShell
  // without a console and it exits 0 immediately without running the script.
  // -Command (instead of -File) lets us force a UTF-8 console so Docker/Python
  // output is legible in the log. Only server-controlled paths are interpolated
  // (single-quoted, '' escaped); the user prompt travels in the file.
  const psq = (s: string) => `'${s.replace(/'/g, "''")}'`;
  let invoke = `& ${psq(SCRIPT)} -PromptFile ${psq(promptFile)}`;
  if (body.autoApprove !== false) invoke += " -AutoApprove";
  if (body.openGui !== true) invoke += " -NoGUI";
  const command =
    "[Console]::OutputEncoding=[System.Text.Encoding]::UTF8; $OutputEncoding=[System.Text.Encoding]::UTF8; " +
    `${invoke}; exit $LASTEXITCODE`;
  const args = ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", command];

  const fd = fs.openSync(logFile, "a");
  let child;
  try {
    child = spawn("powershell.exe", args, {
      cwd: WORKSPACE, windowsHide: true, stdio: ["ignore", fd, fd],
      env: { ...process.env, PYTHONIOENCODING: "utf-8" },
    });
  } catch (e) {
    fs.closeSync(fd);
    try { fs.unlinkSync(promptFile); } catch { /* ignore */ }
    return Response.json({ error: `No se pudo lanzar el pipeline: ${(e as Error).message}` }, { status: 500 });
  }
  fs.closeSync(fd);

  Object.assign(launcher, {
    running: true, pid: child.pid ?? null, startedAt: Date.now() / 1000, exitCode: null,
    promptFile, logFile, prompt,
  });
  const done = (code: number | null) => {
    launcher.running = false;
    launcher.exitCode = code;
    launcher.pid = null;
    g.__siliconEnvCache = undefined;
    try { fs.unlinkSync(promptFile); } catch { /* already gone */ }
  };
  child.on("exit", (code) => done(code));
  child.on("error", () => done(-1));
  child.unref();

  return Response.json({ ok: true, launcher: launcherView() }, { status: 202 });
}

export async function DELETE(req: Request) {
  const denied = guard(req, false);
  if (denied) return denied;
  const pid = launcher.pid;
  await run("docker", ["stop", CONTAINER], 20000);
  if (pid) await run("taskkill", ["/T", "/F", "/PID", String(pid)], 8000);
  g.__siliconEnvCache = undefined;
  return Response.json({ ok: true, launcher: launcherView() });
}
