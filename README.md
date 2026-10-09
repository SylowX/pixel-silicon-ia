# Pixel Agents + SiliconIA ⚡

![SiliconIA - Agentes de IA diseñan chips](./Siliconia_%20agentes%20de%20IA%20dise%C3%B1an%20chips.png)

Real-time pixel art visualization and control dashboard for the **SiliconIA Autonomous Semiconductor Design Factory**.

This project converts natural-language hardware specifications (*Prompts*) into fabricated-ready physical silicon layouts (**GDSII / ODB**), providing a retro pixel art monitoring cockpit where AI agents sit at animated desks and execute the complete chip development lifecycle.

> Base visualizer: [Vasyl Pavlyuchok](https://vasylpavlyuchok.com) · Sprites by [pablodelucca](https://github.com/pablodelucca/pixel-agents) (MIT)  
> Integrated with SiliconIA: Multi-agent chip design factory powered by LLMs + OpenROAD + SkyWater Sky130 PDK.

---

![Pixel Agents preview](public/pixel-agents-office-v2.webp)

## 🌟 What This Project Does

- **Real-Time Silicon Telemetry**: Visualizes the LangGraph multi-agent network in [CoreSmith](SiliconIA/coresmith-main) and the backend physical flow in [OpenROAD](SiliconIA/OpenROAD-flow-scripts-master).
- **6 Specialized AI Engineering Desks**: Each animated workstation corresponds to a key role in the semiconductor design team:
  - 🟡 **Seat 0 · Supervisor (`supervisor`)**: Orchestrates the entire pipeline, validates the Sky130 PDK, and handles block decomposition and report synthesis.
  - 🟣 **Seat 1 · Architect (`architect`)**: Writes the Product Requirements Document (PRD), system block diagrams, and uArch specifications.
  - 🔵 **Seat 2 · RTL Coder (`rtl`)**: Generates synthesizable Verilog-2005 code, runs Verilator linting, and iteratively diagnoses syntax/logic failures.
  - 🟢 **Seat 3 · Verification / DV (`dv`)**: Creates Python testbenches (`cocotb`), simulates module behavior, and verifies functional coverage.
  - 🌸 **Seat 4 · Synthesis (`synth`)**: Synthesizes RTL with **Yosys** into `sky130_fd_sc_hd` standard gate-level netlists.
  - 🟣 **Seat 5 · Place & Route (`pnr`)**: Implements physical silicon layout with **OpenROAD** (Floorplan, Placement, CTS, Routing, and GDSII generation).
- **Live Hardware Metrics Board (`SiliconBoard`)**: Displays step-by-step checklist progress, 10 physical pipeline stages, and tapeout metrics extracted from OpenROAD logs:
  - Die / Design Area (µm²)
  - Core Utilization %
  - Estimated Power Consumption (mW / µW)
  - Standard Cell Count
- **Provider-Agnostic LLM Failover & Saturation Resilience**: Instant, hot fallback mechanism configured in `pipeline_config.yaml`. If a model encounters capacity/rate limits (HTTP 429, 503, 529, or "at capacity"), it switches immediately to the next backup model in `fallback_models` while placing the saturated model in cooldown (`model_cooldown_s`). Can be overridden without touching configs via `SILICONIA_LLM_PROVIDER`, `SILICONIA_LLM_MODEL`, and `SILICONIA_LLM_FALLBACKS`.
- **Cocotb 2.x & Verilator 5.036 Functional Verification**: Pre-compiled custom Docker container with native Python testbench simulation, enabling full functional testing and code coverage before gate-level logic synthesis.
- **Interactive Multi-Floor Pixel Art Office (`OfficeCanvas`)**:
  - **Work vs. Rest Dynamics**: While a circuit is in design, agents actively operate in *Desarrollo* (Development) or the *Server Room* racks. When all tasks complete (100%) or during idle states, agents naturally move to relax on the *Terrace*, visit the *Lobby* café, or gather in the *Meeting Room*.
  - **Multi-Seat Conference Room**: Up to 4 agents can sit and collaborate simultaneously around the glass meeting room table.
  - **Collision & Overlap Prevention**: Exclusive chair booking (`claimedSlots`) and intelligent roaming prevent sprites from stacking on top of each other.
  - **Crystal Clear Pool Terrace**: Removed artificial blur and overlay artifacts from the swimming pool area.
- **Voice-Enabled Circuit Composer (`SiliconComposer`)**: Bottom expandable dock to describe circuits in natural language, featuring **voice dictation** (Web Speech API), preset prompt examples, and an auto-approve trigger.
- **Native Physical Layout GUI (`SiliconGui`)**: Launches the containerized **OpenROAD GUI** via WSLg (`/tmp/.X11-unix`) to visually inspect metal layers, standard cell placement, and wire routing.
- **Run Management, Live Activity & Instant Abort**: Chronological design history, run deletion with live telemetry and Activity feed purging, emergency stop button with instant 0% reset, and Docker engine health indicators.
- **Dual Mode**: Streams SiliconIA chip runs (default) or connects to local Claude Code sessions via Server-Sent Events (SSE).

---

## 🛠️ Prerequisites

1. **Node.js 18+** installed.
2. **Docker Desktop** (required to run or build the SiliconIA EDA pipeline and OpenROAD GUI).
3. **WSL2 with WSLg support** (optional, for viewing the interactive OpenROAD GUI on Windows).

---

## 🚀 Quick Start

### Option 1: 1-Click Windows Launcher
Double-click [iniciar.bat](iniciar.bat) in the project root directory.  
It will:
1. Check for Node.js and automatically run `npm install` if dependencies are missing.
2. Configure environment variables for `silicon-runs`.
3. Launch the web server on **port 3031**.
4. Automatically open your browser at `http://localhost:3031/pixel-agents`.

### Option 2: Manual Terminal Start
```powershell
# 1. Install dependencies
npm install

# 2. Start the dev server on port 3031
npm run dev -- -p 3031
```
Open your browser at:  
👉 **`http://localhost:3031/pixel-agents`**

---

## 💡 Designing a Circuit

### From the Web UI
1. Click the **"NUEVO CIRCUITO"** dock at the bottom of the page (or click the microphone 🎙️ button to dictate).
2. Type or dictate your hardware specification (e.g., *"Design an 8-bit ALU supporting addition, subtraction, AND, OR, and XOR"*).
3. Click **"Lanzar a silicio"** (Launch). The supervisor and engineering team will start working immediately.

### From the Command Line (PowerShell)
You can also launch the pipeline directly from PowerShell:
```powershell
cd SiliconIA
.\run_pipeline.ps1 "Design a 32-bit adder with carry lookahead" -AutoApprove
```

To open the physical layout viewer of the latest run:
```powershell
.\run_pipeline.ps1 -ShowGUI
```

---

## 📁 Project Structure

```
pixel-agents-main/
├── iniciar.bat                       ← 1-click Windows launcher (Port 3031)
├── PROJECT_MEMORY.md                 ← Technical architecture & memory document
├── AGENTS.md                         ← Antigravity agent configuration and rules
├── SiliconIA/                        ← Semiconductor design factory
│   ├── pipeline_config.yaml          ← Centralized LLM model & fallback configuration
│   ├── run_pipeline.ps1              ← Docker container launcher script
│   ├── silicon_pipeline.py           ← Multi-agent Python orchestrator
│   ├── Dockerfile                    ← Unified EDA image (Verilator 5 + Yosys + OpenROAD + Sky130)
│   ├── coresmith-main/               ← Multi-agent network & LLM fallback orchestrator
│   └── silicon-runs/                 ← Output directories, netlists, ODB & GDSII
├── src/
│   ├── app/
│   │   ├── api/pixel-agents/
│   │   │   ├── silicon-stream/       ← SSE event streaming endpoint
│   │   │   ├── silicon-launch/       ← Safe pipeline launcher & abort endpoint
│   │   │   ├── silicon-gui/          ← WSLg OpenROAD GUI runner
│   │   │   └── silicon-runs/         ← Historical run metrics & deletion API
│   │   └── pixel-agents/
│   │       ├── page.tsx              ← 3-column layout (Board · Office · Sidebar)
│   │       ├── SiliconBoard.tsx      ← Agent checklist, stage cards & silicon metrics
│   │       ├── SiliconComposer.tsx   ← Bottom natural-language prompt dock
│   │       ├── SiliconSidebar.tsx    ← Run history, Docker health & live log
│   │       ├── SiliconActivity.tsx   ← Live activity & pipeline event feed
│   │       ├── DeskCanvas.tsx        ← 6-desk animated canvas
│   │       └── OfficeCanvas.tsx      ← Interactive multi-floor pixel art office
│   └── lib/
│       ├── siliconia.ts              ← Telemetry parser, metric extraction & types
│       └── localGuard.ts             ← Loopback security guard for local actions
```

---

## 📜 Credits & License

- **Pixel Agents**: MIT License © Vasyl Pavlyuchok.
- **Sprites**: [pablodelucca/pixel-agents](https://github.com/pablodelucca/pixel-agents) (MIT).
- **SiliconIA Pipeline**: Integrates open-source EDA tooling (OpenROAD, Yosys, Verilator, Cocotb, and SkyWater Sky130 PDK).

---

[Versión en Español](README.es.md)
