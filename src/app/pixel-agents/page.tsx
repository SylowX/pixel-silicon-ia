"use client";

import { useEffect, useState } from "react";
import { useAgentData } from "./AgentDataContext";
import { DeskCanvas } from "./DeskCanvas";
import { OfficeCanvas } from "./OfficeCanvas";
import { SiliconRunBar } from "./SiliconRunBar";
import { SiliconBoard } from "./SiliconBoard";
import { SiliconSidebar } from "./SiliconSidebar";
import { SiliconComposer } from "./SiliconComposer";
import logo from "../../assets/logob.png";

export default function PixelAgentsPage() {
  const { connected, activeSessionId, agents, source } = useAgentData();
  const [broadcastOn, setBroadcastOn] = useState(false);
  const [toggling, setToggling] = useState(false);

  useEffect(() => {
    fetch("/api/pixel-agents/broadcast")
      .then((r) => r.json())
      .then((cfg) => { setBroadcastOn(cfg.broadcast); })
      .catch(() => {});
  }, []);

  async function postBroadcast(patch: { broadcast?: boolean }) {
    setToggling(true);
    try {
      const res = await fetch("/api/pixel-agents/broadcast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const cfg = await res.json();
      setBroadcastOn(cfg.broadcast);
    } finally {
      setToggling(false);
    }
  }

  const main = (
    <div style={{ maxWidth: 1280, margin: "0 auto", padding: source === "siliconia" ? "0" : "24px 16px", minWidth: 0 }}>
      {/* Status bar */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16, fontFamily: "monospace" }}>
        <span style={{ fontSize: 11, display: "flex", alignItems: "center", gap: 6, color: connected ? "#34d399" : "rgba(255,255,255,0.25)" }}>
          <span style={{ display: "inline-block", width: 6, height: 6, borderRadius: "50%", background: connected ? "#34d399" : "rgba(255,255,255,0.2)" }} />
          {connected ? "LIVE" : "offline"}
        </span>
        {activeSessionId && (
          <span style={{ fontSize: 11, color: "rgba(255,255,255,0.2)" }}>
            session {activeSessionId.slice(0, 8)}
          </span>
        )}
        <span style={{ fontSize: 11, color: "rgba(255,255,255,0.15)" }}>
          {agents.size} agent{agents.size !== 1 ? "s" : ""}
        </span>

        {/* Broadcast toggle */}
        <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", userSelect: "none", marginLeft: "auto" }}
          onClick={() => !toggling && postBroadcast({ broadcast: !broadcastOn })}>
          <span style={{ fontSize: 11, color: "rgba(255,255,255,0.3)" }}>Public</span>
          <div style={{ position: "relative", width: 28, height: 14, borderRadius: 7, background: broadcastOn ? "rgba(52,211,153,0.8)" : "rgba(255,255,255,0.15)", transition: "background 0.2s" }}>
            <span style={{ position: "absolute", top: 2, left: broadcastOn ? 14 : 2, width: 10, height: 10, borderRadius: "50%", background: "#fff", transition: "left 0.2s", boxShadow: "0 1px 2px rgba(0,0,0,0.4)" }} />
          </div>
          {broadcastOn && (
            <span style={{ fontSize: 9, padding: "2px 6px", borderRadius: 9999, border: "1px solid rgba(52,211,153,0.3)", color: "#34d399", background: "rgba(52,211,153,0.1)", fontFamily: "monospace" }}>
              ● LIVE
            </span>
          )}
        </label>
      </div>

      {source === "siliconia" && <SiliconRunBar />}

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <DeskCanvas />
        <div style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }} />
        <OfficeCanvas />
      </div>

      {/* Bottom-center "describe your circuit" bar; unfolds upward on click */}
      {source === "siliconia" && <SiliconComposer />}
    </div>
  );

  if (source !== "siliconia") return main;

  // SiliconIA: progress board (left) · pixel office + composer (center) · history/environment (right)
  return (
    <div className="si-shell">
      <div className="si-side si-side-left"><SiliconBoard /></div>
      <div className="si-main">{main}</div>
      <div className="si-side si-side-right"><SiliconSidebar /></div>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={logo.src} alt="Logo" id="silicon-logo" className="si-logo" />
    </div>
  );
}
