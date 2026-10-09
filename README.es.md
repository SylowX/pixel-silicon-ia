# Pixel Agents + SiliconIA ⚡

![SiliconIA - Agentes de IA diseñan chips](./Siliconia_%20agentes%20de%20IA%20dise%C3%B1an%20chips.png)

Visualización en tiempo real y centro de control para la **fábrica autónoma de diseño de circuitos integrados SiliconIA**, con estilo retro pixel art.

Este proyecto transforma la especificación en lenguaje natural de un circuito (*Prompt*) en un diseño de silicio real con layout físico (**GDSII / ODB**), permitiendo monitorear visualmente a cada agente de la fábrica mientras trabaja en su escritorio.

> Proyecto base: [Vasyl Pavlyuchok](https://vasylpavlyuchok.com) · Sprites por [pablodelucca](https://github.com/pablodelucca/pixel-agents) (MIT)  
> Integración con SiliconIA: Fábrica de semiconductores impulsada por LLMs + OpenROAD + Sky130 PDK.

---

![Vista previa de Pixel Agents](public/pixel-agents-office-v2.webp)

## 🌟 Qué hace este proyecto

- **Visualización en Tiempo Real de Silicio**: Monitorea el progreso de la red de agentes de IA de [CoreSmith](SiliconIA/coresmith-main) y el flujo físico de [OpenROAD](SiliconIA/OpenROAD-flow-scripts-master).
- **6 Escritorios Especializados**: Cada puesto de trabajo representa un rol clave en el equipo de ingeniería de semiconductores:
  - 🟡 **Asiento 0 · Supervisor (`supervisor`)**: Orquesta el pipeline completo, valida el PDK Sky130 y descompone los bloques.
  - 🟣 **Asiento 1 · Arquitecto (`architect`)**: Redacta el PRD, diagrama en bloques y especificación de microarquitectura (uArch).
  - 🔵 **Asiento 2 · Codificador RTL (`rtl`)**: Genera el código Verilog-2005 sintetizable y diagnostica errores de sintaxis/linting.
  - 🟢 **Asiento 3 · Verificador (`dv`)**: Crea bancos de prueba en Python (`cocotb`), ejecuta simulaciones funcionales y mide cobertura.
  - 🌸 **Asiento 4 · Síntesis (`synth`)**: Sintetiza la lógica con **Yosys** mapeando a celdas estándar `sky130_fd_sc_hd`.
  - 🟣 **Asiento 5 · Place & Route (`pnr`)**: Implementa el layout físico con **OpenROAD** (Floorplan, Placement, CTS, Routing y GDSII).
- **Tablero de Métricas de Hardware (`SiliconBoard`)**: Muestra el porcentaje de avance real por checklist, estados de las 10 etapas del pipeline y métricas físicas de silicio extraídas de los logs de OpenROAD:
  - Área del chip (µm²)
  - Porcentaje de utilización
  - Consumo de potencia estimado (mW / µW)
  - Recuento de celdas estándar
- **Resiliencia LLM Agnóstica y Tolerancia a "Fatiga" de Modelo**: Failover automático e inmediato en caliente (`pipeline_config.yaml`). Si el proveedor o modelo se satura (429, 503, "at capacity"), conmuta instantáneamente al siguiente modelo de respaldo (`fallback_models`) y pone el modelo saturado en enfriamiento (`model_cooldown_s`). Permite overrides directos desde el host con `SILICONIA_LLM_PROVIDER`, `SILICONIA_LLM_MODEL` y `SILICONIA_LLM_FALLBACKS`.
- **Verificación Funcional con Cocotb 2.x & Verilator 5.036**: Entorno Docker recompilado con soporte nativo para bancos de prueba en Python, permitiendo simulación y cobertura funcional completa antes de la síntesis lógica.
- **Edificio Interactivo Pixel Art con Dinámica de Descanso (`OfficeCanvas`)**:
  - **Trabajo vs. Descanso**: Cuando los agentes están en diseño activo operan en sus estaciones de *Desarrollo* o los racks de *Server Room*. Al terminar (100%) o en estado ocioso, se trasladan de forma natural a relajarse a la *Terraza*, la cafetería del *Lobby* o a debatir en la *Sala de Juntas*.
  - **Sala de Juntas Multi-Asiento**: Mesa de conferencias ampliada con 4 asientos simultáneos.
  - **Prevención de Solapamiento (Anti-Colisión)**: Sistema de reserva exclusiva de asientos (`claimedSlots`) y deambulación inteligente para evitar que los personajes se encimen.
  - **Terraza Despejada**: Corrección de artefactos y desenfoque en la piscina.
- **Compositor de Circuitos con Voz (`SiliconComposer`)**: Barra inferior desplegable para pedir nuevos diseños en lenguaje natural, con soporte para **dictado por voz** en español (Web Speech API) y ejemplos preconfigurados.
- **Visor GUI de Layout Físico (`SiliconGui`)**: Abre la interfaz gráfica nativa de **OpenROAD GUI** para inspeccionar las pistas metálicas y el empaquetado del chip terminado mediante WSLg (`/tmp/.X11-unix`).
- **Historial, Tarjeta de Actividad y Parada Inmediata**: Registro cronológico de chips diseñados, eliminación en caliente de corridas con purga de telemetría y tarjeta de actividad, botón de parada de emergencia con reset inmediato a 0% e indicadores de salud de Docker.
- **Modo Dual**: Visualiza ejecuciones de SiliconIA (por defecto) o sesiones locales de Claude Code mediante Server-Sent Events (SSE).

---

## 🛠️ Requisitos

1. **Node.js 18+** instalado en el sistema.
2. **Docker Desktop** (necesario para construir o ejecutar el pipeline EDA de silicio y la GUI de OpenROAD).
3. **WSL2 con soporte WSLg** (opcional, para abrir interactivamente la GUI de OpenROAD en Windows).

---

## 🚀 Inicio Rápido

### Opción 1: Lanzador de un clic (Windows)
Haz doble clic en el archivo [iniciar.bat](iniciar.bat) en la raíz del proyecto.
El script:
1. Comprueba la instalación de Node.js e instala dependencias si faltan.
2. Configura las variables de entorno para `silicon-runs`.
3. Levanta el servidor web en el **puerto 3031**.
4. Abre automáticamente tu navegador en `http://localhost:3031/pixel-agents`.

### Opción 2: Inicio manual por terminal
```powershell
# 1. Instalar dependencias
npm install

# 2. Iniciar el servidor web en el puerto 3031
npm run dev -- -p 3031
```
Abre tu navegador en:  
👉 **`http://localhost:3031/pixel-agents`**

---

## 💡 Cómo Diseñar un Circuito

### Desde la Web
1. En la parte inferior de la pantalla, haz clic en la barra **"NUEVO CIRCUITO"** o usa el botón de micrófono 🎙️ para dictar.
2. Escribe una descripción de tu circuito (ejemplo: *"Diseña una ALU de 8 bits con suma, resta, AND, OR y XOR"*).
3. Presiona **"Lanzar a silicio"**. El supervisor y los agentes se pondrán a trabajar inmediatamente.

### Desde la Consola (PowerShell)
También puedes ejecutar el pipeline directamente con el script PowerShell:
```powershell
cd SiliconIA
.\run_pipeline.ps1 "Diseña un sumador de 32 bits con acarreo" -AutoApprove
```

Para abrir el visor físico de un diseño completado:
```powershell
.\run_pipeline.ps1 -ShowGUI
```

---

## 📁 Estructura del Proyecto

```
pixel-agents-main/
├── iniciar.bat                       ← Lanzador rápido de un clic para Windows (puerto 3031)
├── PROJECT_MEMORY.md                 ← Memoria técnica y arquitectura para agentes
├── AGENTS.md                         ← Reglas de Antigravity para este repositorio
├── SiliconIA/                        ← Fábrica de diseño de semiconductores
│   ├── pipeline_config.yaml          ← Configuración centralizada de LLM, modelos y fallbacks
│   ├── run_pipeline.ps1              ← Launcher PowerShell para Docker
│   ├── silicon_pipeline.py           ← Orquestador Python multi-agente
│   ├── Dockerfile                    ← Contenedor unificado (Verilator 5 + Yosys + OpenROAD + Sky130)
│   ├── coresmith-main/               ← Red multi-agente y fallbacks de LLM
│   └── silicon-runs/                 ← Salidas, logs, netlists (.v), ODB y GDSII
├── src/
│   ├── app/
│   │   ├── api/pixel-agents/
│   │   │   ├── silicon-stream/       ← Streaming SSE de eventos de silicio
│   │   │   ├── silicon-launch/       ← Endpoint de control, lanzamiento y aborto
│   │   │   ├── silicon-gui/          ← Lanzador del visor OpenROAD GUI (WSLg)
│   │   │   └── silicon-runs/         ← API de historial, métricas y eliminación de corridas
│   │   └── pixel-agents/
│   │       ├── page.tsx              ← Vista de 3 columnas (Tablero · Píxeles · Entorno)
│   │       ├── SiliconBoard.tsx      ← Tablero de agentes, checklist y métricas
│   │       ├── SiliconComposer.tsx   ← Entrada de prompt con voz y ejemplos
│   │       ├── SiliconSidebar.tsx    ← Historial, estado de Docker y visor de consola
│   │       ├── SiliconActivity.tsx   ← Tarjeta de actividad en vivo y eventos del pipeline
│   │       ├── DeskCanvas.tsx        ← Renderizado de los 6 escritorios animados
│   │       └── OfficeCanvas.tsx      ← Edificio de oficinas de pixel art multi-nivel
│   └── lib/
│       ├── siliconia.ts              ← Tipos, checklists, parser de métricas y telemetría
│       └── localGuard.ts             ← Protección de seguridad loopback para endpoints
```

---

## 📜 Licencia y Créditos

- **Pixel Agents**: Licencia MIT © Vasyl Pavlyuchok.
- **Sprites**: [pablodelucca/pixel-agents](https://github.com/pablodelucca/pixel-agents) (MIT).
- **Pipeline SiliconIA**: Integra herramientas EDA de código abierto (OpenROAD, Yosys, Verilator, Cocotb y SkyWater Sky130 PDK).

---

[English Version](README.md)
