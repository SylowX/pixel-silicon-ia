import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

// Mount your ~/.claude directory into the container and set this env var.
// Default: /dot-claude/projects/-root (Claude Code running from home directory)
// If you run Claude Code from /home/user/myproject, set:
//   CLAUDE_JSONL_DIR=/dot-claude/projects/-home-user-myproject
const JSONL_DIR = process.env.CLAUDE_JSONL_DIR ?? "/dot-claude/projects/-root";
const POLL_MS = 600;
const STALE_MS = 30_000;

export type AgentRole = "main" | "sub";

export type MultiAgentState =
  | "idle"
  | "reading"
  | "editing"
  | "running"
  | "searching"
  | "thinking"
  | "waiting"
  | "spawning";

export interface AgentUpdateEvent {
  agentId: string;
  role: AgentRole;
  sessionId: string;
  state: MultiAgentState;
  tool?: string;
  detail?: string;
  timestamp: string;
  agentType?: string;
  /** Display name override (used by the SiliconIA source). */
  label?: string;
  /** Fixed desk index 0-5 (used by the SiliconIA source). */
  seat?: number;
}

interface TrackedFile {
  path: string;
  agentId: string;
  size: number;
  lastGrew: number;
}

function getActiveMainJSONL(): { file: string; sessionId: string } | null {
  try {
    const files = fs
      .readdirSync(JSONL_DIR)
      .filter((f) => f.endsWith(".jsonl"))
      .map((f) => {
        const full = path.join(JSONL_DIR, f);
        return { file: full, mtime: fs.statSync(full).mtimeMs };
      })
      .sort((a, b) => b.mtime - a.mtime);
    if (!files[0]) return null;
    const sessionId = path.basename(files[0].file, ".jsonl");
    return { file: files[0].file, sessionId };
  } catch {
    return null;
  }
}

function getSubagentFiles(sessionId: string): { file: string; agentId: string }[] {
  try {
    const subDir = path.join(JSONL_DIR, sessionId, "subagents");
    if (!fs.existsSync(subDir)) return [];
    return fs
      .readdirSync(subDir)
      .filter((f) => f.endsWith(".jsonl") && !f.includes("compact"))
      .map((f) => ({
        file: path.join(subDir, f),
        agentId: f.replace("agent-", "").replace(".jsonl", ""),
      }));
  } catch {
    return [];
  }
}

function readAgentType(filePath: string): string | undefined {
  try {
    const metaPath = filePath.replace(".jsonl", ".meta.json");
    if (!fs.existsSync(metaPath)) return undefined;
    return JSON.parse(fs.readFileSync(metaPath, "utf8")).agentType ?? undefined;
  } catch {
    return undefined;
  }
}

interface ParsedLine {
  state: MultiAgentState;
  tool?: string;
  detail?: string;
  sessionId: string;
  timestamp: string;
}

function parseLine(raw: string, expectSidechain: boolean): ParsedLine | null {
  try {
    const d = JSON.parse(raw.trim());
    if ((d.isSidechain === true) !== expectSidechain) return null;
    const ts: string = d.timestamp ?? new Date().toISOString();
    const sessionId: string = d.sessionId ?? "";
    const msg = d.message;
    if (msg?.role === "assistant" && Array.isArray(msg.content)) {
      for (const block of msg.content) {
        if (block?.type === "tool_use") {
          const name: string = block.name ?? "";
          const input = block.input ?? {};
          if (name === "Read") return { state: "reading", tool: name, detail: input.file_path ?? "", sessionId, timestamp: ts };
          if (name === "Edit" || name === "Write" || name === "NotebookEdit") return { state: "editing", tool: name, detail: input.file_path ?? "", sessionId, timestamp: ts };
          if (name === "Bash") return { state: "running", tool: name, detail: (input.command ?? "").slice(0, 80), sessionId, timestamp: ts };
          if (name === "Grep" || name === "Glob") return { state: "searching", tool: name, detail: input.pattern ?? input.glob ?? "", sessionId, timestamp: ts };
          if (name === "Agent") return { state: "spawning", tool: name, detail: input.description ?? "sub-agent", sessionId, timestamp: ts };
          if (name === "WebFetch" || name === "WebSearch") return { state: "searching", tool: name, detail: input.url ?? input.query ?? "", sessionId, timestamp: ts };
          return { state: "running", tool: name, detail: JSON.stringify(input).slice(0, 60), sessionId, timestamp: ts };
        }
        if (block?.type === "text" && typeof block.text === "string" && block.text.length > 0) {
          return { state: "thinking", tool: undefined, detail: block.text.slice(0, 60), sessionId, timestamp: ts };
        }
      }
    }
    if (msg?.role === "user") {
      const content = msg.content;
      if (typeof content === "string" && content.trim() && !content.includes("local-command") && !content.includes("tool_result")) {
        return { state: "waiting", tool: undefined, detail: content.slice(0, 60), sessionId, timestamp: ts };
      }
      if (Array.isArray(content)) {
        const hasToolResult = content.some((b: { type?: string }) => b?.type === "tool_result");
        if (!hasToolResult) {
          const text = content.find((b: { type?: string; text?: string }) => b?.type === "text")?.text ?? "";
          if (text && !text.includes("local-command")) return { state: "waiting", tool: undefined, detail: text.slice(0, 60), sessionId, timestamp: ts };
        }
      }
    }
  } catch { /* malformed */ }
  return null;
}

function readNewLines(filePath: string, from: number, to: number, expectSidechain: boolean): ParsedLine[] {
  try {
    const len = to - from;
    if (len <= 0) return [];
    const fd = fs.openSync(filePath, "r");
    const buf = Buffer.alloc(len);
    fs.readSync(fd, buf, 0, len, from);
    fs.closeSync(fd);
    return buf.toString("utf8").split("\n").filter(Boolean).map((l) => parseLine(l, expectSidechain)).filter((e): e is ParsedLine => e !== null);
  } catch { return []; }
}

function readRecentLines(filePath: string, n: number, expectSidechain: boolean): ParsedLine[] {
  try {
    const lines = fs.readFileSync(filePath, "utf8").split("\n").filter(Boolean);
    const events: ParsedLine[] = [];
    for (const line of lines) {
      const ev = parseLine(line, expectSidechain);
      if (ev) { events.push(ev); if (events.length > n * 3) events.shift(); }
    }
    return events.slice(-n);
  } catch { return []; }
}

export async function GET() {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      let closed = false;
      let currentSessionId: string | null = null;
      const tracked = new Map<string, TrackedFile>();

      function send(event: string, data: unknown) {
        if (closed) return;
        try { controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)); }
        catch { closed = true; }
      }

      function emitUpdate(parsed: ParsedLine, agentId: string, role: AgentRole, agentType?: string) {
        send("agent_update", { agentId, role, sessionId: parsed.sessionId || currentSessionId || "", state: parsed.state, tool: parsed.tool, detail: parsed.detail, timestamp: parsed.timestamp, agentType } satisfies AgentUpdateEvent);
      }

      function initSession(sessionId: string) {
        currentSessionId = sessionId;
        tracked.clear();
        const snapshot: AgentUpdateEvent[] = [];
        const mainPath = path.join(JSONL_DIR, `${sessionId}.jsonl`);
        try {
          tracked.set("main", { path: mainPath, agentId: "main", size: fs.statSync(mainPath).size, lastGrew: Date.now() });
          const last = readRecentLines(mainPath, 5, false).slice(-1)[0];
          if (last) snapshot.push({ agentId: "main", role: "main", sessionId: last.sessionId || sessionId, state: last.state, tool: last.tool, detail: last.detail, timestamp: last.timestamp });
        } catch { /* no main file yet */ }
        for (const { file, agentId } of getSubagentFiles(sessionId)) {
          try {
            const agentType = readAgentType(file);
            tracked.set(agentId, { path: file, agentId, size: fs.statSync(file).size, lastGrew: Date.now() });
            const last = readRecentLines(file, 5, true).slice(-1)[0];
            if (last) snapshot.push({ agentId, role: "sub", sessionId: last.sessionId || sessionId, state: last.state, tool: last.tool, detail: last.detail, timestamp: last.timestamp, agentType });
          } catch { /* skip */ }
        }
        send("snapshot", snapshot);
      }

      function poll() {
        if (closed) return;
        try {
          const active = getActiveMainJSONL();
          if (!active) { if (currentSessionId !== null) { currentSessionId = null; tracked.clear(); send("snapshot", []); } return; }
          if (active.sessionId !== currentSessionId) { send("session_change", { sessionId: active.sessionId }); initSession(active.sessionId); return; }
          const now = Date.now();
          const mainT = tracked.get("main");
          if (mainT) {
            try {
              const stat = fs.statSync(mainT.path);
              if (stat.size > mainT.size) { for (const l of readNewLines(mainT.path, mainT.size, stat.size, false)) emitUpdate(l, "main", "main"); mainT.lastGrew = now; mainT.size = stat.size; }
            } catch { /* skip */ }
          }
          for (const { file, agentId } of getSubagentFiles(currentSessionId!)) {
            if (!tracked.has(agentId)) {
              try {
                const agentType = readAgentType(file);
                tracked.set(agentId, { path: file, agentId, size: fs.statSync(file).size, lastGrew: now });
                const last = readRecentLines(file, 1, true).slice(-1)[0];
                if (last) emitUpdate(last, agentId, "sub", agentType);
              } catch { /* skip */ }
              continue;
            }
            const tf = tracked.get(agentId)!;
            try {
              const stat = fs.statSync(tf.path);
              if (stat.size > tf.size) { for (const l of readNewLines(tf.path, tf.size, stat.size, true)) emitUpdate(l, agentId, "sub", readAgentType(tf.path)); tf.lastGrew = now; tf.size = stat.size; }
            } catch { /* skip */ }
          }
          for (const [agentId, tf] of tracked) {
            if (agentId !== "main" && now - tf.lastGrew > STALE_MS) { send("agent_end", { agentId }); tracked.delete(agentId); }
          }
        } catch { /* outer guard */ }
      }

      function heartbeat() {
        if (!closed) { try { controller.enqueue(encoder.encode(": ping\n\n")); } catch { closed = true; } }
      }

      const active = getActiveMainJSONL();
      if (active) initSession(active.sessionId); else send("snapshot", []);
      const intervalId = setInterval(poll, POLL_MS);
      const heartbeatId = setInterval(heartbeat, 15_000);
      (controller as unknown as { _cleanup: () => void })._cleanup = () => { closed = true; clearInterval(intervalId); clearInterval(heartbeatId); };
    },
    cancel(controller) {
      const c = controller as unknown as { _cleanup?: () => void };
      if (c._cleanup) c._cleanup();
    },
  });

  return new NextResponse(stream, {
    headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive", "X-Accel-Buffering": "no" },
  });
}
