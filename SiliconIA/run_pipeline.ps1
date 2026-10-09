# =============================================================================
# SiliconIA Pipeline Launcher
# Prompt → CoreSmith → OpenROAD-flow-scripts → Sky130 → OpenROAD GUI
#
# Usage:
#   .\run_pipeline.ps1 "Design a 32-bit adder"
#   .\run_pipeline.ps1 -PromptFile .\spec.md
#   .\run_pipeline.ps1 -Interactive
#   .\run_pipeline.ps1 -Build  # Build Docker image first
# =============================================================================

param(
    [Parameter(Position=0)]
    [string]$Prompt,

    [string]$PromptFile,

    [switch]$Interactive,

    [switch]$Build,

    [switch]$AutoApprove,

    [switch]$NoGUI,

    [switch]$ShowGUI,

    [switch]$Shell,

    [switch]$SkipCoresmith,

    [string[]]$VerilogFiles,

    [switch]$Help
)

$ErrorActionPreference = "Stop"
# Workspace = folder containing this script (was hardcoded to C:\Users\carlo\SiliconIA).
# Override with $env:SILICONIA_WORKSPACE if needed.
$WORKSPACE = if ($env:SILICONIA_WORKSPACE) { $env:SILICONIA_WORKSPACE } else { $PSScriptRoot }
$IMAGE_NAME = "siliconia-pipeline:latest"
$CONTAINER_NAME = "siliconia"

# ---- Banner ----
Write-Host @"

 ╔═══════════════════════════════════════════════════════════════╗
 ║              SiliconIA Pipeline Launcher                     ║
 ║   Prompt → CoreSmith → OpenROAD-flow-scripts → Sky130       ║
 ║                     → OpenROAD GUI                           ║
 ╚═══════════════════════════════════════════════════════════════╝

"@ -ForegroundColor Cyan

if ($Help) {
    Write-Host @"
Usage:
  .\run_pipeline.ps1 "Design a 32-bit adder"          # Run with prompt
  .\run_pipeline.ps1 -PromptFile .\spec.md             # Run from file
  .\run_pipeline.ps1 -Interactive                       # Interactive mode
  .\run_pipeline.ps1 -Build                             # Build Docker image
  .\run_pipeline.ps1 -Shell                             # Open shell in container
  .\run_pipeline.ps1 "adder" -AutoApprove               # Auto-approve interrupts
  .\run_pipeline.ps1 "design" -NoGUI                    # Headless mode (no GUI window)
  .\run_pipeline.ps1 -ShowGUI                           # Open OpenROAD GUI on latest run
  .\run_pipeline.ps1 -ShowGUI adder-20260929-103403     # Open GUI on specific run
  .\run_pipeline.ps1 "top" -SkipCoresmith -VerilogFiles rtl/top.v

Options:
  -Prompt           Design specification in natural language
  -PromptFile       Path to specification file (.md or .txt)
  -Interactive      Interactive prompt mode
  -Build            Build the Docker image before running
  -AutoApprove      Auto-approve CoreSmith interrupts
  -NoGUI            Skip OpenROAD GUI (headless)
  -ShowGUI          Open OpenROAD GUI to view layout of a previous run
  -Shell            Open bash shell in the container
  -SkipCoresmith    Skip CoreSmith, use provided Verilog
  -VerilogFiles     Verilog source files (with -SkipCoresmith)
  -Help             Show this help message
"@ -ForegroundColor Yellow
    exit 0
}

# ---- Check Docker ----
Write-Host "  Checking Docker..." -ForegroundColor Yellow
try {
    docker version | Out-Null
} catch {
    Write-Host "  ERROR: Docker is not running. Please start Docker Desktop." -ForegroundColor Red
    exit 1
}
Write-Host "  Docker is running." -ForegroundColor Green

# ---- Build Image ----
if ($Build) {
    Write-Host "`n  Building Docker image (this may take 30-60 minutes)..." -ForegroundColor Yellow
    Push-Location $WORKSPACE
    docker build -t $IMAGE_NAME .
    if ($LASTEXITCODE -ne 0) {
        Write-Host "  ERROR: Docker build failed." -ForegroundColor Red
        Pop-Location
        exit 1
    }
    Pop-Location
    Write-Host "  Docker image built successfully!" -ForegroundColor Green
}

# ---- Check Image Exists ----
$imageExists = docker images -q $IMAGE_NAME 2>$null
if (-not $imageExists -and -not $Build) {
    Write-Host "  Docker image not found. Building..." -ForegroundColor Yellow
    Push-Location $WORKSPACE
    docker build -t $IMAGE_NAME .
    Pop-Location
}

# ---- Prepare Run Directory ----
$runsDir = Join-Path $WORKSPACE "silicon-runs"
if (-not (Test-Path $runsDir)) {
    New-Item -ItemType Directory -Path $runsDir -Force | Out-Null
}

# ---- Docker Run Arguments ----
$ttyFlags = if ($Shell -or $Interactive) { @("-it") } else { @("-i") }
$dockerArgs = @("run", "--rm") + $ttyFlags + @(
    "--name", $CONTAINER_NAME
    # Volume mounts
    "-v", "${WORKSPACE}:/workspace"
    "-v", "${runsDir}:/workspace/silicon-runs"
    "-v", "${WORKSPACE}\verilator_shim.sh:/usr/local/bin/verilator:ro"
    # Environment
    "-e", "CORESMITH_LLM_PROVIDER=codex"
    "-e", "CORESMITH_CODEX_MODEL=gpt-5.6-sol"
    "-e", "CORESMITH_MODEL=gpt-5.6-sol"
    "-e", "CORESMITH_BLOCK_MODEL=gpt-5.6-sol"
    "-e", "CORESMITH_CODEX_SANDBOX=danger-full-access"
    "-e", "CORESMITH_ALLOW_NO_OPENRAM=1"
    "-e", "PDK_ROOT=/usr/share/pdk"
    "-e", "PDK=sky130A"
    "-e", "OPENROAD_EXE=/OpenROAD-flow-scripts/tools/install/OpenROAD/bin/openroad"
    "-e", "PYTHONPATH=/workspace/coresmith-main"
    "-e", "PYTHONUNBUFFERED=1"
    # Ports (mapped to 8085 and 3005 on host to prevent conflicts)
    "-p", "8085:8080"
    "-p", "3005:3000"
    # Resource limits
    "--memory", "16g"
)

# Mount Codex credentials if they exist
$codexDir = Join-Path $env:USERPROFILE ".codex"
if (Test-Path $codexDir) {
    Write-Host "  Credenciales Codex CLI detectadas ($codexDir) -> montadas en el contenedor." -ForegroundColor Green
    $dockerArgs += @("-v", "${codexDir}:/root/.codex")
} else {
    Write-Host "  Nota: No se detecto carpeta .codex en tu perfil de Windows. Se usaran API keys si estan definidas." -ForegroundColor Yellow
}

# Forward API keys from host
if ($env:OPENAI_API_KEY) {
    $dockerArgs += @("-e", "OPENAI_API_KEY=$($env:OPENAI_API_KEY)")
}
if ($env:CODEX_API_KEY) {
    $dockerArgs += @("-e", "CODEX_API_KEY=$($env:CODEX_API_KEY)")
}
# Optional model overrides (provider-agnostic); pipeline_config.yaml is the default source.
foreach ($llmVar in @("SILICONIA_LLM_PROVIDER", "SILICONIA_LLM_MODEL", "SILICONIA_LLM_FALLBACKS")) {
    $llmVal = [Environment]::GetEnvironmentVariable($llmVar)
    if ($llmVal) {
        $dockerArgs += @("-e", "$llmVar=$llmVal")
    }
}

# ---- X11 / WSLg Forwarding for OpenROAD GUI ----
if (-not $NoGUI) {
    $wslgX11 = "\\wsl.localhost\Ubuntu\tmp\.X11-unix"
    $wslgMnt = "\\wsl.localhost\Ubuntu\mnt\wslg"
    if (-not (Test-Path $wslgX11)) {
        $wslgX11 = "\\wsl$\Ubuntu\tmp\.X11-unix"
        $wslgMnt = "\\wsl$\Ubuntu\mnt\wslg"
    }

    if (Test-Path $wslgX11) {
        Write-Host "  Servidor grafico nativo WSLg detectado -> GUI de OpenROAD habilitada." -ForegroundColor Green
        $dockerArgs += @(
            "-e", "DISPLAY=:0",
            "-e", "QT_QPA_PLATFORM=xcb",
            "-v", "${wslgX11}:/tmp/.X11-unix",
            "-v", "${wslgMnt}:/mnt/wslg"
        )
    } elseif ($env:DISPLAY) {
        Write-Host "  Servidor X11 detectado ($($env:DISPLAY)) -> GUI habilitada." -ForegroundColor Green
        $dockerArgs += @(
            "-e", "DISPLAY=$($env:DISPLAY)",
            "-e", "QT_QPA_PLATFORM=xcb"
        )
    } else {
        Write-Host "  Nota: No se detecto WSLg ni variable DISPLAY. Si la GUI no abre, usa -NoGUI." -ForegroundColor Yellow
    }
}

# Image
$dockerArgs += $IMAGE_NAME

# ---- ShowGUI Mode (Open layout viewer directly) ----
if ($ShowGUI) {
    $targetRun = if ($Prompt -and (Test-Path (Join-Path $runsDir $Prompt))) {
        Join-Path $runsDir $Prompt
    } else {
        Get-ChildItem -Path $runsDir -Directory | Sort-Object LastWriteTime -Descending | Where-Object {
            Test-Path (Join-Path $_.FullName "outputs\6_final.odb")
        } | Select-Object -First 1 -ExpandProperty FullName
    }

    if (-not $targetRun) {
        Write-Host "  ERROR: No se encontro ninguna ejecucion con 'outputs/6_final.odb' en $runsDir" -ForegroundColor Red
        exit 1
    }

    $leafDir = Split-Path $targetRun -Leaf
    $containerOdb = "/workspace/silicon-runs/$leafDir/outputs/6_final.odb"
    Write-Host "`n  Abriendo OpenROAD GUI para: $leafDir..." -ForegroundColor Cyan
    Write-Host "  Archivo ODB: $containerOdb" -ForegroundColor DarkGray
    Write-Host "  (Cierra la ventana de OpenROAD para volver al terminal)`n" -ForegroundColor Yellow

    # Use read_db in TCL to load the ODB (gui::show not needed because -gui flag opens it)
    $guiCmd = "openroad -gui -no_init -exec 'read_db $containerOdb'"
    $dockerArgs += @("-c", $guiCmd)
    & docker @dockerArgs
    exit $LASTEXITCODE
}

# ---- Shell Mode ----
if ($Shell) {
    Write-Host "  Opening shell in SiliconIA container..." -ForegroundColor Cyan
    & docker @dockerArgs
    exit $LASTEXITCODE
}

# ---- Build Pipeline Command ----
$pipelineCmd = "python3 /workspace/silicon_pipeline.py"

if ($PromptFile) {
    # Copy prompt file to workspace if not already there
    $absPromptFile = Resolve-Path $PromptFile
    $containerPromptFile = "/workspace/" + (Split-Path $absPromptFile -Leaf)
    $pipelineCmd += " --prompt-file '$containerPromptFile'"
} elseif ($Interactive) {
    $pipelineCmd += " --interactive"
} elseif ($Prompt) {
    $escapedPrompt = $Prompt -replace "'", "'\''"
    $pipelineCmd += " '$escapedPrompt'"
} elseif ($SkipCoresmith) {
    $pipelineCmd += " 'direct-verilog-flow'"
} else {
    Write-Host "  No prompt specified. Use -Prompt, -PromptFile, or -Interactive" -ForegroundColor Red
    Write-Host "  Run with -Help for usage examples." -ForegroundColor Yellow
    exit 1
}

if ($AutoApprove) {
    $pipelineCmd += " --auto-approve"
}
if ($NoGUI) {
    $pipelineCmd += " --no-gui"
}
if ($SkipCoresmith) {
    $pipelineCmd += " --skip-coresmith"
    if ($VerilogFiles) {
        foreach ($vf in $VerilogFiles) {
            $pipelineCmd += " --verilog /workspace/$vf"
        }
    }
}

# ---- Execute ----
Write-Host "`n  Starting SiliconIA pipeline..." -ForegroundColor Green
Write-Host "  Command: $pipelineCmd" -ForegroundColor DarkGray
Write-Host ""

$dockerArgs += @("-c", $pipelineCmd)
& docker @dockerArgs

$exitCode = $LASTEXITCODE

if ($exitCode -eq 0) {
    Write-Host "`n  Pipeline completed successfully!" -ForegroundColor Green
    Write-Host "  Check results in: $runsDir" -ForegroundColor Cyan
} else {
    Write-Host "`n  Pipeline exited with code: $exitCode" -ForegroundColor Yellow
    Write-Host "  Check logs in: $runsDir" -ForegroundColor Yellow
}

exit $exitCode
