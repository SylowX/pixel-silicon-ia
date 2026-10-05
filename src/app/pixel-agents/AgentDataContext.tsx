"use client";

import { createContext, useContext, useEffect, useReducer, useRef } from "react";
import type { AgentRole, MultiAgentState, AgentUpdateEvent } from "@/app/api/pixel-agents/agents-stream/route";
import type { PipelineStatus } from "@/lib/siliconia";

export type { AgentRole, MultiAgentState, PipelineStatus };

/** "siliconia" (default) streams SiliconIA runs; "claude" streams Claude Code sessions. */
export type DataSource = "siliconia" | "claude";

export interface AgentEntry {
  agentId: string;
  role: AgentRole;
  sessionId: string;
  state: MultiAgentState;
  tool?: string;
  detail?: string;
  lastSeen: string;
  agentType?: string;
  label?: string;
  seat?: number;
}

type AgentDataState = {
  agents: Map<string, AgentEntry>;
  connected: boolean;
  activeSessionId: string | null;
  source: DataSource;
  pipeline: PipelineStatus | null;
};

type Action =
  | { type: "connected" }
  | { type: "disconnected" }
  | { type: "source"; source: DataSource }
  | { type: "snapshot"; entries: AgentEntry[] }
  | { type: "update"; entry: AgentEntry }
  | { type: "agent_end"; agentId: string }
  | { type: "session_change"; sessionId: string }
  | { type: "pipeline"; pipeline: PipelineStatus | null };

function reducer(state: AgentDataState, action: Action): AgentDataState {
  switch (action.type) {
    case "connected": return { ...state, connected: true };
    case "disconnected": return { ...state, connected: false };
    case "source": return { ...state, source: action.source };
    case "session_change": return { ...state, agents: new Map(), activeSessionId: action.sessionId };
    case "snapshot": { const m = new Map<string, AgentEntry>(); action.entries.forEach((e) => m.set(e.agentId, e)); return { ...state, agents: m }; }
    case "update": { const m = new Map(state.agents); m.set(action.entry.agentId, action.entry); return { ...state, agents: m }; }
    case "agent_end": { const m = new Map(state.agents); m.delete(action.agentId); return { ...state, agents: m }; }
    case "pipeline": return { ...state, pipeline: action.pipeline };
    default: return state;
  }
}

type AgentDataContextValue = AgentDataState & { dispatch: React.Dispatch<Action> };

const INITIAL: AgentDataState = { agents: new Map(), connected: false, activeSessionId: null, source: "siliconia", pipeline: null };

const AgentDataContext = createContext<AgentDataContextValue>({ ...INITIAL, dispatch: () => {} });

function toEntry(raw: AgentUpdateEvent): AgentEntry {
  return {
    agentId: raw.agentId, role: raw.role, sessionId: raw.sessionId, state: raw.state,
    tool: raw.tool, detail: raw.detail, lastSeen: raw.timestamp, agentType: raw.agentType,
    label: raw.label, seat: raw.seat,
  };
}

/** Builds the SSE URL from the page query string (?source, ?run, ?replay, ?speed, ?loop). */
function streamUrl(): { source: DataSource; url: string } {
  const q = new URLSearchParams(window.location.search);
  const fallback = process.env.NEXT_PUBLIC_PIXEL_SOURCE === "claude" ? "claude" : "siliconia";
  const source: DataSource = q.get("source") === "claude" ? "claude" : q.get("source") === "siliconia" ? "siliconia" : fallback;
  if (source === "claude") return { source, url: "/api/pixel-agents/agents-stream" };
  const fwd = new URLSearchParams();
  for (const k of ["run", "replay", "speed", "loop"]) { const v = q.get(k); if (v) fwd.set(k, v); }
  const qs = fwd.toString();
  return { source, url: `/api/pixel-agents/silicon-stream${qs ? `?${qs}` : ""}` };
}

export function AgentDataProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, INITIAL);
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    const { source, url } = streamUrl();
    dispatch({ type: "source", source });
    const es = new EventSource(url);
    esRef.current = es;
    es.onopen = () => dispatch({ type: "connected" });
    es.onerror = () => dispatch({ type: "disconnected" });
    es.addEventListener("snapshot", (e: MessageEvent) => dispatch({ type: "snapshot", entries: (JSON.parse(e.data) as AgentUpdateEvent[]).map(toEntry) }));
    es.addEventListener("agent_update", (e: MessageEvent) => dispatch({ type: "update", entry: toEntry(JSON.parse(e.data) as AgentUpdateEvent) }));
    es.addEventListener("agent_end", (e: MessageEvent) => dispatch({ type: "agent_end", agentId: (JSON.parse(e.data) as { agentId: string }).agentId }));
    es.addEventListener("session_change", (e: MessageEvent) => dispatch({ type: "session_change", sessionId: (JSON.parse(e.data) as { sessionId: string }).sessionId }));
    es.addEventListener("pipeline", (e: MessageEvent) => dispatch({ type: "pipeline", pipeline: JSON.parse(e.data) as PipelineStatus | null }));
    return () => es.close();
  }, []);

  return <AgentDataContext.Provider value={{ ...state, dispatch }}>{children}</AgentDataContext.Provider>;
}

export function useAgentData(): AgentDataContextValue {
  return useContext(AgentDataContext);
}
