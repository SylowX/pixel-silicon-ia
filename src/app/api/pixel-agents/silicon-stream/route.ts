import type { NextRequest } from "next/server";
import fs from "fs";
import path from "path";
import {
  JsonlTailer,
  SiliconModel,
  eventFiles,
  readCurrentRun,
  resolveRunId,
  runDir,
  sortEvents,
  synthesizeFromReport,
  type RawEvent,
} from "@/lib/siliconia";
import type { AgentUpdateEvent } from "../agents-stream/route";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// SSE stream of SiliconIA activity, speaking the same protocol as agents-stream
// (snapshot / agent_update / agent_end / session_change) plus a `pipeline`
// event carrying phase/stage progress and physical-design metrics.
//
// Query params:
//   run=<run_id>   pin a run (default: current_run.json → newest run, auto-follow)
//   replay=1       replay the run from the beginning instead of following it live
//   speed=<n>      replay speed multiplier (default 1)
//   loop=1         restart the replay when it ends

const POLL_MS = 600;
const HEARTBEAT_MS = 15_000;
const REPLAY_MIN_MS = 150;
const REPLAY_MAX_MS = 3_500;
const REPLAY_START_MS = 1_200;
const REPLAY_LOOP_PAUSE_MS = 8_000;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

function readPrompt(dir: string): string {
  try { return fs.readFileSync(path.join(dir, "prompt.txt"), "utf8").trim(); } catch { return ""; }
}

/** Keep only the latest update per agent within a batch. */
function compress(updates: AgentUpdateEvent[]): AgentUpdateEvent[] {
  const m = new Map<string, AgentUpdateEvent>();
  for (const u of updates) m.set(u.agentId, u);
  return [...m.values()];
}

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams;
  const requestedRun = q.get("run");
  const replay = q.get("replay") === "1";
  const speed = clamp(parseFloat(q.get("speed") ?? "1") || 1, 0.1, 50);
  const loop = q.get("loop") === "1";

  const encoder = new TextEncoder();
  let cleanup = () => {};

  const stream = new ReadableStream({
    start(controller) {
      let closed = false;
      const timeouts = new Set<ReturnType<typeof setTimeout>>();
      const intervals = new Set<ReturnType<typeof setInterval>>();

      const send = (event: string, data: unknown) => {
        if (closed) return;
        try { controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)); }
        catch { cleanup(); }
      };
      const later = (fn: () => void, ms: number) => {
        const id = setTimeout(() => { timeouts.delete(id); if (!closed) fn(); }, ms);
        timeouts.add(id);
      };
      const every = (fn: () => void, ms: number) => {
        intervals.add(setInterval(() => { if (!closed) fn(); }, ms));
      };

      cleanup = () => {
        if (closed) return;
        closed = true;
        timeouts.forEach(clearTimeout);
        intervals.forEach(clearInterval);
        try { controller.close(); } catch { /* already closed */ }
      };
      req.signal.addEventListener("abort", () => cleanup());

      every(() => {
        try { controller.enqueue(encoder.encode(": ping\n\n")); } catch { cleanup(); }
      }, HEARTBEAT_MS);

      const sendEmpty = () => {
        send("session_change", { sessionId: "none" });
        send("snapshot", []);
        send("pipeline", null);
      };

      // ── Replay: re-emit a recorded run with compressed timing ─────────────
      if (replay) {
        const id = resolveRunId(requestedRun);
        if (!id) { sendEmpty(); return; }
        const dir = runDir(id);
        let events: RawEvent[] = sortEvents(eventFiles(dir).flatMap((f) => new JsonlTailer(f).readNew()))
          .filter((e) => e.event !== "llm_call_heartbeat"); // pure noise at replay speed
        let synthetic = false;
        if (!events.length) { events = synthesizeFromReport(dir); synthetic = events.length > 0; }
        if (!events.length) { sendEmpty(); return; }
        const prompt = readPrompt(dir);

        const play = () => {
          const model = new SiliconModel(id, prompt, "replay", synthetic);
          send("session_change", { sessionId: id });
          send("snapshot", []);
          send("pipeline", model.pipeline);
          let i = 0;
          const step = () => {
            if (i >= events.length) {
              if (loop) later(play, REPLAY_LOOP_PAUSE_MS);
              return;
            }
            const ev = events[i++];
            for (const u of model.apply(ev)) send("agent_update", u);
            send("pipeline", model.pipeline);
            const next = events[i];
            const gap = next ? ((next.ts - ev.ts) * 1000) / speed : 0;
            later(step, clamp(gap, REPLAY_MIN_MS, Math.max(REPLAY_MIN_MS, REPLAY_MAX_MS / Math.max(1, speed))));
          };
          later(step, REPLAY_START_MS);
        };
        play();
        return;
      }

      // ── Live: fold existing history, then tail new events ─────────────────
      let runId: string | null = null;
      let model: SiliconModel | null = null;
      let tailers: JsonlTailer[] = [];

      const init = (id: string | null) => {
        runId = id;
        model = null;
        tailers = [];
        if (!id) { sendEmpty(); return; }
        const dir = runDir(id);
        tailers = eventFiles(dir).map((f) => new JsonlTailer(f));
        let history = sortEvents(tailers.flatMap((t) => t.readNew()));
        let synthetic = false;
        if (!history.length) {
          history = synthesizeFromReport(dir);
          synthetic = history.length > 0;
        }
        model = new SiliconModel(id, readPrompt(dir), "live", synthetic);
        for (const ev of history) model.apply(ev);
        const cur = readCurrentRun();
        if (cur?.run_id === id && cur?.status === "aborted" && model.pipeline.status !== "aborted") {
          model.abort("user_stop");
        }
        send("session_change", { sessionId: id });
        send("snapshot", model.snapshot());
        send("pipeline", model.pipeline);
      };

      const poll = () => {
        try {
          if (!requestedRun) {
            const next = resolveRunId(null);
            if (next !== runId) { init(next); return; }
          }
          if (runId && !fs.existsSync(runDir(runId))) {
            init(resolveRunId(null));
            return;
          }
          if (!model) return;
          const cur = readCurrentRun();
          if (cur?.run_id === runId && cur?.status === "aborted" && model.pipeline.status !== "aborted") {
            const abortUpdates = model.abort("user_stop");
            for (const u of abortUpdates) send("agent_update", u);
            send("pipeline", model.pipeline);
          }
          const batch = sortEvents(tailers.flatMap((t) => t.readNew()));
          if (!batch.length) return;
          const updates: AgentUpdateEvent[] = [];
          for (const ev of batch) updates.push(...model.apply(ev));
          for (const u of compress(updates)) send("agent_update", u);
          send("pipeline", model.pipeline);
        } catch { /* keep polling */ }
      };

      init(resolveRunId(requestedRun));
      every(poll, POLL_MS);
    },
    cancel() {
      cleanup();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
