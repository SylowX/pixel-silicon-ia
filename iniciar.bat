@echo off
setlocal EnableDelayedExpansion
chcp 65001 >nul
title Pixel Agents - Launcher

rem Carpeta del proyecto = carpeta donde esta este .bat
cd /d "%~dp0"

set PORT=3031
set URL=http://localhost:%PORT%

echo.
echo  ==========================================
echo    Pixel Agents + SiliconIA - Launcher
echo  ==========================================
echo.

rem ---- Verificar Node.js ----
where node >nul 2>nul
if errorlevel 1 (
    echo  [ERROR] Node.js no esta instalado o no esta en el PATH.
    echo          Descargalo en https://nodejs.org
    pause
    exit /b 1
)

rem ---- Instalar dependencias si faltan ----
if not exist "node_modules\next" (
    echo  [1/3] Instalando dependencias ^(npm install^)...
    call npm install
    if errorlevel 1 (
        echo  [ERROR] Fallo npm install.
        pause
        exit /b 1
    )
) else (
    echo  [1/3] Dependencias OK.
)

rem ---- Variables de entorno: carpeta de runs de SiliconIA ----
if not defined SILICONIA_RUNS_DIR set "SILICONIA_RUNS_DIR=%~dp0SiliconIA\silicon-runs"
if not exist "%SILICONIA_RUNS_DIR%" mkdir "%SILICONIA_RUNS_DIR%"
echo  [2/3] SILICONIA_RUNS_DIR=%SILICONIA_RUNS_DIR%

rem ---- Aviso de Docker (solo necesario para ejecutar el pipeline) ----
docker version >nul 2>nul
if errorlevel 1 (
    echo        Aviso: Docker no esta activo. La web funciona, pero para lanzar
    echo        el pipeline SiliconIA necesitas iniciar Docker Desktop.
)

rem ---- Si el puerto ya esta en uso, solo abrir el navegador ----
netstat -ano | findstr /R /C:":%PORT% .*LISTENING" >nul
if not errorlevel 1 (
    echo  [3/3] Ya hay un servidor en el puerto %PORT%. Abriendo navegador...
    start "" "%URL%"
    exit /b 0
)

rem ---- Levantar servidor Next.js en una ventana aparte ----
echo  [3/3] Iniciando servidor web en %URL% ...
start "Pixel Agents - Servidor (cierra esta ventana para detenerlo)" cmd /k "cd /d "%~dp0" && npm run dev -- -p %PORT%"

rem ---- Esperar a que el servidor responda y abrir el navegador ----
echo        Esperando a que el servidor este listo...
powershell -NoProfile -Command "$u='%URL%'; for($i=0;$i -lt 90;$i++){ try { Invoke-WebRequest -Uri $u -UseBasicParsing -TimeoutSec 2 | Out-Null; exit 0 } catch { Start-Sleep -Seconds 1 } }; exit 1"

start "" "%URL%"
echo.
echo  Listo. Web abierta en %URL%
timeout /t 3 >nul
endlocal
