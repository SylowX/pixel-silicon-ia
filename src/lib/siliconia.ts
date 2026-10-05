// ─── SiliconIA adapter (server-only) ──────────────────────────────────────────
//
// Turns SiliconIA pipeline telemetry into pixel-agents events.
//
// Sources per run directory (<SILICONIA_RUNS_DIR>/<run_id>/):
//   .coresmith/pipeline_events.jsonl  ← CoreSmith LangGraph (nodes + LLM calls)
//   siliconia_events.jsonl            ← silicon_pipeline.py (phases, ORFS stages)
//   pipeline_report.json              ← final report (used to synthesize a replay
//                                        for runs recorded before telemetry existed)
//
// Both JSONL files share the record shape {ts, iso, pid, event, node, ...} and
// are merged by `ts`.
//
// The 6 desks map to the 6 roles of the chip design team:
//   0 supervisor · 1 architect · 2 rtl · 3 dv · 4 synth · 5 pnr

import fs from "fs";
import path from "path";
import type { AgentUpdateEvent, MultiAgentState } from "@/app/api/pixel-agents/agents-stream/route";

export const RUNS_DIR = path.resolve(
  process.env.SILICONIA_RUNS_DIR ?? path.join(process.cwd(), "SiliconIA", "silicon-runs"),
);
const CORESMITH_EVENTS = path.join(".coresmith", "pipeline_events.jsonl");
const SILICON_EVENTS = "siliconia_events.jsonl";
const CURRENT_FILE = "current_run.json";
const REPORT_FILE = "pipeline_report.json";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RawEvent {
  ts: number;
  event: string;
  node?: string;
  [key: string]: unknown;
}

export type SiliconRole = "supervisor" | "architect" | "rtl" | "dv" | "synth" | "pnr";

export const ROLE_INFO: Record<SiliconRole, { seat: number; label: string }> = {
  supervisor: { seat: 0, label: "supervisor" },
  architect:  { seat: 1, label: "architect" },
  rtl:        { seat: 2, label: "rtl-coder" },
  dv:         { seat: 3, label: "verifier" },
  synth:      { seat: 4, label: "synthesis" },
  pnr:        { seat: 5, label: "pnr" },
};

export const PIPELINE_STAGES = [
  "pdk", "spec", "rtl", "verify", "logic_synth",
  "floorplan", "place", "cts", "route", "finish",
] as const;
export type PipelineStage = (typeof PIPELINE_STAGES)[number];
export type StageStatus = "pending" | "running" | "ok" | "error" | "skipped";

export type StepState = "pending" | "running" | "done" | "failed" | "skipped";

export interface TaskStep {
  id: string;
  label: string;
  state: StepState;
  /** 0..1 — completed share of this step (per-block steps advance block by block) */
  frac: number;
  attempts: number;
  optional: boolean;
  /** extra steps (e.g. diagnosis) are shown but never counted in the percentage */
  extra: boolean;
  counted: boolean;
}

export interface AgentTask {
  role: SiliconRole;
  title: string;
  steps: TaskStep[];
  /** 0..100 — completed steps / counted steps (not time-based) */
  pct: number;
  doneSteps: number;
  totalSteps: number;
  status: "idle" | "working" | "done" | "blocked" | "skipped";
  current: string | null;
  currentSince: number | null;
}

export interface FeedItem {
  ts: number;
  role: SiliconRole;
  text: string;
  kind: "info" | "ok" | "error" | "warn";
}

export interface PipelineStatus {
  runId: string;
  prompt: string;
  mode: "live" | "replay";
  synthetic: boolean;
  status: "idle" | "running" | "done" | "error";
  phase: string | null;
  design: string | null;
  stages: Record<PipelineStage, StageStatus>;
  metrics: Record<string, number>;
  lastEvent: string | null;
  updatedTs: number;
  startedTs: number | null;
  blocks: string[];
  /** 0..100 — finished pipeline stages / 10 */
  progress: number;
  tasks: Record<SiliconRole, AgentTask>;
  feed: FeedItem[];
}

interface StepDef { id: string; label: string; perBlock?: boolean; optional?: boolean; extra?: boolean }

/** What each role is responsible for, as the checklist the board tracks. */
export const TASK_DEFS: Record<SiliconRole, { title: string; steps: StepDef[] }> = {
  supervisor: {
    title: "Orquestar el pipeline prompt → GDSII",
    steps: [
      { id: "pdk", label: "PDK Sky130" },
      { id: "req", label: "Requisitos y bloques" },
      { id: "frontend", label: "Frontend CoreSmith" },
      { id: "orfs", label: "Flujo físico" },
      { id: "report", label: "Reporte final" },
    ],
  },
  architect: {
    title: "Especificar la microarquitectura",
    steps: [
      { id: "arch", label: "PRD / arquitectura", optional: true },
      { id: "spec", label: "Spec de uarch", perBlock: true },
      { id: "review", label: "Revisión de spec", perBlock: true },
    ],
  },
  rtl: {
    title: "Escribir el RTL Verilog",
    steps: [
      { id: "rtl", label: "Generar RTL + lint", perBlock: true },
      { id: "diag", label: "Diagnóstico de fallas", extra: true },
    ],
  },
  dv: {
    title: "Verificar con cocotb",
    steps: [
      { id: "tb", label: "Testbench", perBlock: true },
      { id: "val", label: "Validación / integración", optional: true },
    ],
  },
  synth: {
    title: "Sintetizar a celdas sky130",
    steps: [
      { id: "ysynth", label: "Yosys por bloque", perBlock: true },
      { id: "orfs_synth", label: "Síntesis ORFS" },
    ],
  },
  pnr: {
    title: "Implementar el layout físico",
    steps: [
      { id: "cfg", label: "config.mk" },
      { id: "floorplan", label: "Floorplan" },
      { id: "place", label: "Placement" },
      { id: "cts", label: "CTS" },
      { id: "route", label: "Routing" },
      { id: "finish", label: "GDSII" },
    ],
  },
};

const ROLES = Object.keys(TASK_DEFS) as SiliconRole[];

export interface RunInfo {
  id: string;
  prompt: string;
  mtimeMs: number;
  hasEvents: boolean;
  hasReport: boolean;
  success: boolean | null;
  /** top module from the ORFS phase (null if the flow never got there) */
  design: string | null;
  /** when the run finished (report timestamp) or last changed, epoch ms */
  finishedMs: number | null;
  metrics: Record<string, number>;
  /** final layout database available → can be opened in the OpenROAD GUI */
  hasOdb: boolean;
  failedPhase: string | null;
}

// ─── Run discovery ────────────────────────────────────────────────────────────

const RUN_ID_RE = /^[\w.\-]+$/;

export function isValidRunId(id: string): boolean {
  return RUN_ID_RE.test(id) && id !== "." && id !== "..";
}

export function runDir(id: string): string {
  return path.join(RUNS_DIR, id);
}

function readText(p: string): string | null {
  try { return fs.readFileSync(p, "utf8"); } catch { return null; }
}

function readJson<T = Record<string, unknown>>(p: string): T | null {
  const t = readText(p);
  if (t === null) return null;
  try { return JSON.parse(t) as T; } catch { return null; }
}

function mtime(p: string): number {
  try { return fs.statSync(p).mtimeMs; } catch { return 0; }
}

export function eventFiles(dir: string): string[] {
  return [path.join(dir, CORESMITH_EVENTS), path.join(dir, SILICON_EVENTS)];
}

interface ReportShape {
  timestamp?: string;
  prompt?: string;
  run_dir?: string;
  phases?: {
    pdk?: { success?: boolean };
    coresmith?: { success?: boolean; netlist?: string | null; rtl_files?: string[] };
    orfs?: {
      success?: boolean;
      design_name?: string;
      flow_results?: Record<string, { success?: boolean }>;
      outputs?: Record<string, string>;
      metrics?: Record<string, number>;
    };
  };
}

/** Layout databases in preference order (final first). */
const ODB_CANDIDATES = ["6_final.odb", "5_route.odb", "4_cts.odb", "3_place.odb", "2_floorplan.odb", "1_synth.odb"];

/** Best layout database of a run: { host path, file name } or null. */
export function findRunOdb(id: string): { hostPath: string; file: string } | null {
  if (!isValidRunId(id)) return null;
  const out = path.join(runDir(id), "outputs");
  for (const f of ODB_CANDIDATES) {
    const p = path.join(out, f);
    if (fs.existsSync(p)) return { hostPath: p, file: f };
  }
  return null;
}

function runInfo(id: string): RunInfo | null {
  const dir = runDir(id);
  const files = eventFiles(dir);
  const reportPath = path.join(dir, REPORT_FILE);
  const report = readJson<ReportShape>(reportPath);
  const prompt = (readText(path.join(dir, "prompt.txt")) ?? report?.prompt ?? "").trim();
  const ph = report?.phases;
  const success = report
    ? Boolean(ph?.pdk?.success && ph?.coresmith?.success && ph?.orfs?.success)
    : null;
  const failedPhase = report && !success
    ? (ph?.pdk?.success === false ? "pdk" : ph?.coresmith?.success === false ? "coresmith" : ph?.orfs ? "orfs" : "coresmith")
    : null;
  const finished = report?.timestamp ? Date.parse(report.timestamp) : NaN;
  const metrics: Record<string, number> = {};
  for (const [k, v] of Object.entries(ph?.orfs?.metrics ?? {})) if (typeof v === "number") metrics[k] = v;
  const mtimeMs = Math.max(mtime(dir), ...files.map(mtime), mtime(reportPath));
  return {
    id,
    prompt,
    mtimeMs,
    hasEvents: files.some((f) => fs.existsSync(f)),
    hasReport: report !== null,
    success,
    design: ph?.orfs?.design_name ?? null,
    finishedMs: Number.isFinite(finished) ? finished : report ? mtimeMs : null,
    metrics,
    hasOdb: findRunOdb(id) !== null,
    failedPhase,
  };
}

export function listRuns(): RunInfo[] {
  try {
    return fs
      .readdirSync(RUNS_DIR, { withFileTypes: true })
      .filter((d) => d.isDirectory() && d.name !== "current" && isValidRunId(d.name))
      .map((d) => runInfo(d.name))
      .filter((r): r is RunInfo => r !== null)
      .sort((a, b) => b.mtimeMs - a.mtimeMs);
  } catch {
    return [];
  }
}

export function readCurrentRun(): { run_id?: string; status?: string; phase?: string | null } | null {
  return readJson(path.join(RUNS_DIR, CURRENT_FILE));
}

/** Requested run if valid; otherwise the run in current_run.json; otherwise the newest run. */
export function resolveRunId(requested?: string | null): string | null {
  if (requested) {
    return isValidRunId(requested) && fs.existsSync(runDir(requested)) ? requested : null;
  }
  const cur = readCurrentRun()?.run_id;
  if (cur && isValidRunId(cur) && fs.existsSync(runDir(cur))) return cur;
  return listRuns()[0]?.id ?? null;
}

// ─── JSONL reading ────────────────────────────────────────────────────────────

function parseLines(text: string): RawEvent[] {
  const out: RawEvent[] = [];
  for (const line of text.split("\n")) {
    const s = line.trim();
    if (!s) continue;
    try {
      const d = JSON.parse(s);
      if (d && typeof d.ts === "number" && typeof d.event === "string") out.push(d as RawEvent);
    } catch { /* malformed line */ }
  }
  return out;
}

/** Incremental reader: returns only complete new lines; safe across UTF-8 boundaries and truncation. */
export class JsonlTailer {
  private offset = 0;
  private partial: Buffer = Buffer.alloc(0);

  constructor(public readonly file: string) {}

  readNew(): RawEvent[] {
    let size: number;
    try { size = fs.statSync(this.file).size; } catch { return []; }
    if (size < this.offset) { this.offset = 0; this.partial = Buffer.alloc(0); }
    if (size === this.offset) return [];
    let chunk: Buffer;
    try {
      const fd = fs.openSync(this.file, "r");
      try {
        chunk = Buffer.alloc(size - this.offset);
        fs.readSync(fd, chunk, 0, chunk.length, this.offset);
      } finally {
        fs.closeSync(fd);
      }
    } catch { return []; }
    this.offset = size;
    const buf = Buffer.concat([this.partial, chunk]);
    const lastNl = buf.lastIndexOf(0x0a);
    if (lastNl === -1) { this.partial = buf; return []; }
    this.partial = buf.subarray(lastNl + 1);
    return parseLines(buf.subarray(0, lastNl).toString("utf8"));
  }
}

export function sortEvents(events: RawEvent[]): RawEvent[] {
  return events
    .map((e, i) => ({ e, i }))
    .sort((a, b) => a.e.ts - b.e.ts || a.i - b.i)
    .map(({ e }) => e);
}

// ─── ORFS metrics (mirror of parse_orfs_metrics in silicon_pipeline.py) ───────

export function parseOrfsMetrics(files: string[]): Record<string, number> {
  const m: Record<string, number> = {};
  for (const f of files) {
    const text = readText(f);
    if (!text) continue;
    for (const hit of text.matchAll(/Design area\s+([\d.]+)\s+um?\^2\s+([\d.]+)%\s+utilization/g)) {
      m.design_area_um2 = parseFloat(hit[1]);
      m.utilization_pct = parseFloat(hit[2]);
    }
    const pw = text.match(/Total power\s*:\s*([\d.eE+\-]+)\s*W/);
    if (pw) m.total_power_w = parseFloat(pw[1]);
    const tot = text.match(/^\s*Total\s+(\d+)\s+([\d.]+)\s*$/m);
    if (tot) { m.cell_count = parseInt(tot[1], 10); m.cell_area_um2 = parseFloat(tot[2]); }
    for (const kind of ["tns", "wns"]) {
      const hits = [...text.matchAll(new RegExp(`^\\s*${kind}(?:\\s+max)?\\s+(-?\\d+(?:\\.\\d+)?)\\s*$`, "gm"))];
      if (hits.length) m[kind] = parseFloat(hits[hits.length - 1][1]);
    }
  }
  return m;
}

function parseElapsed(file: string): number | null {
  const text = readText(file);
  const hit = text?.match(/Elapsed time:\s*([\d:.]+)/);
  if (!hit) return null;
  const secs = hit[1].split(":").reduce((acc, p) => acc * 60 + parseFloat(p), 0);
  return Number.isFinite(secs) ? Math.round(secs * 100) / 100 : null;
}

// ─── Synthetic timeline for runs without telemetry ────────────────────────────

const ORFS_ORDER = ["synth", "floorplan", "place", "cts", "route", "finish"];
const ORFS_STAGE_LOG: Record<string, string> = {
  floorplan: "2_1_floorplan.log",
  place: "3_5_place_dp.log",
  cts: "4_1_cts.log",
  route: "5_2_route.log",
  finish: "6_report.log",
};

/** Rebuilds a plausible event timeline from pipeline_report.json + output logs. */
export function synthesizeFromReport(dir: string): RawEvent[] {
  const report = readJson<ReportShape>(path.join(dir, REPORT_FILE));
  if (!report) return [];
  const ph = report.phases ?? {};
  const prompt = (report.prompt ?? readText(path.join(dir, "prompt.txt")) ?? "").trim();
  const out: RawEvent[] = [];
  let t = 0;
  const push = (event: string, node: string, data: Record<string, unknown> = {}, dt = 2.5) => {
    t += dt;
    out.push({ ts: t, event, node, source: "siliconia", synthetic: true, ...data });
  };

  push("silicon_pipeline_start", "Supervisor", { run_id: path.basename(dir), prompt }, 0);
  push("silicon_phase_enter", "Supervisor", { phase: "pdk" }, 1.5);
  const pdkOk = ph.pdk?.success !== false;
  push("silicon_phase_exit", "Supervisor", { phase: "pdk", status: pdkOk ? "ok" : "error" }, 3);

  const cs = ph.coresmith ?? {};
  const rtl = cs.rtl_files ?? [];
  const runDirStr = String(report.run_dir ?? "");
  const skipped = !cs.netlist && rtl.length > 0 && rtl.every((f) => !runDirStr || !String(f).startsWith(runDirStr));
  if (pdkOk) {
    push("silicon_phase_enter", "Supervisor", { phase: "coresmith", skipped }, 2);
    if (!skipped) {
      const nodes: [string, number][] = [
        ["Generate Uarch Spec", 6], ["Review Uarch Spec", 3], ["Generate RTL", 8],
        ["Generate Testbench", 6], ["Validation DV", 5], ["Synthesize", 5],
      ];
      for (const [node, dur] of nodes) {
        push("graph_node_enter", node, {}, 1.5);
        push("graph_node_exit", node, { status: "ok" }, dur);
      }
    }
    push("silicon_phase_exit", "Supervisor", {
      phase: "coresmith", status: cs.success === false ? "error" : "ok", skipped, rtl_files: rtl.length,
    }, 2);
  }

  const orfs = ph.orfs;
  if (pdkOk && cs.success !== false && orfs) {
    const design = orfs.design_name ?? null;
    push("silicon_phase_enter", "Supervisor", { phase: "orfs" }, 2);
    push("silicon_step", "Supervisor", { step: "design_detected", design }, 1.5);
    push("silicon_step", "Supervisor", { step: "orfs_config_generated", design }, 2);
    const fr = orfs.flow_results ?? {};
    const stages = ORFS_ORDER.filter((s) => s in fr);
    const outDir = path.join(dir, "outputs");
    stages.forEach((stage, i) => {
      const ok = fr[stage]?.success !== false;
      const logFile = ORFS_STAGE_LOG[stage];
      const real = logFile ? parseElapsed(path.join(outDir, logFile)) : null;
      push("silicon_stage_enter", `ORFS ${stage}`, { phase: "orfs", stage, index: i, total: stages.length, design }, 2);
      push("silicon_stage_exit", `ORFS ${stage}`, {
        phase: "orfs", stage, index: i, total: stages.length,
        status: ok ? "ok" : "error", duration_s: real,
      }, Math.min(9, Math.max(4, real ?? 5)));
    });
    const metrics = parseOrfsMetrics(Object.values(ORFS_STAGE_LOG).map((f) => path.join(outDir, f)));
    if (Object.keys(metrics).length) push("silicon_metrics", "Supervisor", { design, ...metrics }, 1.5);
    push("silicon_phase_exit", "Supervisor", { phase: "orfs", status: orfs.success ? "ok" : "error", design }, 2);
  }

  const success = Boolean(ph.pdk?.success && cs.success && orfs?.success);
  push("silicon_pipeline_end", "Supervisor", {
    success,
    failed_phase: success ? null : (!pdkOk ? "pdk" : cs.success === false ? "coresmith" : "orfs"),
    design: orfs?.design_name ?? null,
  }, 3);

  // Anchor the timeline so it ends at the report timestamp.
  const end = report.timestamp ? Date.parse(report.timestamp) / 1000 : Date.now() / 1000;
  const base = (Number.isFinite(end) ? end : Date.now() / 1000) - t;
  for (const e of out) e.ts += base;
  return out;
}

// ─── Event → agent model ──────────────────────────────────────────────────────

interface Classified {
  role: SiliconRole;
  state: MultiAgentState;
  stage?: PipelineStage;
  /** checklist step (see TASK_DEFS) this node advances */
  step?: string;
  detail?: string;
}

// Order matters: first match wins.
const NODE_RULES: (Classified & { re: RegExp })[] = [
  { re: /^(ask human|escalate)/i, role: "supervisor", state: "waiting", detail: "Esperando decisión humana" },
  { re: /init (tier|block)|advance tier/i, role: "supervisor", state: "spawning", detail: "Asignando bloques" },
  { re: /(integration|validation) dv/i, role: "dv", state: "running", stage: "verify", step: "val", detail: "Simulación cocotb" },
  { re: /testbench|tb fix|cocotb/i, role: "dv", state: "editing", stage: "verify", step: "tb", detail: "Testbench cocotb" },
  { re: /gather requirements|\bprd\b/i, role: "architect", state: "thinking", stage: "spec", step: "arch", detail: "Redactando PRD" },
  { re: /system architecture|functional requirements|engineering requirements/i, role: "architect", state: "thinking", stage: "spec", step: "arch" },
  { re: /block diagram|memory map|clock tree|register spec|documentation|finalize/i, role: "architect", state: "editing", stage: "spec", step: "arch" },
  { re: /constraint|final review|review uarch/i, role: "architect", state: "reading", stage: "spec", step: "review" },
  { re: /uarch|micro.?arch/i, role: "architect", state: "editing", stage: "spec", step: "spec", detail: "Microarquitectura" },
  { re: /generate rtl|lint|verilog/i, role: "rtl", state: "editing", stage: "rtl", step: "rtl", detail: "Escribiendo Verilog-2005" },
  { re: /diagnos|debug/i, role: "rtl", state: "searching", stage: "rtl", step: "diag", detail: "Diagnosticando falla" },
  { re: /synth|yosys/i, role: "synth", state: "running", stage: "logic_synth", step: "ysynth", detail: "Yosys → sky130_fd_sc_hd" },
  { re: /observer|summar/i, role: "supervisor", state: "thinking" },
];

function classify(name: string): Classified | null {
  for (const r of NODE_RULES) if (r.re.test(name)) return r;
  return null;
}

const ORFS_DETAIL: Record<string, string> = {
  synth:     "ORFS · Yosys → netlist",
  floorplan: "Floorplan: die/core + pines I/O",
  place:     "Placement de celdas estándar",
  cts:       "Clock Tree Synthesis",
  route:     "Routing de pistas metálicas",
  finish:    "Finish: GDSII · DEF · ODB",
};
const ORFS_TO_STAGE: Record<string, PipelineStage> = {
  synth: "logic_synth", floorplan: "floorplan", place: "place", cts: "cts", route: "route", finish: "finish",
};

const str = (v: unknown, max = 70): string => (v === undefined || v === null ? "" : String(v)).slice(0, max);

function emptyStages(): Record<PipelineStage, StageStatus> {
  return Object.fromEntries(PIPELINE_STAGES.map((s) => [s, "pending"])) as Record<PipelineStage, StageStatus>;
}

/** Runtime state of one checklist step. */
interface StepRT {
  def: StepDef;
  role: SiliconRole;
  /** block keys: lowercase block name, "#" = block unknown (in flight), "#n" = n-th block of unknown name, "*" = all */
  running: Set<string>;
  done: Set<string>;
  failed: Set<string>;
  attempts: number;
  since: number | null;
  skipped: boolean;
  seen: boolean;
}

const FEED_MAX = 40;

export class SiliconModel {
  readonly agents = new Map<SiliconRole, AgentUpdateEvent>();
  readonly pipeline: PipelineStatus;
  private lastLlmRole: SiliconRole | null = null;
  private lastLlmName = "";
  private lastWorker: SiliconRole | null = null;
  private changed = new Set<SiliconRole>();
  private steps = new Map<string, StepRT>();
  private seenBlocks = new Set<string>();

  constructor(runId: string, prompt: string, mode: "live" | "replay", synthetic: boolean) {
    for (const role of ROLES) {
      for (const def of TASK_DEFS[role].steps) {
        this.steps.set(`${role}.${def.id}`, {
          def, role, running: new Set(), done: new Set(), failed: new Set(),
          attempts: 0, since: null, skipped: false, seen: false,
        });
      }
    }
    this.pipeline = {
      runId, prompt, mode, synthetic,
      status: "idle", phase: null, design: null,
      stages: emptyStages(), metrics: {}, lastEvent: null, updatedTs: 0,
      startedTs: null, blocks: [], progress: 0,
      tasks: {} as Record<SiliconRole, AgentTask>, feed: [],
    };
    this.rebuild();
  }

  snapshot(): AgentUpdateEvent[] {
    return [...this.agents.values()];
  }

  private set(role: SiliconRole, state: MultiAgentState, detail?: string, tool?: string, ts?: number) {
    const info = ROLE_INFO[role];
    const prev = this.agents.get(role);
    this.agents.set(role, {
      agentId: `si-${role}`,
      role: role === "supervisor" ? "main" : "sub",
      sessionId: this.pipeline.runId,
      state,
      tool: tool ?? prev?.tool,
      detail: detail ?? prev?.detail,
      timestamp: new Date((ts ?? Date.now() / 1000) * 1000).toISOString(),
      agentType: role,
      label: info.label,
      seat: info.seat,
    });
    this.changed.add(role);
  }

  private markStage(stage: PipelineStage, status: StageStatus) {
    if (status === "running") {
      // Progress is monotonic: anything earlier still "running" is done.
      const idx = PIPELINE_STAGES.indexOf(stage);
      PIPELINE_STAGES.slice(0, idx).forEach((s) => {
        if (this.pipeline.stages[s] === "running") this.pipeline.stages[s] = "ok";
      });
    }
    this.pipeline.stages[stage] = status;
  }

  private settleStages(to: StageStatus, which: PipelineStage[] = [...PIPELINE_STAGES]) {
    for (const s of which) if (this.pipeline.stages[s] === "running") this.pipeline.stages[s] = to;
  }

  // ── Checklist (per-agent task progress) ─────────────────────────────────────

  private rt(role: SiliconRole, id: string): StepRT | undefined {
    return this.steps.get(`${role}.${id}`);
  }

  private totalBlocks(): number {
    return this.pipeline.blocks.length || Math.max(1, this.seenBlocks.size);
  }

  private stepEnter(role: SiliconRole, id: string | undefined, block: string, ts: number, bump: boolean) {
    const s = id ? this.rt(role, id) : undefined;
    if (!s) return;
    const key = s.def.perBlock ? block || "#" : "*";
    if (block && s.def.perBlock) this.seenBlocks.add(block);
    const had = s.done.has(key) || s.done.has("*");
    if (had && !bump) return;
    s.seen = true;
    s.skipped = false;
    if (had) s.attempts++;
    if (s.running.size === 0) s.since = ts;
    s.running.add(key);
    s.failed.delete(key);
  }

  private stepExit(role: SiliconRole, id: string | undefined, block: string, ok: boolean) {
    const s = id ? this.rt(role, id) : undefined;
    if (!s) return;
    const key = s.def.perBlock ? block || "#" : "*";
    s.seen = true;
    s.running.delete(key);
    if (ok) {
      s.failed.delete(key);
      s.done.add(key === "#" ? `#${s.done.size + 1}` : key);
    } else {
      s.failed.add(key);
    }
  }

  /** Whole-step transition (non per-block events, phase exits). */
  private stepSet(role: SiliconRole, id: string, state: StepState, ts: number) {
    const s = this.rt(role, id);
    if (!s) return;
    if (state === "running") { this.stepEnter(role, id, "", ts, false); return; }
    if (state === "skipped") {
      if (!s.done.has("*") && s.done.size === 0 && !s.seen) s.skipped = true;
      return;
    }
    s.seen = true;
    s.skipped = false;
    s.running.clear();
    if (state === "done") { s.failed.clear(); s.done.add("*"); }
    else if (state === "failed") s.failed.add("*");
  }

  private settleRunning(to: "done" | "failed", roles: SiliconRole[] = ROLES) {
    for (const s of this.steps.values()) {
      if (roles.includes(s.role) && s.running.size > 0) {
        s.running.clear();
        if (to === "done") s.done.add("*"); else s.failed.add("*");
      }
    }
  }

  private finalizeCoreSmith(ok: boolean, skipped: boolean, ts: number) {
    const targets: [SiliconRole, string][] = [
      ["architect", "arch"], ["architect", "spec"], ["architect", "review"],
      ["rtl", "rtl"], ["rtl", "diag"], ["dv", "tb"], ["dv", "val"], ["synth", "ysynth"],
      ["supervisor", "req"], ["supervisor", "frontend"],
    ];
    for (const [role, id] of targets) {
      const s = this.rt(role, id)!;
      if (skipped) { this.stepSet(role, id, "skipped", ts); continue; }
      if (ok) {
        // optional/extra steps only complete if they actually ran
        if ((s.def.optional || s.def.extra) && !s.seen) continue;
        this.stepSet(role, id, "done", ts);
      } else if (s.running.size > 0) {
        s.running.clear();
        s.failed.add("*");
      }
    }
  }

  private finalizeOrfs(ok: boolean, ts: number) {
    for (const def of TASK_DEFS.pnr.steps) this.stepSet("pnr", def.id, ok ? "done" : "failed", ts);
    if (ok) this.stepSet("synth", "orfs_synth", "done", ts);
    else this.settleRunning("failed", ["synth", "pnr"]);
  }

  private fracOf(s: StepRT): number {
    if (s.skipped) return 0;
    if (s.done.has("*")) return 1;
    if (!s.def.perBlock) return 0;
    const n = [...s.done].filter((k) => k !== "*").length;
    return Math.min(1, n / this.totalBlocks());
  }

  private rebuild() {
    const p = this.pipeline;
    for (const role of ROLES) {
      const def = TASK_DEFS[role];
      const steps: TaskStep[] = def.steps.map((d) => {
        const s = this.rt(role, d.id)!;
        const frac = this.fracOf(s);
        let state: StepState = "pending";
        if (s.skipped) state = "skipped";
        else if (s.running.size > 0) state = "running";
        else if (frac >= 1) state = "done";
        else if (s.failed.size > 0) state = "failed";
        else if (frac > 0) state = "running";
        return {
          id: d.id, label: d.label, state, frac, attempts: s.attempts,
          optional: Boolean(d.optional), extra: Boolean(d.extra),
          counted: !d.extra && !s.skipped && (!d.optional || s.seen),
        };
      });
      const counted = steps.filter((s) => s.counted);
      const total = counted.length;
      const pct = total ? Math.round((100 * counted.reduce((a, s) => a + s.frac, 0)) / total) : 0;
      const running = steps.find((s) => s.state === "running");
      let status: AgentTask["status"] = "idle";
      if (steps.filter((s) => !s.extra).every((s) => s.state === "skipped")) status = "skipped";
      else if (total > 0 && pct >= 100 && !running) status = "done";
      else if (running) status = "working";
      else if (steps.some((s) => s.state === "failed")) status = "blocked";
      let current: string | null = null;
      let currentSince: number | null = null;
      if (running) {
        const rs = this.rt(role, running.id)!;
        const n = rs.def.perBlock ? this.totalBlocks() : 1;
        current = n > 1 ? `${running.label} · ${Math.round(running.frac * n)}/${n} bloques` : running.label;
        currentSince = rs.since;
      }
      p.tasks[role] = {
        role, title: def.title, steps, pct, doneSteps: counted.filter((s) => s.frac >= 1).length,
        totalSteps: total, status, current, currentSince,
      };
    }
    const fin = PIPELINE_STAGES.filter((s) => p.stages[s] === "ok" || p.stages[s] === "skipped").length;
    p.progress = Math.round((100 * fin) / PIPELINE_STAGES.length);
  }

  private feedPush(ts: number, role: SiliconRole, text: string, kind: FeedItem["kind"] = "info") {
    const f = this.pipeline.feed;
    const last = f[f.length - 1];
    if (last && last.text === text && last.role === role) return;
    f.push({ ts, role, text, kind });
    if (f.length > FEED_MAX) f.splice(0, f.length - FEED_MAX);
  }

  private blockKey(ev: RawEvent, name: string): string {
    const b = str(ev.block, 40) || name.match(/\[([^\]]+)\]/)?.[1] || "";
    return b.toLowerCase();
  }

  /** Applies one event; returns the agents whose state changed. */
  apply(ev: RawEvent): AgentUpdateEvent[] {
    this.changed = new Set();
    const ts = ev.ts;
    const node = str(ev.node, 80);
    const p = this.pipeline;
    p.updatedTs = ts;
    p.lastEvent = `${ev.event}${node ? ` · ${node}` : ""}`;
    if (p.startedTs === null) p.startedTs = ts;

    if (!this.agents.has("supervisor") && ev.event !== "silicon_pipeline_start") {
      this.set("supervisor", "reading", "Supervisando pipeline", undefined, ts);
    }
    if (p.status === "idle") p.status = "running";

    switch (ev.event) {
      // ── silicon_pipeline.py ────────────────────────────────────────────────
      case "silicon_pipeline_start": {
        p.prompt = str(ev.prompt, 500) || p.prompt;
        p.status = "running";
        p.stages = emptyStages();
        p.startedTs = ts;
        this.set("supervisor", "spawning", `Nuevo chip: ${str(p.prompt, 48)}`, "SiliconIA", ts);
        this.feedPush(ts, "supervisor", "Pipeline iniciado");
        break;
      }
      case "silicon_phase_enter": {
        const phase = str(ev.phase);
        p.phase = phase;
        if (phase === "pdk") {
          this.markStage("pdk", "running");
          this.stepSet("supervisor", "pdk", "running", ts);
          this.set("supervisor", "running", "Validando Sky130 PDK", "sky130A", ts);
          this.feedPush(ts, "supervisor", "Validando PDK Sky130");
        } else if (phase === "coresmith") {
          this.set("supervisor", ev.skipped ? "reading" : "thinking",
            ev.skipped ? "CoreSmith omitido · Verilog provisto" : "Coordinando CoreSmith", "CoreSmith", ts);
          this.feedPush(ts, "supervisor", ev.skipped ? "CoreSmith omitido (Verilog provisto)" : "CoreSmith: generación de RTL");
        } else if (phase === "orfs") {
          this.stepSet("supervisor", "orfs", "running", ts);
          this.set("supervisor", "reading", "Supervisando OpenROAD-flow-scripts", "ORFS", ts);
          this.feedPush(ts, "supervisor", "Inicia el flujo físico (OpenROAD)");
        } else if (phase === "gui") {
          this.set("supervisor", "spawning", "OpenROAD GUI abierto", "openroad -gui", ts);
          this.feedPush(ts, "supervisor", "Abriendo OpenROAD GUI");
        }
        break;
      }
      case "silicon_phase_exit": {
        const phase = str(ev.phase);
        const ok = ev.status !== "error";
        if (phase === "pdk") {
          this.markStage("pdk", ok ? "ok" : "error");
          this.stepSet("supervisor", "pdk", ok ? "done" : "failed", ts);
          this.set("supervisor", ok ? "reading" : "waiting", ok ? "PDK Sky130 ✓" : "✗ PDK incompleto", undefined, ts);
          this.feedPush(ts, "supervisor", ok ? "PDK Sky130 ✓" : "PDK incompleto", ok ? "ok" : "error");
        } else if (phase === "coresmith") {
          if (ev.skipped) {
            (["spec", "rtl", "verify"] as PipelineStage[]).forEach((s) => {
              if (p.stages[s] === "pending") p.stages[s] = "skipped";
            });
          } else {
            this.settleStages(ok ? "ok" : "error", ["spec", "rtl", "verify", "logic_synth"]);
          }
          this.finalizeCoreSmith(ok, Boolean(ev.skipped), ts);
          this.set("supervisor", ok ? "reading" : "waiting",
            ok ? `RTL listo · ${str(ev.rtl_files)} archivo(s)` : "✗ CoreSmith sin RTL", undefined, ts);
          this.feedPush(ts, "supervisor",
            ok ? (ev.skipped ? "RTL provisto por el usuario" : `RTL listo · ${str(ev.rtl_files)} archivo(s)`) : "CoreSmith no produjo RTL",
            ok ? "ok" : "error");
        } else if (phase === "orfs") {
          this.settleStages(ok ? "ok" : "error");
          this.finalizeOrfs(ok, ts);
          this.stepSet("supervisor", "orfs", ok ? "done" : "failed", ts);
          this.set("supervisor", ok ? "reading" : "waiting",
            ok ? "Layout físico completo ✓" : "✗ Falló el flujo físico", undefined, ts);
          this.feedPush(ts, "supervisor", ok ? "Layout físico completo" : "Falló el flujo físico", ok ? "ok" : "error");
        } else if (phase === "gui") {
          this.set("supervisor", "reading", "GUI cerrada", undefined, ts);
        }
        break;
      }
      case "silicon_step": {
        const step = str(ev.step);
        if (step === "requirements_written") {
          this.stepSet("supervisor", "req", "running", ts);
          this.set("supervisor", "editing", "Escribiendo requirements.md", "Write", ts);
          this.feedPush(ts, "supervisor", "requirements.md escrito");
        } else if (step === "blocks_generated") {
          const list = Array.isArray(ev.blocks) ? ev.blocks.map((b) => String(b)) : [];
          if (list.length) p.blocks = list.map((b) => b.toLowerCase());
          this.stepSet("supervisor", "req", "done", ts);
          this.set("supervisor", "editing", `blocks.yaml${list.length ? ` · ${list.join(", ")}` : ""}`, "Write", ts);
          this.feedPush(ts, "supervisor", `Bloques: ${list.join(", ") || "—"}`, "ok");
        } else if (step === "daemon_started") {
          this.stepSet("supervisor", "frontend", "running", ts);
          this.set("supervisor", "running", "Daemon CoreSmith activo", "coresmithd", ts);
          this.feedPush(ts, "supervisor", "Daemon CoreSmith activo");
        } else if (step === "frontend_started") {
          if (ev.ok === false) this.stepSet("supervisor", "frontend", "failed", ts);
          this.set("supervisor", ev.ok === false ? "waiting" : "reading",
            ev.ok === false ? "✗ Frontend no inició" : "Monitoreando frontend RTL", undefined, ts);
          this.feedPush(ts, "supervisor", ev.ok === false ? "Frontend no inició" : "Frontend RTL en marcha",
            ev.ok === false ? "error" : "info");
        } else if (step === "design_detected") {
          p.design = str(ev.design) || p.design;
          this.set("supervisor", "reading", `Diseño top: ${str(ev.design)}`, undefined, ts);
          this.feedPush(ts, "supervisor", `Diseño top: ${str(ev.design)}`);
        } else if (step === "orfs_config_generated") {
          p.design = str(ev.design) || p.design;
          this.stepSet("pnr", "cfg", "done", ts);
          this.set("pnr", "editing", "Generando config.mk (sky130hd)", "config.mk", ts);
          this.feedPush(ts, "pnr", "config.mk generado (sky130hd)");
        } else if (step === "stage_retry") {
          const st = str(ev.stage);
          const s = st === "synth" ? this.rt("synth", "orfs_synth") : this.rt("pnr", st);
          if (s) s.attempts++;
          this.set(st === "synth" ? "synth" : "pnr", "running", `Reintento ${str(ev.attempt)} · ${st}`, undefined, ts);
          this.feedPush(ts, st === "synth" ? "synth" : "pnr", `Reintento ${str(ev.attempt)} · ${st}`, "warn");
        }
        break;
      }
      case "silicon_interrupt": {
        const auto = ev.action === "auto_approve";
        this.set("supervisor", "waiting",
          `${auto ? "Auto-aprobando" : "Esperando humano"} · ${str(ev.interrupt_type, 40)}`, "interrupt", ts);
        this.feedPush(ts, "supervisor", `${auto ? "Auto-aprobado" : "Requiere humano"} · ${str(ev.interrupt_type, 40)}`, auto ? "info" : "warn");
        break;
      }
      case "silicon_stage_enter": {
        const stage = str(ev.stage);
        if (ORFS_TO_STAGE[stage]) this.markStage(ORFS_TO_STAGE[stage], "running");
        if (ev.design) p.design = str(ev.design);
        const role: SiliconRole = stage === "synth" ? "synth" : "pnr";
        this.stepSet(role, stage === "synth" ? "orfs_synth" : stage, "running", ts);
        this.set(role, "running", ORFS_DETAIL[stage] ?? stage, `make ${stage}`, ts);
        this.feedPush(ts, role, `▶ ${ORFS_DETAIL[stage] ?? stage}`);
        break;
      }
      case "silicon_stage_exit": {
        const stage = str(ev.stage);
        const ok = ev.status !== "error";
        if (ORFS_TO_STAGE[stage]) this.markStage(ORFS_TO_STAGE[stage], ok ? "ok" : "error");
        const role: SiliconRole = stage === "synth" ? "synth" : "pnr";
        this.stepSet(role, stage === "synth" ? "orfs_synth" : stage, ok ? "done" : "failed", ts);
        const dur = typeof ev.duration_s === "number" ? ` · ${ev.duration_s.toFixed(1)}s` : "";
        this.set(role, ok ? "idle" : "waiting",
          ok ? `✓ ${stage}${dur}` : `✗ ${stage}: ${str(ev.error, 50)}`, undefined, ts);
        this.feedPush(ts, role, ok ? `✓ ${stage}${dur}` : `✗ ${stage}: ${str(ev.error, 50)}`, ok ? "ok" : "error");
        break;
      }
      case "silicon_metrics": {
        for (const [k, v] of Object.entries(ev)) {
          if (typeof v === "number" && k !== "ts" && k !== "pid") p.metrics[k] = v;
        }
        const area = p.metrics.design_area_um2;
        const util = p.metrics.utilization_pct;
        if (area !== undefined) {
          this.set("supervisor", "reading",
            `Área ${area} µm²${util !== undefined ? ` · ${util}% util` : ""}`, undefined, ts);
          this.feedPush(ts, "supervisor", `Métricas: ${area} µm²${util !== undefined ? ` · ${util}% util` : ""}`, "ok");
        }
        break;
      }
      case "silicon_pipeline_end": {
        const ok = ev.success === true;
        p.status = ok ? "done" : "error";
        p.phase = null;
        this.settleStages(ok ? "ok" : "error");
        this.settleRunning(ok ? "done" : "failed");
        this.stepSet("supervisor", "report", ok ? "done" : "failed", ts);
        for (const role of [...this.agents.keys()]) {
          if (role !== "supervisor") this.set(role, "idle", undefined, undefined, ts);
        }
        this.set("supervisor", ok ? "idle" : "waiting",
          ok ? `✓ GDSII listo${p.design ? ` · ${p.design}` : ""}`
             : `✗ Falló en ${str(ev.failed_phase) || "pipeline"}${ev.error ? `: ${str(ev.error, 40)}` : ""}`,
          undefined, ts);
        this.feedPush(ts, "supervisor",
          ok ? `✓ GDSII listo${p.design ? ` · ${p.design}` : ""}` : `✗ Falló en ${str(ev.failed_phase) || "pipeline"}`,
          ok ? "ok" : "error");
        break;
      }

      // ── CoreSmith LangGraph ────────────────────────────────────────────────
      case "graph_node_enter": {
        const c = classify(node) ?? { role: "supervisor" as SiliconRole, state: "thinking" as MultiAgentState };
        if (c.stage) this.markStage(c.stage, "running");
        const block = this.blockKey(ev, node);
        this.stepEnter(c.role, c.step, block, ts, true);
        this.set(c.role, c.state, `${c.detail ?? node}${block ? ` [${block}]` : ""}`, node, ts);
        this.feedPush(ts, c.role, `▶ ${node}${block ? ` [${block}]` : ""}`);
        if (c.role !== "supervisor") this.lastWorker = c.role;
        break;
      }
      case "graph_node_exit": {
        const c = classify(node) ?? { role: "supervisor" as SiliconRole, state: "thinking" as MultiAgentState };
        const failed = ev.status === "error";
        const block = this.blockKey(ev, node);
        if (failed && c.stage) this.markStage(c.stage, "error");
        this.stepExit(c.role, c.step, block, !failed);
        if (c.role === "supervisor") {
          this.set("supervisor", failed ? "waiting" : "reading", `${failed ? "✗" : "✓"} ${node}`, undefined, ts);
        } else if (this.agents.has(c.role)) {
          this.set(c.role, failed ? "waiting" : "idle", `${failed ? "✗" : "✓"} ${node}`, undefined, ts);
        }
        this.feedPush(ts, c.role, `${failed ? "✗" : "✓"} ${node}${block ? ` [${block}]` : ""}`, failed ? "error" : "ok");
        break;
      }
      case "graph_error": {
        const c = classify(node) ?? { role: "supervisor" as SiliconRole, state: "waiting" as MultiAgentState };
        if (c.stage) this.markStage(c.stage, "error");
        this.stepExit(c.role, c.step, this.blockKey(ev, node), false);
        this.set(c.role, "waiting", `✗ ${node}: ${str(ev.error, 50)}`, undefined, ts);
        this.feedPush(ts, c.role, `✗ ${node}: ${str(ev.error, 50)}`, "error");
        break;
      }
      case "llm_start": {
        const name = node && node !== "LLM" ? node : str(ev.run_name, 60);
        const c = classify(name);
        const role = c?.role ?? this.lastWorker ?? "supervisor";
        let state: MultiAgentState = c?.state ?? "thinking";
        if (state === "running") state = "editing"; // an LLM call writes, tools run
        if (state === "waiting" || state === "spawning") state = "thinking";
        this.lastLlmRole = role;
        this.lastLlmName = name;
        if (c?.step) this.stepEnter(role, c.step, this.blockKey(ev, name), ts, false);
        this.set(role, state, `🧠 ${name || "LLM"}`, str(ev.model, 30) || "LLM", ts);
        break;
      }
      case "llm_call_heartbeat": {
        const role = this.lastLlmRole;
        const cur = role ? this.agents.get(role) : undefined;
        if (role && cur) {
          const el = typeof ev.elapsed_s === "number" ? `${Math.round(ev.elapsed_s)}s` : "";
          this.set(role, cur.state, `🧠 ${this.lastLlmName || "LLM"}${el ? ` · ${el}` : ""}`, undefined, ts);
        }
        break;
      }
      case "llm_end": {
        const name = str(ev.run_name, 60);
        const role = classify(name)?.role ?? this.lastLlmRole;
        const cur = role ? this.agents.get(role) : undefined;
        if (role && cur) {
          this.set(role, cur.state, `✓ ${name || "LLM"} · ${str(ev.output_chars)} chars`, undefined, ts);
        }
        break;
      }
      case "llm_error": {
        const name = str(ev.run_name, 60);
        const role = classify(name)?.role ?? this.lastLlmRole ?? "supervisor";
        this.set(role, "waiting", `✗ LLM: ${str(ev.error, 50)}`, undefined, ts);
        this.feedPush(ts, role, `✗ LLM: ${str(ev.error, 50)}`, "error");
        break;
      }
      default:
        break;
    }

    this.rebuild();
    return [...this.changed].map((r) => this.agents.get(r)!).filter(Boolean);
  }
}
