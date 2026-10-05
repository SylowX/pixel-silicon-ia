# =============================================================================
# SiliconIA Unified Dockerfile (Base: openroad/orfs)
# Prompt → CoreSmith → OpenROAD-flow-scripts → Sky130 → OpenROAD GUI
# =============================================================================

FROM openroad/orfs:latest

ENV DEBIAN_FRONTEND=noninteractive
ENV TZ=America/Los_Angeles
ENV LANG=C.UTF-8
ENV LC_ALL=C.UTF-8

# ---- Ensure system utilities, Verilator, and Node.js 20 (for Codex CLI) ----
RUN apt-get update && apt-get install -y \
    curl ca-certificates git xdot python3-tk python3-pip verilator \
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

# ---- Install Codex CLI ----
RUN npm install -g @openai/codex

# ---- Paths and symlinks for OpenROAD, Yosys, and Sky130 PDK ----
RUN ln -sf /OpenROAD-flow-scripts/tools/install/OpenROAD/bin/openroad /usr/local/bin/openroad 2>/dev/null || true && \
    mkdir -p /workspace/silicon-runs && \
    mkdir -p /usr/share/pdk/sky130A/libs.ref/sky130_fd_sc_hd/lib && \
    mkdir -p /usr/share/pdk/sky130A/libs.ref/sky130_fd_sc_hd/lef && \
    mkdir -p /usr/share/pdk/sky130A/libs.ref/sky130_fd_sc_hd/techlef && \
    ln -sf /OpenROAD-flow-scripts/flow/platforms/sky130hd/lib/sky130_fd_sc_hd__tt_025C_1v80.lib /usr/share/pdk/sky130A/libs.ref/sky130_fd_sc_hd/lib/sky130_fd_sc_hd__tt_025C_1v80.lib && \
    ln -sf /OpenROAD-flow-scripts/flow/platforms/sky130hd/lef/sky130_fd_sc_hd_merged.lef /usr/share/pdk/sky130A/libs.ref/sky130_fd_sc_hd/lef/sky130_fd_sc_hd.lef && \
    ln -sf /OpenROAD-flow-scripts/flow/platforms/sky130hd/lef/sky130_fd_sc_hd.tlef /usr/share/pdk/sky130A/libs.ref/sky130_fd_sc_hd/techlef/sky130_fd_sc_hd__nom.tlef

# ---- Set up workspace ----
WORKDIR /workspace

# Copy CoreSmith, compatibility shims, and integration files
COPY sitecustomize.py /usr/lib/python3.10/sitecustomize.py
COPY sitecustomize.py /usr/local/lib/python3.10/dist-packages/sitecustomize.py
COPY sitecustomize.py /workspace/sitecustomize.py
COPY coresmith-main /workspace/coresmith-main
COPY pipeline_config.yaml /workspace/pipeline_config.yaml
COPY silicon_pipeline.py /workspace/silicon_pipeline.py

# ---- Install Python dependencies for CoreSmith and Pipeline ----
RUN python3 -m pip install --no-cache-dir \
    pytest pytest-cov pytest-asyncio \
    langgraph langgraph-checkpoint-sqlite \
    opentelemetry-sdk opentelemetry-api \
    pyyaml jinja2 pydantic \
    fastapi uvicorn httpx \
    cocotb cocotb-bus \
    amaranth gdstk \
    rich click watchdog 'mcp>=1.0.0,<2' \
    openram \
    && python3 -m pip install -e /workspace/coresmith-main/orchestrator/ 2>/dev/null || true

# ---- Environment Variables ----
ENV FLOW_HOME=/OpenROAD-flow-scripts/flow
ENV OPENROAD_EXE=/OpenROAD-flow-scripts/tools/install/OpenROAD/bin/openroad
ENV PATH="/OpenROAD-flow-scripts/tools/install/OpenROAD/bin:/OpenROAD-flow-scripts/tools/install/yosys/bin:/workspace/coresmith-main/bin:${PATH}"
ENV PYTHONPATH="/workspace/coresmith-main:${PYTHONPATH}"
ENV PYTHONUNBUFFERED=1
ENV CORESMITH_PROJECT_ROOT=/workspace/silicon-runs/current
ENV CORESMITH_LLM_PROVIDER=codex
ENV CORESMITH_CODEX_MODEL=gpt-5.6-sol
ENV CORESMITH_MODEL=gpt-5.6-sol
ENV CORESMITH_BLOCK_MODEL=gpt-5.6-sol
ENV CORESMITH_CODEX_SANDBOX=danger-full-access
ENV CORESMITH_ALLOW_NO_OPENRAM=1
ENV PDK_ROOT=/usr/share/pdk
ENV PDK=sky130A

# Convenience command
RUN echo '#!/bin/bash' > /usr/local/bin/silicon-pipeline && \
    echo 'python3 /workspace/silicon_pipeline.py "$@"' >> /usr/local/bin/silicon-pipeline && \
    chmod +x /usr/local/bin/silicon-pipeline

EXPOSE 3000 8080

ENTRYPOINT ["/bin/bash"]
