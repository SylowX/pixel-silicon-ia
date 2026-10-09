#!/usr/bin/env python3
# =============================================================================
# SiliconIA Pipeline Orchestrator
# Prompt → CoreSmith → OpenROAD-flow-scripts → Sky130 → OpenROAD GUI
#
# This script is the integration layer that connects:
#   1. CoreSmith    — interprets natural language, generates RTL
#   2. ORFS         — runs physical design flow (synth → PnR)
#   3. Sky130 PDK   — provides standard cells & tech rules
#   4. OpenROAD GUI — visualizes the physical layout
#
# Usage:
#   python3 silicon_pipeline.py "Design a 32-bit adder"
#   python3 silicon_pipeline.py --interactive
#   python3 silicon_pipeline.py --prompt-file spec.md
# =============================================================================

from __future__ import annotations

import argparse
import asyncio
import json
import os
import re
import shutil
import subprocess
import sys
import textwrap
import time
import unicodedata
from datetime import datetime
from pathlib import Path
from typing import Any, Optional

import yaml

# =============================================================================
# Constants
# =============================================================================

SCRIPT_DIR = Path(__file__).resolve().parent
CONFIG_PATH = SCRIPT_DIR / "pipeline_config.yaml"

BANNER = r"""
╔═══════════════════════════════════════════════════════════════════════╗
║                                                                       ║
║   ███████╗██╗██╗     ██╗ ██████╗ ██████╗ ███╗   ██╗██╗ █████╗        ║
║   ██╔════╝██║██║     ██║██╔════╝██╔═══██╗████╗  ██║██║██╔══██╗       ║
║   ███████╗██║██║     ██║██║     ██║   ██║██╔██╗ ██║██║███████║       ║
║   ╚════██║██║██║     ██║██║     ██║   ██║██║╚██╗██║██║██╔══██║       ║
║   ███████║██║███████╗██║╚██████╗╚██████╔╝██║ ╚████║██║██║  ██║       ║
║   ╚══════╝╚═╝╚══════╝╚═╝ ╚═════╝ ╚═════╝ ╚═╝  ╚═══╝╚═╝╚═╝  ╚═╝       ║
║                                                                       ║
║   Prompt → CoreSmith → OpenROAD-flow-scripts → Sky130 → OpenROAD GUI ║
║                                                                       ║
╚═══════════════════════════════════════════════════════════════════════╝
"""

# ANSI colors
class C:
    CYAN    = "\033[96m"
    GREEN   = "\033[92m"
    YELLOW  = "\033[93m"
    RED     = "\033[91m"
    MAGENTA = "\033[95m"
    BOLD    = "\033[1m"
    RESET   = "\033[0m"


def log(msg: str, color: str = C.RESET):
    print(f"{color}{msg}{C.RESET}", flush=True)


def log_phase(phase: str, description: str):
    log(f"\n{'='*70}", C.CYAN)
    log(f"  ⚡ Phase: {phase}", C.BOLD + C.CYAN)
    log(f"  {description}", C.CYAN)
    log(f"{'='*70}", C.CYAN)


def log_step(step: str, status: str = "running"):
    icons = {"running": "🔄", "done": "✅", "error": "❌", "skip": "⏭️", "wait": "⏳"}
    icon = icons.get(status, "▶️")
    log(f"  {icon} {step}", C.GREEN if status == "done" else C.YELLOW)


# =============================================================================
# Telemetry — live event feed for external visualizers (pixel-agents)
# =============================================================================
#
# Events are appended to <run_dir>/siliconia_events.jsonl using the same
# record shape as CoreSmith's .coresmith/pipeline_events.jsonl
# ({ts, iso, pid, event, node, ...}). A separate file is used on purpose so
# that CoreSmith's own readers (daemon orphan recovery, webview) never see
# foreign records. Visualizers merge both files by `ts`.
#
# <runs_dir>/current_run.json points at the active run (symlinks are not
# reliable on Windows bind mounts).
#
# Event types emitted:
#   silicon_pipeline_start / silicon_pipeline_end
#   silicon_phase_enter / silicon_phase_exit     (phase: pdk|coresmith|orfs|gui)
#   silicon_stage_enter / silicon_stage_exit     (ORFS stage: synth..finish)
#   silicon_step                                 (notable orchestrator actions)
#   silicon_interrupt                            (CoreSmith human-in-the-loop)
#   silicon_metrics                              (area, utilization, power...)
#
# Telemetry must never break the pipeline: every write is best-effort.

class Telemetry:
    EVENTS_FILE = "siliconia_events.jsonl"
    CURRENT_FILE = "current_run.json"

    def __init__(self):
        self.run_dir: Optional[Path] = None
        self.runs_base: Optional[Path] = None
        self._current: dict = {}

    def bind(self, run_dir: Path, runs_base: Path, prompt: str):
        self.run_dir = run_dir
        self.runs_base = runs_base
        now = datetime.now().isoformat()
        self._current = {
            "run_id": run_dir.name,
            "run_dir": str(run_dir),
            "prompt": prompt[:500],
            "status": "running",
            "phase": None,
            "started_at": now,
            "updated_at": now,
            "pid": os.getpid(),
        }
        self._write_current()

    def emit(self, event: str, node: str = "SiliconIA", **data):
        if self.run_dir is None:
            return
        ts = time.time()
        record = {
            "ts": ts,
            "iso": time.strftime("%Y-%m-%dT%H:%M:%S", time.gmtime(ts)),
            "pid": os.getpid(),
            "event": event,
            "node": node,
            "source": "siliconia",
            **data,
        }
        try:
            with open(self.run_dir / self.EVENTS_FILE, "a", encoding="utf-8") as fh:
                fh.write(json.dumps(record, default=str) + "\n")
        except Exception:
            pass
        if event == "silicon_phase_enter":
            self.update_current(phase=data.get("phase"))

    def update_current(self, **fields):
        if self.runs_base is None:
            return
        self._current.update(fields)
        self._current["updated_at"] = datetime.now().isoformat()
        self._write_current()

    def _write_current(self):
        try:
            target = self.runs_base / self.CURRENT_FILE
            tmp = target.with_suffix(".json.tmp")
            tmp.write_text(json.dumps(self._current, indent=2, default=str), encoding="utf-8")
            os.replace(tmp, target)
        except Exception:
            pass


TELEMETRY = Telemetry()


def parse_orfs_metrics(log_files: list[Path]) -> dict:
    """Best-effort extraction of physical-design metrics from ORFS logs.

    Later logs override earlier ones, so pass them in flow order.
    """
    metrics: dict = {}
    for lf in log_files:
        try:
            text = Path(lf).read_text(errors="ignore")
        except Exception:
            continue
        for m in re.finditer(r"Design area\s+([\d.]+)\s+um?\^2\s+([\d.]+)%\s+utilization", text):
            metrics["design_area_um2"] = float(m.group(1))
            metrics["utilization_pct"] = float(m.group(2))
        m = re.search(r"Total power\s*:\s*([\d.eE+\-]+)\s*W", text)
        if m:
            metrics["total_power_w"] = float(m.group(1))
        m = re.search(r"^\s*Total\s+(\d+)\s+([\d.]+)\s*$", text, re.MULTILINE)
        if m:
            metrics["cell_count"] = int(m.group(1))
            metrics["cell_area_um2"] = float(m.group(2))
        for kind in ("tns", "wns"):
            hits = re.findall(rf"^\s*{kind}(?:\s+max)?\s+(-?\d+(?:\.\d+)?)\s*$", text, re.MULTILINE)
            if hits:
                metrics[kind] = float(hits[-1])
    return metrics


# =============================================================================
# Configuration
# =============================================================================

def load_config() -> dict:
    """Load pipeline configuration from YAML."""
    if CONFIG_PATH.exists():
        with open(CONFIG_PATH) as f:
            return yaml.safe_load(f)
    # Fallback defaults
    return {
        "container": {
            "coresmith": "/workspace/coresmith-main",
            "openroad_flow_scripts": "/workspace/OpenROAD-flow-scripts-master",
            "openroad": "/workspace/OpenROAD-master",
            "pdk_root": "/usr/share/pdk",
            "runs_dir": "/workspace/silicon-runs",
        },
        "pdk": {
            "name": "sky130",
            "variant": "sky130A",
            "std_cell_library": "sky130_fd_sc_hd",
            "target_clock_mhz": 50,
        },
        "orfs": {
            "platform": "sky130hd",
            "core_utilization": 40,
            "target_density": 0.6,
        },
        "llm": {
            "provider": "codex",
            "model": "gpt-5.6-sol",
            "fallback_models": ["gpt-5.6-terra", "gpt-5.6", "gpt-5.5"],
            "model_cooldown_s": 300,
            "isolate_workdir": False,
        },
    }


# =============================================================================
# Phase 1: CoreSmith — Prompt → Architecture → RTL → Verification → Netlist
# =============================================================================

class CoreSmithPhase:
    """Drives CoreSmith to generate RTL from a natural language prompt."""

    def __init__(self, config: dict, run_dir: Path):
        self.config = config
        self.run_dir = run_dir
        self.coresmith_dir = Path(config["container"]["coresmith"])
        self.coresmith_bin = self.coresmith_dir / "bin" / "coresmith"

    def create_requirements(self, prompt: str) -> Path:
        """Write the user prompt as a requirements.md file."""
        inputs_dir = self.run_dir / "inputs"
        inputs_dir.mkdir(parents=True, exist_ok=True)
        req_path = inputs_dir / "requirements.md"
        req_path.write_text(
            f"# Design Requirements\n\n{prompt}\n\n"
            f"## Constraints\n"
            f"- Target PDK: SkyWater Sky130 (130nm)\n"
            f"- Standard Cell Library: sky130_fd_sc_hd\n"
            f"- Target Clock: {self.config['pdk']['target_clock_mhz']} MHz\n"
            f"- No tri-state buffers, no async resets, no latches\n"
            f"- Verilog-2005 compliant RTL\n"
            f"- Synthesizable with Yosys\n"
        )
        return req_path

    # Per-provider env var that pins the model (CoreSmith reads it first).
    _PROVIDER_MODEL_ENV = {
        "codex": "CORESMITH_CODEX_MODEL", "codex_cli": "CORESMITH_CODEX_MODEL",
        "kimi": "CORESMITH_KIMI_MODEL", "kimi_cli": "CORESMITH_KIMI_MODEL",
        "agy": "CORESMITH_AGY_MODEL", "agy_cli": "CORESMITH_AGY_MODEL",
        "opencode": "CORESMITH_OPENCODE_MODEL", "opencode_cli": "CORESMITH_OPENCODE_MODEL",
    }

    def setup_environment(self):
        """Set environment variables for CoreSmith.

        Provider-agnostic: `llm.model` is the primary model and
        `llm.fallback_models` the chain CoreSmith fails over to when a model
        reports capacity / rate-limit errors ("model fatigue"). Host env vars
        SILICONIA_LLM_PROVIDER / SILICONIA_LLM_MODEL / SILICONIA_LLM_FALLBACKS
        override the YAML without editing it.
        """
        env = os.environ.copy()
        llm_cfg = self.config.get("llm", {}) or {}

        provider = (os.environ.get("SILICONIA_LLM_PROVIDER") or llm_cfg.get("provider") or "codex").strip()
        model = (os.environ.get("SILICONIA_LLM_MODEL") or llm_cfg.get("model")
                 or llm_cfg.get("codex_model") or "gpt-5.6-sol").strip()
        block_model = (os.environ.get("SILICONIA_LLM_MODEL") or llm_cfg.get("block_model") or model).strip()
        fallbacks = os.environ.get("SILICONIA_LLM_FALLBACKS")
        if fallbacks is None:
            raw = llm_cfg.get("fallback_models") or []
            fallbacks = ",".join(raw) if isinstance(raw, (list, tuple)) else str(raw)
        fallbacks = ",".join(m.strip() for m in fallbacks.replace(";", ",").split(",")
                             if m.strip() and m.strip() != model)

        env["CORESMITH_PROJECT_ROOT"] = str(self.run_dir)
        env["CORESMITH_LLM_PROVIDER"] = provider
        env["CORESMITH_MODEL"] = model
        env["CORESMITH_BLOCK_MODEL"] = block_model
        for var in set(self._PROVIDER_MODEL_ENV.values()):
            env.pop(var, None)  # drop stale pins from Dockerfile / docker -e
        pin_var = self._PROVIDER_MODEL_ENV.get(provider.lower())
        if pin_var:
            env[pin_var] = model
        env["CORESMITH_MODEL_FALLBACKS"] = fallbacks
        env["CORESMITH_MODEL_COOLDOWN_S"] = str(llm_cfg.get("model_cooldown_s", 300))
        if llm_cfg.get("reasoning_effort"):
            env["CORESMITH_CODEX_REASONING_EFFORT"] = str(llm_cfg["reasoning_effort"])
        # Run the agent CLI inside the run dir instead of an empty codex-call-*
        # scratch dir: relative paths (rtl/..., tb/...) then resolve and the
        # agent stops "losing" the files it writes.
        env["CORESMITH_CODEX_ISOLATE_WORKDIR"] = "1" if llm_cfg.get("isolate_workdir", False) else "0"
        env["CORESMITH_CODEX_SANDBOX"] = llm_cfg.get("codex_sandbox", "danger-full-access")
        log_step(f"LLM: {provider} · modelo {model}"
                 + (f" · respaldo {fallbacks.replace(',', ' → ')}" if fallbacks else " · sin respaldo"), "done")
        env["CORESMITH_ENABLE_MEMORY_MAP"] = "0"
        env["CORESMITH_ENABLE_CLOCK_TREE"] = "0"
        env["CORESMITH_ENABLE_REGISTER_SPEC"] = "0"
        env["CORESMITH_ALLOW_NO_OPENRAM"] = "1"
        env["PDK_ROOT"] = "/usr/share/pdk"

        # Ensure Verilator shim is active: delegates to /opt/verilator (5.036, required by
        # cocotb 2.x); falls back to apt Verilator 4.038 stripping -Wno-EOFNEWLINE.
        shim_source = Path("/workspace/verilator_shim.sh")
        shim_target = Path("/usr/local/bin/verilator")
        if shim_source.exists():
            try:
                shim_target.write_text(shim_source.read_text())
                shim_target.chmod(0o755)
            except Exception:
                pass

        return env

    def start_daemon(self, env: dict, timeout_s: float = 90.0) -> subprocess.Popen:
        """Start the coresmithd daemon and wait until it is reachable.

        `coresmith daemon start` spawns the server and polls for
        .coresmith/daemon.json for ~10 s. On Docker Desktop for Windows the
        workspace is a slow bind mount and the first boot can take longer, so a
        fixed sleep raced with `run start` ("no daemon for <run>"). We wait for
        the CLI to return and then for daemon.json + an open port ourselves.
        """
        log_step("Starting CoreSmith daemon...")
        cmd = [
            str(self.coresmith_bin), "daemon", "start",
            "--project-root", str(self.run_dir)
        ]
        proc = subprocess.Popen(
            cmd, env=env, cwd=str(self.coresmith_dir),
            stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True,
        )
        try:
            out, err = proc.communicate(timeout=timeout_s)
        except subprocess.TimeoutExpired:
            out, err = "", "daemon start CLI timed out"
        daemon_file = self.run_dir / ".coresmith" / "daemon.json"
        deadline = time.time() + timeout_s
        port = None
        while time.time() < deadline:
            if daemon_file.exists():
                try:
                    port = int(json.loads(daemon_file.read_text()).get("port", 0)) or None
                except (ValueError, OSError):
                    port = None
                if port:
                    try:
                        import socket
                        with socket.create_connection(("127.0.0.1", port), timeout=2):
                            break
                    except OSError:
                        pass
            time.sleep(0.5)
        else:
            log(f"  daemon start output: {(out or '')[-300:]} {(err or '')[-500:]}", C.RED)
            raise RuntimeError(f"CoreSmith daemon not reachable after {timeout_s:.0f}s "
                               f"(see {self.run_dir / '.coresmith' / 'daemon.log'})")
        log_step(f"CoreSmith daemon started (port {port})", "done")
        return proc

    def run_architecture(self, env: dict, req_path: Path) -> bool:
        """Run the architecture phase."""
        log_step("Running Architecture phase (PRD → Block Diagram → Specs)...")
        cmd = [
            str(self.coresmith_bin), "architecture", "start",
            "--project-root", str(self.run_dir),
            "--requirements", str(req_path),
        ]
        result = subprocess.run(
            cmd, env=env, cwd=str(self.coresmith_dir),
            capture_output=True, text=True, timeout=600,
        )
        if result.returncode != 0:
            log(f"  Architecture start returned error: {result.stderr[:500]}", C.RED)
            return False
        log_step("Architecture phase initiated", "done")
        return True

    # Spanish → English design vocabulary, so prompts dictated in Spanish still map to a sane module name.
    _ES_ALIASES = {
        "sumador": "adder", "restador": "subtractor", "multiplicador": "multiplier",
        "divisor": "divider", "contador": "counter", "registro": "regfile",
        "decodificador": "decoder", "codificador": "encoder", "temporizador": "timer",
        "arbitro": "arbiter", "comparador": "comparator", "multiplexor": "mux",
        "desplazador": "shifter", "memoria": "memory", "maquina de estados": "fsm",
    }
    _ES_STOPWORDS = {
        "disena", "diseno", "disenar", "un", "una", "unos", "unas", "el", "la", "los", "las", "de", "del",
        "con", "y", "o", "en", "para", "por", "que", "quiero", "necesito", "crear", "crea", "construye",
        "implementa", "circuito", "modulo", "bits", "bit", "entrada", "salida", "al", "se", "su", "mi",
    }

    @staticmethod
    def _strip_accents(text: str) -> str:
        return "".join(c for c in unicodedata.normalize("NFD", text) if unicodedata.category(c) != "Mn")

    def generate_blocks_yaml(self, prompt: str) -> Path:
        """Create a targeted blocks.yaml for the design specification."""
        p_lower = self._strip_accents(prompt.lower())
        for es, en in self._ES_ALIASES.items():
            p_lower = re.sub(rf'\b{es}(?:es|s)?\b', en, p_lower)
        candidates = [
            "alu", "adder", "multiplier", "mac", "counter", "uart", "spi", "fsm",
            "fifo", "regfile", "shifter", "barrel_shifter", "pwm", "timer", "gpio",
            "decoder", "encoder", "arbiter", "crc", "aes", "sha256", "divider"
        ]
        mod_name = None
        for candidate in candidates:
            if candidate in p_lower:
                bits_match = re.search(r'(\d+)\s*-?\s*bit', p_lower)
                suffix = bits_match.group(1) if bits_match else ("32" if "32" in p_lower else "")
                mod_name = f"{candidate}{suffix}" if suffix and not candidate.endswith(suffix) else candidate
                break

        if not mod_name:
            words = re.findall(r'[a-zA-Z0-9]+', p_lower)
            ignore = {"design", "a", "an", "the", "with", "and", "or", "in", "for", "of", "to", "build", "create", "implement"}
            ignore |= self._ES_STOPWORDS
            filtered = [w for w in words if w not in ignore and not w.isdigit()] or [w for w in words if w not in ignore]
            mod_name = "_".join(filtered[:2]) if filtered else "core_module"
            if not re.match(r'[a-z_]', mod_name):
                mod_name = f"blk_{mod_name}"

        description = prompt.strip().replace("\n", "\n      ")

        blocks_file = self.run_dir / "blocks.yaml"
        target_clock = self.config.get("pdk", {}).get("target_clock_mhz", 50)
        content = f"""blocks:
  {mod_name}:
    tier: 1
    rtl_target: "rtl/{mod_name}/{mod_name}.v"
    testbench: "tb/cocotb/test_{mod_name}.py"
    description: |
      {description}

      Requirements & Constraints:
      - Target PDK: SkyWater Sky130 (130nm) with sky130_fd_sc_hd
      - Clock Frequency: {target_clock} MHz
      - Verilog-2005 compliant synthesizable RTL
      - Synchronous active-low reset (rst_n) when stateful; combinational if no memory/registers required
      - No tri-state buffers, no async resets, no latches
      - Synthesizable with Yosys
"""
        blocks_file.write_text(content)
        log_step(f"Generated target block specification: {mod_name} ({blocks_file.name})", "done")
        return blocks_file

    def run_frontend(self, env: dict, blocks_file: Optional[Path] = None) -> bool:
        """Run the frontend pipeline (RTL generation + verification + synthesis)."""
        log_step("Running Frontend pipeline (RTL → Verify → Synthesize)...")
        cmd = [
            str(self.coresmith_bin), "run", "start",
            "--project-root", str(self.run_dir),
        ]
        if blocks_file and blocks_file.exists():
            cmd.extend(["--blocks-file", str(blocks_file)])

        result = subprocess.run(
            cmd, env=env, cwd=str(self.coresmith_dir),
            capture_output=True, text=True, timeout=60,
        )
        if result.returncode != 0:
            log(f"  Frontend start returned error: {result.stderr[:500]}", C.RED)
            return False
        log_step("Frontend pipeline initiated", "done")
        return True

    def get_state(self, env: dict) -> dict:
        """Get current pipeline state."""
        cmd = [
            str(self.coresmith_bin), "state",
            "--project-root", str(self.run_dir),
        ]
        result = subprocess.run(
            cmd, env=env, cwd=str(self.coresmith_dir),
            capture_output=True, text=True, timeout=30,
        )
        try:
            return json.loads(result.stdout)
        except (json.JSONDecodeError, ValueError):
            return {"status": "unknown", "raw": result.stdout[:200]}

    def resume(self, env: dict, action: str = "approve", **kwargs):
        """Resume the pipeline from an interrupt."""
        cmd = [
            str(self.coresmith_bin), "resume",
            "--project-root", str(self.run_dir),
            "--action", action,
        ]
        for k, v in kwargs.items():
            cmd.extend([f"--{k.replace('_', '-')}", str(v)])

        result = subprocess.run(
            cmd, env=env, cwd=str(self.coresmith_dir),
            capture_output=True, text=True, timeout=30,
        )
        return result.returncode == 0

    def wait_and_drive(self, env: dict, auto_approve: bool = False,
                       timeout: int = 3600) -> bool:
        """Wait for pipeline completion, streaming live LLM events and auto-approving.

        Returns True if the pipeline completed successfully (or produced RTL
        despite a non-fatal error), False only if nothing useful was generated.
        """
        events_file = self.run_dir / ".coresmith" / "pipeline_events.jsonl"
        last_event_line = 0
        last_heartbeat_time = time.time()
        start_time = time.time()
        consecutive_unknown = 0  # Track consecutive 'unknown' state polls
        MAX_CONSECUTIVE_UNKNOWN = 12  # ~60s of unknown state before checking RTL

        while True:
            # 1. Stream live events from pipeline_events.jsonl
            if events_file.exists():
                try:
                    lines = events_file.read_text(encoding="utf-8", errors="ignore").splitlines()
                    if len(lines) > last_event_line:
                        for line in lines[last_event_line:]:
                            try:
                                ev = json.loads(line)
                                ev_type = ev.get("event")
                                node = ev.get("node", "")
                                if ev_type == "llm_start":
                                    run_name = ev.get("run_name", "agent")
                                    log_step(f"[LLM Start] {run_name} (model: {ev.get('model', 'codex')})", "running")
                                    last_heartbeat_time = time.time()
                                elif ev_type == "llm_call_heartbeat":
                                    elapsed = ev.get("elapsed_s", 0)
                                    log_step(f"[LLM Thinking] Elapsed {elapsed:.0f}s...", "running")
                                    last_heartbeat_time = time.time()
                                elif ev_type == "llm_end":
                                    log_step(f"[LLM Done] Generated {ev.get('output_chars', 0)} characters", "done")
                                    last_heartbeat_time = time.time()
                                elif ev_type == "llm_model_fallback":
                                    frm, to = ev.get("from_model", "?"), ev.get("to_model") or ""
                                    why = "saturado" if ev.get("reason") == "capacity" else "no disponible"
                                    if to:
                                        log(f"  ⚠️  [Modelo {why}] {frm} → cambiando a {to} "
                                            f"(enfriamiento {ev.get('cooldown_s', 0)}s)", C.MAGENTA)
                                    else:
                                        log(f"  ⚠️  [Modelo {why}] {frm} — todos los modelos de respaldo agotados; "
                                            f"CoreSmith reintentará con backoff", C.RED)
                                    last_heartbeat_time = time.time()
                                elif ev_type == "graph_node_enter":
                                    log_step(f"[Stage] Entering: {node}", "running")
                                    last_heartbeat_time = time.time()
                                elif ev_type == "graph_node_exit":
                                    status_ev = ev.get("status", "ok")
                                    log_step(f"[Stage] Completed: {node} ({status_ev})", "done")
                                    last_heartbeat_time = time.time()
                                elif ev_type == "graph_error":
                                    err_msg = ev.get("error", "unknown error")
                                    log_step(f"[Error] {node}: {err_msg[:200]}", "error")
                                    last_heartbeat_time = time.time()
                            except Exception:
                                pass
                        last_event_line = len(lines)
                except Exception:
                    pass

            # Timeout check (relative to last active event)
            if time.time() - last_heartbeat_time > timeout:
                log_step("CoreSmith pipeline timeout (no active progress for too long)", "error")
                # Even on timeout, check if we got partial RTL
                rtl_files = self.find_rtl_files()
                if rtl_files:
                    log_step(f"Timeout, but found {len(rtl_files)} RTL file(s) — continuing with partial results", "done")
                    return True
                return False

            state = self.get_state(env)
            status = state.get("status", "unknown")
            pending = state.get("pending_interrupt_count", 0)

            if status == "done":
                log_step("CoreSmith pipeline completed!", "done")
                return True
            elif status == "error":
                error_msg = state.get("error_message") or state.get("error", "?")
                log_step(f"CoreSmith pipeline error: {error_msg[:300]}", "error")
                # ── Graceful degradation: check if RTL was produced despite the error ──
                rtl_files = self.find_rtl_files()
                if rtl_files:
                    log_step(f"Error occurred, but found {len(rtl_files)} RTL file(s) — attempting to continue", "done")
                    log(f"  💡 The error may be non-fatal (e.g., lint warning loop or interrupt crash)", C.YELLOW)
                    return True
                return False
            elif status == "unknown":
                consecutive_unknown += 1
                if consecutive_unknown >= MAX_CONSECUTIVE_UNKNOWN:
                    # Pipeline state is unreachable — check if daemon crashed but left RTL
                    rtl_files = self.find_rtl_files()
                    if rtl_files:
                        log_step(f"Pipeline state unreachable, but found {len(rtl_files)} RTL file(s) — continuing", "done")
                        return True
                    log_step("Pipeline state unknown for too long and no RTL found", "error")
                    return False
            else:
                consecutive_unknown = 0

            if pending > 0 and auto_approve:
                log_step(f"Auto-approving interrupt ({pending} pending)...", "wait")
                interrupts = state.get("interrupts", [])
                TELEMETRY.emit("silicon_interrupt", node="Supervisor",
                               interrupt_type=(interrupts[0].get("type", "unknown") if interrupts else "unknown"),
                               pending=pending, action="auto_approve")
                self.resume(env, "approve")
            elif pending > 0:
                interrupts = state.get("interrupts", [])
                if interrupts:
                    itype = interrupts[0].get("type", "unknown")
                    TELEMETRY.emit("silicon_interrupt", node="Supervisor",
                                   interrupt_type=itype, pending=pending,
                                   action="waiting_human")
                    log_step(f"Pipeline paused: {itype} — waiting for decision", "wait")
                    log(f"\n  💡 Use: coresmith resume --action approve|retry|skip", C.MAGENTA)
                    log(f"  💡 Or re-run with --auto-approve", C.MAGENTA)
                    return False

            time.sleep(5)

    def find_netlist(self) -> tuple[Optional[Path], Optional[Path]]:
        """Find the synthesized netlist and SDC from CoreSmith output."""
        syn_dir = self.run_dir / "syn" / "output"
        if not syn_dir.exists():
            return None, None

        # Look for the top-level netlist
        for d in sorted(syn_dir.iterdir()):
            if d.is_dir():
                netlist = d / f"{d.name}_netlist.v"
                sdc = d / f"{d.name}.sdc"
                if netlist.exists():
                    return netlist, sdc if sdc.exists() else None

        # Fallback: any .v file in syn/output
        for v in syn_dir.rglob("*_netlist.v"):
            sdc = v.with_name(v.stem.replace("_netlist", "") + ".sdc")
            return v, sdc if sdc.exists() else None

        return None, None

    def find_rtl_files(self) -> list[Path]:
        """Find generated RTL files."""
        rtl_dir = self.run_dir / "rtl"
        if not rtl_dir.exists():
            return []
        return sorted(rtl_dir.rglob("*.v"))

    def execute(self, prompt: str, auto_approve: bool = False) -> dict:
        """Execute the full CoreSmith phase with robust error recovery.

        Even if CoreSmith crashes (e.g., LangGraph interrupt RuntimeError),
        we check for partial RTL output and continue if anything useful
        was produced.
        """
        log_phase("1: CoreSmith", "Prompt → Architecture → RTL → Verification → Netlist")

        # Step 1: Write requirements
        log_step("Writing design requirements...")
        req_path = self.create_requirements(prompt)
        log_step(f"Requirements: {req_path}", "done")
        TELEMETRY.emit("silicon_step", node="Supervisor", step="requirements_written",
                       path=str(req_path))

        # Step 2: Generate targeted blocks.yaml for the design
        blocks_file = self.generate_blocks_yaml(prompt)
        try:
            block_names = list((yaml.safe_load(blocks_file.read_text()) or {}).get("blocks", {}).keys())
        except Exception:
            block_names = []
        TELEMETRY.emit("silicon_step", node="Supervisor", step="blocks_generated",
                       blocks=block_names)

        # Step 3: Setup environment
        env = self.setup_environment()

        frontend_done = False
        phase_error = None

        try:
            # Step 4: Start daemon (waits until it is reachable)
            self.start_daemon(env)
            TELEMETRY.emit("silicon_step", node="Supervisor", step="daemon_started")

            # Step 5: Start frontend pipeline directly for the specified block
            started = self.run_frontend(env, blocks_file=blocks_file)
            TELEMETRY.emit("silicon_step", node="Supervisor", step="frontend_started",
                           ok=bool(started))
            if started:
                log_step("Driving frontend pipeline (RTL generation + lint + testbench)...")
                frontend_done = self.wait_and_drive(
                    env, auto_approve=auto_approve,
                    timeout=self.config.get("pipeline", {}).get("rtl_timeout", 3600),
                )
            else:
                log_step("Frontend pipeline failed to start", "error")

        except subprocess.TimeoutExpired:
            phase_error = "CoreSmith process timed out"
            log_step(phase_error, "error")
        except Exception as e:
            phase_error = f"CoreSmith unexpected error: {type(e).__name__}: {str(e)[:200]}"
            log_step(phase_error, "error")
        finally:
            # Stop daemon gracefully — always attempt cleanup
            log_step("Stopping CoreSmith daemon...")
            try:
                subprocess.run(
                    [str(self.coresmith_bin), "daemon", "stop",
                     "--project-root", str(self.run_dir)],
                    env=env, cwd=str(self.coresmith_dir),
                    capture_output=True, timeout=10,
                )
            except Exception:
                pass  # Best-effort cleanup

        # Collect results — always check for partial output even after errors
        netlist, sdc = self.find_netlist()
        rtl_files = self.find_rtl_files()

        has_output = netlist is not None or len(rtl_files) > 0

        result = {
            "success": has_output,
            "netlist": str(netlist) if netlist else None,
            "sdc": str(sdc) if sdc else None,
            "rtl_files": [str(f) for f in rtl_files],
            "run_dir": str(self.run_dir),
        }

        if phase_error:
            result["warning"] = phase_error

        if has_output:
            log_step(f"CoreSmith produced {len(rtl_files)} RTL file(s)", "done")
            if netlist:
                log_step(f"Synthesized netlist: {netlist.name}", "done")
            if phase_error:
                log(f"  ⚠️  Phase completed with warnings: {phase_error}", C.YELLOW)
                log(f"  💡 RTL was still produced — pipeline will continue", C.GREEN)
        else:
            log_step("No RTL/netlist produced — check CoreSmith logs", "error")
            if phase_error:
                log(f"  Root cause: {phase_error}", C.RED)

        return result


# =============================================================================
# Phase 2: OpenROAD-flow-scripts — Netlist → Physical Design
# =============================================================================

class ORFSPhase:
    """Drives OpenROAD-flow-scripts for physical design."""

    def __init__(self, config: dict, run_dir: Path):
        self.config = config
        self.run_dir = run_dir
        self.orfs_dir = Path(config["container"]["openroad_flow_scripts"])
        self.flow_dir = self.orfs_dir / "flow"
        self.pdk_root = config["container"]["pdk_root"]

    def detect_design_name(self, netlist_path: Path) -> str:
        """Extract design/module name from netlist."""
        content = netlist_path.read_text(errors="ignore")
        match = re.search(r'module\s+(\w+)\s*[\(;#]', content)
        if match:
            return match.group(1)
        return netlist_path.stem.replace("_netlist", "")

    def generate_config(self, design_name: str, verilog_files: list[str],
                        sdc_path: Optional[str] = None) -> Path:
        """Generate a config.mk for the design targeting sky130hd."""
        orfs_cfg = self.config.get("orfs", {})
        pdk_cfg = self.config.get("pdk", {})
        platform = orfs_cfg.get("platform", "sky130hd")
        utilization = orfs_cfg.get("core_utilization", 40)

        # Create design directory in ORFS
        design_dir = self.flow_dir / "designs" / platform / design_name
        design_dir.mkdir(parents=True, exist_ok=True)

        # Copy Verilog source files into ORFS designs/src/<design_name>
        src_dir = self.flow_dir / "designs" / "src" / design_name
        src_dir.mkdir(parents=True, exist_ok=True)
        verilog_refs = []
        for vf in verilog_files:
            src = Path(vf)
            dst = src_dir / src.name
            shutil.copy2(src, dst)
            verilog_refs.append(f"$(DESIGN_HOME)/src/{design_name}/{src.name}")

        # Generate SDC if not provided
        sdc_file = design_dir / "constraint.sdc"
        period_ns = 1000.0 / pdk_cfg.get("target_clock_mhz", 50)

        if sdc_path and Path(sdc_path).exists():
            shutil.copy2(sdc_path, sdc_file)
        else:
            # Auto-detect clock port from netlist
            clk_port = "clk"
            for vf in verilog_files:
                content = Path(vf).read_text(errors="ignore")
                for candidate in ["clk", "clock", "wb_clk_i", "clk_i"]:
                    if re.search(rf'\b{candidate}\b', content):
                        clk_port = candidate
                        break
            sdc_file.write_text(
                f"create_clock -name clk -period {period_ns:.2f} "
                f"[get_ports {clk_port}]\n"
                f"set_input_delay {period_ns * 0.2:.2f} -clock clk "
                f"[all_inputs -no_clocks]\n"
                f"set_output_delay {period_ns * 0.2:.2f} -clock clk "
                f"[all_outputs]\n"
            )

        # Write config.mk
        config_mk = design_dir / "config.mk"
        verilog_line = " \\\n                ".join(verilog_refs)
        config_mk.write_text(
            f"export DESIGN_NAME = {design_name}\n"
            f"export PLATFORM    = {platform}\n\n"
            f"export VERILOG_FILES = {verilog_line}\n"
            f"export SDC_FILE      = $(DESIGN_HOME)/$(PLATFORM)/"
            f"$(DESIGN_NICKNAME)/constraint.sdc\n\n"
            f"export CORE_UTILIZATION = {utilization}\n"
            f"export TNS_END_PERCENT  = {orfs_cfg.get('tns_end_percent', 100)}\n"
        )

        log_step(f"Generated ORFS config: {config_mk}", "done")
        return config_mk

    def run_flow(self, config_mk: Path, design_name: str,
                 target: str = "route") -> dict:
        """Run the ORFS Makefile flow with automatic retry on transient failures."""
        env = os.environ.copy()
        env["DESIGN_CONFIG"] = str(config_mk)
        env["PDK_ROOT"] = self.pdk_root

        # Run make synth → floorplan → place → cts → route → finish
        targets = {
            "synth":     "synth",
            "floorplan": "floorplan",
            "place":     "place",
            "cts":       "cts",
            "route":     "route",
            "finish":    "finish",
            "all":       "finish",
        }

        make_target = targets.get(target, target)
        results = {}
        max_retries = 1  # Retry each stage once on failure

        # Run stage by stage for visibility
        stages = ["synth", "floorplan", "place", "cts", "route", "finish"]
        stage_idx = stages.index(make_target) if make_target in stages else len(stages) - 1

        for i, stage in enumerate(stages[:stage_idx + 1]):
            log_step(f"Running {stage}...")
            success = False
            last_error = ""
            stage_t0 = time.time()
            TELEMETRY.emit("silicon_stage_enter", node=f"ORFS {stage}", phase="orfs",
                           stage=stage, index=i, total=stage_idx + 1, design=design_name)

            for attempt in range(max_retries + 1):
                if attempt > 0:
                    log_step(f"Retrying {stage} (attempt {attempt + 1}/{max_retries + 1})...", "wait")
                    TELEMETRY.emit("silicon_step", node=f"ORFS {stage}", step="stage_retry",
                                   stage=stage, attempt=attempt + 1)
                    # Clean stage-specific outputs before retry
                    clean_result = subprocess.run(
                        ["make", f"clean_{stage}", f"DESIGN_CONFIG={config_mk}"],
                        env=env, cwd=str(self.flow_dir),
                        capture_output=True, text=True, timeout=60,
                    )

                try:
                    result = subprocess.run(
                        ["make", stage, f"DESIGN_CONFIG={config_mk}"],
                        env=env, cwd=str(self.flow_dir),
                        capture_output=True, text=True,
                        timeout=self.config.get("pipeline", {}).get("pnr_timeout", 7200),
                    )
                    if result.returncode == 0:
                        log_step(f"{stage} completed", "done")
                        results[stage] = {"success": True}
                        success = True
                        break
                    else:
                        last_error = result.stderr[-500:]
                        log_step(f"{stage} failed (attempt {attempt + 1})", "error")
                        log(f"  stderr: {last_error}", C.RED)
                except subprocess.TimeoutExpired:
                    last_error = f"Stage {stage} timed out"
                    log_step(last_error, "error")
                except Exception as e:
                    last_error = f"{type(e).__name__}: {str(e)[:200]}"
                    log_step(f"{stage} exception: {last_error}", "error")

            TELEMETRY.emit("silicon_stage_exit", node=f"ORFS {stage}", phase="orfs",
                           stage=stage, index=i, total=stage_idx + 1,
                           status="ok" if success else "error",
                           duration_s=round(time.time() - stage_t0, 2),
                           error=None if success else last_error[-300:])

            if not success:
                results[stage] = {"success": False, "error": last_error}
                log_step(f"{stage} failed after {max_retries + 1} attempt(s) — stopping flow", "error")
                break

        return results

    def find_outputs(self, design_name: str) -> dict:
        """Find ORFS output artifacts."""
        platform = self.config.get("orfs", {}).get("platform", "sky130hd")
        results_dir = self.flow_dir / "results" / platform / design_name / "base"
        logs_dir = self.flow_dir / "logs" / platform / design_name / "base"

        outputs = {}

        # Key output files
        for name, pattern in [
            ("odb_final", "6_final.odb"),
            ("gds", "6_final.gds"),
            ("def_final", "6_final.def"),
            ("netlist", "6_final.v"),
            ("sdc_final", "6_final.sdc"),
            ("odb_route", "5_route.odb"),
            ("odb_place", "3_place.odb"),
            ("odb_floorplan", "2_floorplan.odb"),
            ("odb_synth", "1_synth.odb"),
        ]:
            path = results_dir / pattern
            if path.exists():
                outputs[name] = str(path)

        # Metric reports
        for name, pattern in [
            ("synth_log", "1_1_yosys.log"),
            ("floorplan_log", "2_1_floorplan.log"),
            ("place_log", "3_5_place_dp.log"),
            ("cts_log", "4_1_cts.log"),
            ("route_log", "5_2_route.log"),
            ("final_report", "6_report.log"),
        ]:
            path = logs_dir / pattern
            if path.exists():
                outputs[name] = str(path)

        return outputs

    def execute(self, coresmith_result: dict) -> dict:
        """Execute the full ORFS physical design phase."""
        log_phase("2: OpenROAD-flow-scripts",
                  "Netlist → Synthesis → Floorplan → Place → CTS → Route → Finish")

        netlist_path = coresmith_result.get("netlist")
        rtl_files = coresmith_result.get("rtl_files", [])
        sdc_path = coresmith_result.get("sdc")

        # Determine Verilog files to use
        if netlist_path and Path(netlist_path).exists():
            verilog_files = [netlist_path]
            design_name = self.detect_design_name(Path(netlist_path))
            log_step(f"Using synthesized netlist: {Path(netlist_path).name}")
        elif rtl_files:
            verilog_files = rtl_files
            # Use the first/top-level file to detect design name
            design_name = self.detect_design_name(Path(rtl_files[0]))
            log_step(f"Using {len(rtl_files)} RTL source files")
        else:
            log_step("No Verilog files available for ORFS", "error")
            return {"success": False, "error": "No input Verilog files"}

        log_step(f"Design name: {design_name}", "done")
        TELEMETRY.emit("silicon_step", node="Supervisor", step="design_detected",
                       design=design_name, input_files=len(verilog_files),
                       from_netlist=bool(netlist_path and Path(netlist_path).exists()))

        # Generate ORFS config
        config_mk = self.generate_config(design_name, verilog_files, sdc_path)
        TELEMETRY.emit("silicon_step", node="Supervisor", step="orfs_config_generated",
                       design=design_name, config_mk=str(config_mk))

        # Run the flow
        flow_results = self.run_flow(config_mk, design_name, target="finish")

        # Collect outputs and copy to run directory for host visibility
        outputs = self.find_outputs(design_name)
        output_dir = self.run_dir / "outputs"
        output_dir.mkdir(parents=True, exist_ok=True)
        local_outputs = {}
        for key, p in outputs.items():
            src_p = Path(p)
            if src_p.exists():
                dst_p = output_dir / src_p.name
                try:
                    shutil.copy2(src_p, dst_p)
                    local_outputs[key] = str(dst_p)
                except Exception:
                    local_outputs[key] = str(src_p)
            else:
                local_outputs[key] = str(src_p)
        outputs = local_outputs

        all_passed = all(r.get("success") for r in flow_results.values())

        metric_logs = [Path(outputs[k]) for k in
                       ("floorplan_log", "place_log", "cts_log", "route_log", "final_report")
                       if k in outputs]
        metrics = parse_orfs_metrics(metric_logs)
        if metrics:
            TELEMETRY.emit("silicon_metrics", node="Supervisor", design=design_name, **metrics)

        result = {
            "success": all_passed,
            "design_name": design_name,
            "flow_results": flow_results,
            "outputs": outputs,
            "config_mk": str(config_mk),
            "metrics": metrics,
        }

        if all_passed:
            log_step(f"ORFS flow completed successfully for '{design_name}'", "done")
            if "odb_final" in outputs:
                log_step(f"Final ODB: {outputs['odb_final']}", "done")
            if "gds" in outputs:
                log_step(f"Final GDS: {outputs['gds']}", "done")
        else:
            failed = [s for s, r in flow_results.items() if not r.get("success")]
            log_step(f"ORFS flow failed at: {', '.join(failed)}", "error")

        return result


# =============================================================================
# Phase 3: Sky130 PDK — Validation & Context
# =============================================================================

class Sky130Phase:
    """Validates and reports Sky130 PDK integration."""

    def __init__(self, config: dict):
        self.config = config
        self.pdk_root = Path(config["container"]["pdk_root"])

    def validate(self) -> dict:
        """Check that Sky130 PDK files exist."""
        log_phase("3: Sky130 PDK", "Validating technology rules and standard cells")

        pdk_cfg = self.config.get("pdk", {})
        variant = pdk_cfg.get("variant", "sky130A")
        std_cell = pdk_cfg.get("std_cell_library", "sky130_fd_sc_hd")

        checks = {}
        pdk_path = self.pdk_root / variant

        # Support both ORFS platform directory and Volare libs.ref directory
        orfs_platform = self.pdk_root / "sky130hd" if (self.pdk_root / "sky130hd").exists() else (self.pdk_root / "platforms" / "sky130hd" if (self.pdk_root / "platforms" / "sky130hd").exists() else None)
        if orfs_platform and orfs_platform.exists():
            essentials = {
                "PDK platform directory": orfs_platform,
                "Liberty file": orfs_platform / "lib" / f"{std_cell}__tt_025C_1v80.lib",
                "LEF file": orfs_platform / "lef" / f"{std_cell}_merged.lef",
                "Tech LEF": orfs_platform / "lef" / f"{std_cell}.tlef",
            }
        else:
            essentials = {
                "PDK directory": pdk_path,
                "Liberty file": (
                    pdk_path / "libs.ref" / std_cell / "lib" /
                    f"{std_cell}__tt_025C_1v80.lib"
                ),
                "LEF file": (
                    pdk_path / "libs.ref" / std_cell / "lef" / f"{std_cell}.lef"
                ),
                "Tech LEF": (
                    pdk_path / "libs.ref" / std_cell / "techlef" /
                    f"{std_cell}__nom.tlef"
                ),
                "GDS cells": (
                    pdk_path / "libs.ref" / std_cell / "gds" / f"{std_cell}.gds"
                ),
            }

        all_ok = True
        for name, path in essentials.items():
            exists = path.exists()
            checks[name] = {"path": str(path), "exists": exists}
            if exists:
                log_step(f"{name}: ✓", "done")
            else:
                log_step(f"{name}: MISSING ({path})", "error")
                all_ok = False

        return {"success": all_ok, "checks": checks}


# =============================================================================
# Phase 4: OpenROAD GUI — Visualization
# =============================================================================

class OpenROADGUIPhase:
    """Opens the design in OpenROAD's GUI for interactive visualization."""

    def __init__(self, config: dict):
        self.config = config

    def open_gui(self, odb_path: str, design_name: str = "design"):
        """Open OpenROAD GUI with the given ODB file."""
        log_phase("4: OpenROAD GUI", "Opening interactive layout visualization")

        if not Path(odb_path).exists():
            log_step(f"ODB file not found: {odb_path}", "error")
            return False

        # Generate a TCL script to load the design
        # Note: gui::show is NOT called here because we launch with -gui flag,
        # which automatically opens the GUI. Calling gui::show again causes
        # [WARNING GUI-0008] GUI already active.
        tcl_script = Path(odb_path).parent / "open_gui.tcl"
        tcl_script.write_text(textwrap.dedent(f"""\
            # SiliconIA — OpenROAD GUI Visualization
            # Design: {design_name}
            # Generated: {datetime.now().isoformat()}

            # Load design database (contains technology rules, standard cells and layout)
            read_db {odb_path}
        """))

        log_step(f"TCL script: {tcl_script}", "done")
        log_step(f"Loading design: {design_name}", "done")

        # Launch OpenROAD with GUI
        openroad_bin = shutil.which("openroad") or "/usr/local/bin/openroad"
        cmd = [openroad_bin, "-gui", str(tcl_script)]

        log(f"\n  🖥️  OpenROAD GUI is opening...", C.MAGENTA)
        log(f"  📐 Design: {design_name}", C.CYAN)
        log(f"  📄 ODB: {odb_path}", C.CYAN)
        log(f"\n  Controls:", C.YELLOW)
        log(f"    • Zoom: Mouse scroll", C.YELLOW)
        log(f"    • Pan:  Middle mouse drag", C.YELLOW)
        log(f"    • Select: Left click on cells/nets", C.YELLOW)
        log(f"    • Highlight net: Right-click → Highlight Net", C.YELLOW)
        log(f"    • Layers: Toggle in right panel", C.YELLOW)

        gui_env = os.environ.copy()
        gui_env["QT_QPA_PLATFORM"] = "xcb"

        try:
            subprocess.run(cmd, env=gui_env, check=False)
        except FileNotFoundError:
            log_step(f"OpenROAD not found at: {openroad_bin}", "error")
            log(f"  💡 Install OpenROAD or set OPENROAD_EXE", C.YELLOW)
            return False

        return True

    def generate_images(self, odb_path: str, output_dir: Path,
                        design_name: str = "design") -> list[str]:
        """Generate static layout images at each stage."""
        images = []
        results_dir = Path(odb_path).parent

        # Find all stage ODB files
        stage_files = sorted(results_dir.glob("*.odb"))
        if not stage_files:
            return images

        openroad_bin = shutil.which("openroad") or "/usr/local/bin/openroad"
        output_dir.mkdir(parents=True, exist_ok=True)

        for odb in stage_files:
            png_path = output_dir / f"{odb.stem}.png"
            tcl = output_dir / f"capture_{odb.stem}.tcl"

            tcl.write_text(textwrap.dedent(f"""\
                read_db {odb}
                if {{[gui::enabled]}} {{
                    gui::show
                    gui::save_image {png_path} 2048 1536
                    exit
                }}
            """))

            result = subprocess.run(
                [openroad_bin, "-gui", "-exit", str(tcl)],
                capture_output=True, timeout=60,
            )
            if png_path.exists():
                images.append(str(png_path))
                log_step(f"Captured: {odb.stem}.png", "done")

        return images


# =============================================================================
# Main Pipeline Orchestrator
# =============================================================================

class SiliconPipeline:
    """Main orchestrator: Prompt → CoreSmith → ORFS → Sky130 → OpenROAD GUI."""

    def __init__(self, config: dict):
        self.config = config

    def create_run_dir(self, design_hint: str = "design") -> Path:
        """Create a timestamped run directory."""
        runs_base = Path(self.config["container"]["runs_dir"])
        runs_base.mkdir(parents=True, exist_ok=True)

        # Sanitize design hint for directory name
        clean_hint = unicodedata.normalize('NFKD', design_hint).encode('ascii', 'ignore').decode('ascii')
        if not clean_hint.strip():
            clean_hint = "design"
        safe_name = re.sub(r'[^a-zA-Z0-9_\-]', '_', clean_hint.lower())[:30]
        ts = datetime.now().strftime("%Y%m%d-%H%M%S")
        run_dir = runs_base / f"{safe_name}-{ts}"
        run_dir.mkdir(parents=True, exist_ok=True)

        # Symlink 'current' for convenience
        current = runs_base / "current"
        if current.is_symlink() or current.exists():
            current.unlink()
        try:
            current.symlink_to(run_dir)
        except OSError:
            pass  # Symlinks may not work on all platforms

        return run_dir

    def run(self, prompt: str, auto_approve: bool = False,
            open_gui: bool = True, skip_coresmith: bool = False,
            verilog_files: list[str] = None) -> dict:
        """Execute the full pipeline (with telemetry start/end guaranteed)."""
        results: dict = {}
        crashed: Optional[str] = None
        try:
            results = self._run_impl(prompt, auto_approve, open_gui,
                                     skip_coresmith, verilog_files)
            return results
        except BaseException as e:
            crashed = f"{type(e).__name__}: {str(e)[:300]}"
            raise
        finally:
            ok = bool(results.get("coresmith", {}).get("success")
                      and results.get("pdk", {}).get("success")
                      and results.get("orfs", {}).get("success"))
            failed_phase = None
            for ph in ("pdk", "coresmith", "orfs"):
                if not results.get(ph, {}).get("success"):
                    failed_phase = ph
                    break
            TELEMETRY.emit("silicon_pipeline_end", node="Supervisor",
                           success=ok and crashed is None,
                           failed_phase=None if ok else failed_phase,
                           error=crashed,
                           design=results.get("orfs", {}).get("design_name"),
                           outputs=sorted(results.get("orfs", {}).get("outputs", {}).keys()))
            TELEMETRY.update_current(status="done" if (ok and crashed is None) else "error",
                                     phase=None)

    def _run_impl(self, prompt: str, auto_approve: bool,
                  open_gui: bool, skip_coresmith: bool,
                  verilog_files: Optional[list[str]]) -> dict:
        """Execute the full pipeline."""
        print(BANNER)
        log(f"  📋 Prompt: {prompt[:100]}{'...' if len(prompt) > 100 else ''}", C.CYAN)
        log(f"  🔧 LLM Provider: {self.config.get('llm', {}).get('provider', 'codex')}", C.CYAN)
        log(f"  🏭 PDK: Sky130 ({self.config.get('pdk', {}).get('process_nm', 130)}nm)", C.CYAN)
        log(f"  ⏰ Started: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}", C.CYAN)

        # Create run directory
        run_dir = self.create_run_dir(prompt.split()[0] if prompt.split() else "design")
        log(f"  📁 Run dir: {run_dir}\n", C.CYAN)

        # Save the prompt for reference
        (run_dir / "prompt.txt").write_text(prompt)

        TELEMETRY.bind(run_dir, Path(self.config["container"]["runs_dir"]), prompt)
        TELEMETRY.emit("silicon_pipeline_start", node="Supervisor",
                       run_id=run_dir.name, prompt=prompt[:500],
                       llm_provider=self.config.get("llm", {}).get("provider", "codex"),
                       llm_model=self.config.get("llm", {}).get("codex_model"),
                       pdk=self.config.get("pdk", {}).get("variant", "sky130A"),
                       platform=self.config.get("orfs", {}).get("platform", "sky130hd"),
                       clock_mhz=self.config.get("pdk", {}).get("target_clock_mhz"),
                       skip_coresmith=bool(skip_coresmith and verilog_files),
                       auto_approve=auto_approve, open_gui=open_gui)

        results = {"prompt": prompt, "run_dir": str(run_dir)}

        # ── Phase 3 (early): Validate Sky130 PDK ──
        TELEMETRY.emit("silicon_phase_enter", node="Supervisor", phase="pdk")
        sky130 = Sky130Phase(self.config)
        pdk_result = sky130.validate()
        results["pdk"] = pdk_result
        TELEMETRY.emit("silicon_phase_exit", node="Supervisor", phase="pdk",
                       status="ok" if pdk_result["success"] else "error",
                       missing=[k for k, v in pdk_result.get("checks", {}).items() if not v.get("exists")])
        if not pdk_result["success"]:
            log("\n⚠️  Sky130 PDK validation failed. Install PDK first.", C.RED)
            log("  Run: volare enable --pdk sky130 --pdk-root /usr/share/pdk", C.YELLOW)
            return results

        # ── Phase 1: CoreSmith ──
        if skip_coresmith and verilog_files:
            log_phase("1: CoreSmith", "SKIPPED — using provided Verilog files")
            TELEMETRY.emit("silicon_phase_enter", node="Supervisor", phase="coresmith",
                           skipped=True)
            coresmith_result = {
                "success": True,
                "netlist": None,
                "sdc": None,
                "rtl_files": verilog_files,
                "run_dir": str(run_dir),
            }
        else:
            TELEMETRY.emit("silicon_phase_enter", node="Supervisor", phase="coresmith",
                           skipped=False)
            coresmith = CoreSmithPhase(self.config, run_dir)
            coresmith_result = coresmith.execute(prompt, auto_approve=auto_approve)

        results["coresmith"] = coresmith_result
        TELEMETRY.emit("silicon_phase_exit", node="Supervisor", phase="coresmith",
                       status="ok" if coresmith_result["success"] else "error",
                       skipped=bool(skip_coresmith and verilog_files),
                       rtl_files=len(coresmith_result.get("rtl_files", [])),
                       has_netlist=bool(coresmith_result.get("netlist")),
                       warning=coresmith_result.get("warning"))

        if not coresmith_result["success"]:
            log("\n⚠️  CoreSmith phase did not produce RTL. Pipeline halted.", C.RED)
            log("  Check CoreSmith logs or re-run with --auto-approve", C.YELLOW)
            self._write_report(results, run_dir)
            return results

        # Report any warnings from CoreSmith phase
        if coresmith_result.get("warning"):
            log(f"\n  ⚠️  CoreSmith warning: {coresmith_result['warning']}", C.YELLOW)
            log(f"  Pipeline continuing with available RTL output.\n", C.GREEN)

        # ── Phase 2: OpenROAD-flow-scripts ──
        TELEMETRY.emit("silicon_phase_enter", node="Supervisor", phase="orfs")
        orfs = ORFSPhase(self.config, run_dir)
        orfs_result = orfs.execute(coresmith_result)
        results["orfs"] = orfs_result
        TELEMETRY.emit("silicon_phase_exit", node="Supervisor", phase="orfs",
                       status="ok" if orfs_result.get("success") else "error",
                       design=orfs_result.get("design_name"),
                       error=orfs_result.get("error"))

        if not orfs_result.get("success"):
            log("\n⚠️  ORFS physical design flow failed.", C.RED)
            self._write_report(results, run_dir)
            return results

        # ── Phase 4: OpenROAD GUI ──
        if open_gui and orfs_result.get("outputs", {}).get("odb_final"):
            TELEMETRY.emit("silicon_phase_enter", node="Supervisor", phase="gui",
                           design=orfs_result.get("design_name"))
            gui = OpenROADGUIPhase(self.config)
            gui_ok = gui.open_gui(
                orfs_result["outputs"]["odb_final"],
                orfs_result.get("design_name", "design"),
            )
            TELEMETRY.emit("silicon_phase_exit", node="Supervisor", phase="gui",
                           status="ok" if gui_ok else "error")

        # Final report
        self._write_report(results, run_dir)
        self._print_summary(results)
        return results

    def _write_report(self, results: dict, run_dir: Path):
        """Write a JSON report of the run."""
        report_path = run_dir / "pipeline_report.json"
        report = {
            "timestamp": datetime.now().isoformat(),
            "prompt": results.get("prompt"),
            "run_dir": str(run_dir),
            "phases": {
                "coresmith": results.get("coresmith", {}),
                "orfs": results.get("orfs", {}),
                "pdk": results.get("pdk", {}),
            },
        }
        report_path.write_text(json.dumps(report, indent=2, default=str))
        log(f"\n  📊 Report: {report_path}", C.CYAN)

    def _print_summary(self, results: dict):
        """Print a final summary."""
        log(f"\n{'='*70}", C.GREEN)
        log("  📋 Pipeline Summary", C.BOLD + C.GREEN)
        log(f"{'='*70}", C.GREEN)

        phases = [
            ("CoreSmith (RTL)", results.get("coresmith", {}).get("success")),
            ("Sky130 PDK", results.get("pdk", {}).get("success")),
            ("ORFS (PnR)", results.get("orfs", {}).get("success")),
        ]
        for name, ok in phases:
            icon = "✅" if ok else "❌"
            log(f"  {icon} {name}", C.GREEN if ok else C.RED)

        orfs = results.get("orfs", {})
        if orfs.get("outputs"):
            outputs = orfs["outputs"]
            log(f"\n  📦 Outputs:", C.CYAN)
            for k, v in outputs.items():
                if not k.endswith("_log"):
                    log(f"    • {k}: {Path(v).name}", C.CYAN)

        run_dir = results.get("run_dir", "")
        log(f"\n  📁 Run directory: {run_dir}", C.CYAN)

        # Hint for GUI
        odb = orfs.get("outputs", {}).get("odb_final")
        if odb:
            log(f"\n  🖥️  To open GUI later:", C.MAGENTA)
            log(f"     openroad -gui {odb}", C.MAGENTA)

        log(f"\n{'='*70}\n", C.GREEN)


# =============================================================================
# CLI Entry Point
# =============================================================================

def main():
    parser = argparse.ArgumentParser(
        description="SiliconIA Pipeline: Prompt → CoreSmith → ORFS → Sky130 → OpenROAD GUI",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=textwrap.dedent("""\
        Examples:
          # Simple design from a prompt
          python3 silicon_pipeline.py "Design a 32-bit adder"

          # Complex design from a spec file
          python3 silicon_pipeline.py --prompt-file spec.md

          # Auto-approve all CoreSmith interrupts
          python3 silicon_pipeline.py "8-bit counter" --auto-approve

          # Skip CoreSmith, use existing Verilog
          python3 silicon_pipeline.py "my design" --skip-coresmith --verilog rtl/top.v

          # Run without GUI (headless)
          python3 silicon_pipeline.py "ALU" --no-gui
        """),
    )

    parser.add_argument("prompt", nargs="?", default=None,
                        help="Natural language design specification")
    parser.add_argument("--prompt-file", "-f", type=str,
                        help="Read prompt from a file (markdown or text)")
    parser.add_argument("--config", "-c", type=str, default=str(CONFIG_PATH),
                        help="Pipeline config YAML (default: pipeline_config.yaml)")
    parser.add_argument("--auto-approve", "-y", action="store_true",
                        help="Auto-approve CoreSmith interrupts")
    parser.add_argument("--no-gui", action="store_true",
                        help="Skip OpenROAD GUI (headless mode)")
    parser.add_argument("--skip-coresmith", action="store_true",
                        help="Skip CoreSmith, use provided Verilog files")
    parser.add_argument("--verilog", nargs="+",
                        help="Verilog files (used with --skip-coresmith)")
    parser.add_argument("--interactive", "-i", action="store_true",
                        help="Interactive mode — prompts for input")

    args = parser.parse_args()

    # Resolve prompt
    if args.prompt_file:
        prompt = Path(args.prompt_file).read_text()
    elif args.prompt:
        prompt = args.prompt
    elif args.interactive:
        print(BANNER)
        log("🎯 SiliconIA Interactive Mode", C.BOLD + C.CYAN)
        log("   Describe the chip you want to design:\n", C.CYAN)
        lines = []
        log("   (Enter your specification, then press Ctrl+D or type 'END'):\n", C.YELLOW)
        try:
            while True:
                line = input("   > ")
                if line.strip().upper() == "END":
                    break
                lines.append(line)
        except EOFError:
            pass
        prompt = "\n".join(lines)
        if not prompt.strip():
            log("No prompt provided. Exiting.", C.RED)
            sys.exit(1)
    else:
        parser.print_help()
        sys.exit(1)

    # Load config
    config_path = Path(args.config)
    if config_path.exists():
        with open(config_path) as f:
            config = yaml.safe_load(f)
    else:
        config = load_config()

    # Run pipeline
    pipeline = SiliconPipeline(config)
    results = pipeline.run(
        prompt=prompt,
        auto_approve=args.auto_approve,
        open_gui=not args.no_gui,
        skip_coresmith=args.skip_coresmith,
        verilog_files=args.verilog,
    )

    # Exit code
    all_ok = all([
        results.get("coresmith", {}).get("success"),
        results.get("pdk", {}).get("success"),
        results.get("orfs", {}).get("success", True),
    ])
    sys.exit(0 if all_ok else 1)


if __name__ == "__main__":
    main()
