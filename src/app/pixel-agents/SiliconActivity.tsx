"use client";

import { useEffect, useState } from "react";
import { useAgentData } from "./AgentDataContext";
import type { FeedItem, SiliconRole } from "@/lib/siliconia";

const ROLES: { role: SiliconRole; name: string; rgb: string }[] = [
  { role: "supervisor", name: "supervisor", rgb: "251,191,36" },
  { role: "architect",  name: "architect",  rgb: "167,139,250" },
  { role: "rtl",        name: "rtl-coder",  rgb: "56,189,248" },
  { role: "dv",         name: "verifier",   rgb: "52,211,153" },
  { role: "synth",      name: "synthesis",  rgb: "244,114,182" },
  { role: "pnr",        name: "pnr",        rgb: "129,140,248" },
];

const FEED_COLOR: Record<FeedItem["kind"], string> = {
  info: "rgba(255,255,255,0.55)",
  ok: "#34d399",
  error: "#f43f5e",
  warn: "#fbbf24",
};

export function SiliconActivity() {
  const { pipeline } = useAgentData();
  const [clearedSession, setClearedSession] = useState<string | null>(null);
  const runId = pipeline?.runId ?? null;
  const isCleared = Boolean(clearedSession && (clearedSession === runId || clearedSession === "all"));
  const rawFeed = pipeline?.feed ?? [];
  const feed = isCleared || !pipeline ? [] : [...rawFeed].reverse();

  // Reset clear lock if a different run starts or is loaded
  useEffect(() => {
    if (clearedSession && clearedSession !== "all" && runId && clearedSession !== runId) {
      setClearedSession(null);
    }
  }, [runId, clearedSession]);

  // Listen for deletions from the history card
  useEffect(() => {
    const onDeleted = (e: Event) => {
      const deletedId = (e as CustomEvent<{ runId: string }>).detail?.runId;
      if (!deletedId || !runId || runId === deletedId) {
        setClearedSession(runId ?? "all");
      }
    };
    window.addEventListener("silicon-run-deleted", onDeleted);
    return () => window.removeEventListener("silicon-run-deleted", onDeleted);
  }, [runId]);

  return (
    <div className="si-card">
      <div style={{ display: "flex", alignItems: "baseline", marginBottom: 6 }}>
        <span style={{ fontSize: 10, letterSpacing: "0.12em", color: "rgba(255,255,255,0.4)" }}>ACTIVIDAD</span>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
          {feed.length > 0 && (
            <span style={{ fontSize: 10, color: "rgba(255,255,255,0.3)" }}>
              {feed.length} eventos
            </span>
          )}
          {rawFeed.length > 0 && !isCleared && (
            <button
              type="button"
              className="si-link"
              onClick={() => setClearedSession(runId ?? "all")}
              title="Limpiar eventos de actividad en pantalla"
              style={{
                marginTop: 0,
                fontSize: 10,
                color: "rgba(255,255,255,0.35)",
                cursor: "pointer",
                padding: "0 2px",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.color = "#fbbf24"; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = "rgba(255,255,255,0.35)"; }}
            >
              limpiar
            </button>
          )}
        </div>
      </div>
      <div
        id="silicon-feed"
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 3,
          maxHeight: 200,
          overflowY: "auto",
          scrollbarWidth: "thin",
          scrollbarColor: "rgba(255,255,255,0.2) transparent",
          paddingRight: 2,
        }}
      >
        {feed.length === 0 && <span style={{ fontSize: 11, color: "rgba(255,255,255,0.3)" }}>—</span>}
        {feed.map((f, i) => {
          const meta = ROLES.find((r) => r.role === f.role);
          return (
            <div key={`${f.ts}-${i}`} style={{ fontSize: 10.5, display: "flex", gap: 6, lineHeight: 1.4 }}>
              <span style={{ color: `rgb(${meta?.rgb ?? "255,255,255"})`, flexShrink: 0, minWidth: 66 }}>
                {meta?.name}
              </span>
              <span style={{ color: FEED_COLOR[f.kind], wordBreak: "break-word" }}>{f.text}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
