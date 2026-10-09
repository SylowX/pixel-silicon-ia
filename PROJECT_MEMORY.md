# 🧠 MEMORIA DEL PROYECTO: PIXEL AGENTS + SILICONIA

> **Documento de Contexto y Continuidad Técnica**  
> Este archivo resume el estado completo de la arquitectura, componentes, integración, calibración visual y comandos operativos de este repositorio. Cualquier agente de IA que inicie o reinicie sesión debe leer este documento para entender de inmediato el contexto del proyecto y continuar su desarrollo sin perder tiempo ni rehacer configuraciones.

---

## 1. Visión General del Proyecto

Este proyecto fusiona dos mundos:
1. **SiliconIA (`./SiliconIA`)**: Fábrica autónoma de diseño de circuitos integrados y semiconductores impulsada por IA (CoreSmith + LangGraph + SkyWater Sky130 PDK + Yosys + OpenROAD Flow Scripts), capaz de transformar una especificación en lenguaje natural (Prompt) en un diseño físico final en formato **GDSII/ODB**.
2. **Pixel Agents (`./src`)**: Interfaz web interactiva estilo retro pixel art (construida con **Next.js 16, React 19, TypeScript y Tailwind CSS v4**), originalmente creada para visualizar agentes de Claude Code y adaptada/expandida integralmente para convertirse en el **Centro de Control y Monitoreo en Tiempo Real de la Fábrica de Silicio SiliconIA**.

---

## 2. Los 6 Roles / Escritorios de la Fábrica de Silicio

La oficina de pixel art mapea exactamente 6 escritorios (`char_0` a `char_5`), cada uno correspondiente a un rol de ingeniería de silicio:

| Escritorio | Rol / Identificador | Nombre Visible | Color | Responsabilidad Principal |
|:---:|:---:|:---:|:---:|:---|
| **0** | `supervisor` | `supervisor` | Ámbar (`#fbbf24`) | Orquestador principal (`silicon_pipeline.py`). Valida PDK Sky130, descompone bloques, coordina fases y genera el reporte final. |
| **1** | `architect` | `architect` | Púrpura (`#a78bfa`) | Especificación de microarquitectura (PRD, diagrama de bloques, especificación uArch y revisión). |
| **2** | `rtl` | `rtl-coder` | Celeste (`#38bdf8`) | Generación de código Verilog-2005 sintetizable, linting con Verilator y diagnóstico iterativo de fallas. |
| **3** | `dv` | `verifier` | Verde Esmeralda (`#34d399`) | Verificación y simulación funcional (`cocotb` en Python, testbenches y análisis de cobertura). |
| **4** | `synth` | `synthesis` | Rosa (`#f472b6`) | Síntesis lógica con **Yosys** mapeando a celdas estándar `sky130_fd_sc_hd` y generación de netlist gate-level. |
| **5** | `pnr` | `pnr` | Índigo (`#818cf8`) | Place & Route físico con **OpenROAD** (Floorplan, Placement de celdas, CTS Clock Tree, Routing de pistas metálicas y Finish GDSII). |

---

## 3. Arquitectura del Sistema Web (Frontend & Backend)

### Servidor y Puerto
- **Puerto configurado**: `3031` (¡NO modificar a 3000 para evitar colisiones con otros servicios del host!).
- **URL Principal**: `http://localhost:3031/pixel-agents` (por defecto `source=siliconia`).
- **Comando de arranque**: `npm run dev -- -p 3031`
- **Launcher 1-click**: `iniciar.bat` en la raíz del proyecto (comprueba Node.js, instala dependencias si faltan, define `SILICONIA_RUNS_DIR`, arranca el servidor en el puerto 3031 en ventana propia y abre el navegador).

### Estructura de Componentes UI (`src/app/pixel-agents/`)
- **`page.tsx`**: Shell principal responsive (`.si-shell`) con disposición en 3 columnas cuando `source === "siliconia"`:
  - **Izquierda (`SiliconBoard.tsx`)**: Tablero de estado en vivo con las tarjetas de los 6 agentes, porcentaje de avance real basado en checklist de pasos, estados de las 10 etapas del pipeline y métricas físicas de silicio (Área en µm², Utilización %, Potencia en mW/µW, Número de Celdas).
  - **Centro**: Lienzos de píxeles (`DeskCanvas.tsx` y `OfficeCanvas.tsx`) mostrando a los personajes trabajando en sus escritorios, caminando o pensando. Incluye el dock inferior **`SiliconComposer.tsx`**.
  - **Derecha (`SiliconSidebar.tsx`)**: Historial de circuitos diseñados (`SiliconHistory.tsx`), feed de eventos en vivo (**`SiliconActivity.tsx`** ubicado entre Historial y Entorno), chips de estado del entorno (Docker Desktop, imagen `siliconia-pipeline:latest`, estado del contenedor), visor de consola auto-desplegable y botón de parada de emergencia.
  - **`SiliconComposer.tsx`**: Barra inferior expandible para describir nuevos circuitos. Soporta **dictado por voz** en español (Web Speech API), ejemplos predeterminados, selector de auto-aprobación y botón de lanzamiento.
  - **`SiliconGui.tsx`**: Componente y botón interactivo para abrir la GUI nativa de OpenROAD directamente sobre el layout físico (`.odb`) de un diseño completado mediante WSLg.

### Calibración y Comportamiento del Edificio (`OfficeCanvas.tsx`)
1. **Niveles del Edificio**:
   - Nivel 4 (Azotea): `Terrace` (piscina despejada sin artefactos visuales y camastros para descanso).
   - Nivel 3: **`Desarrollo`** (oficina principal con 5 estaciones de trabajo y monitores).
   - Nivel 2: `Server Room` (racks de servidores iluminados en azul) y `Meeting Room` (sala de juntas de cristal con mesa redonda y 4 asientos disponibles).
   - Nivel 1: `Lobby` (recepción, cafetería y sofás de relajación).
2. **Dinámica de Trabajo vs. Descanso (`allCompletedOrIdle`)**:
   - **En Diseño Activo**: Los personajes trabajan en sus escritorios de **Desarrollo** (`editing`, `reading`, `searching`) o bajan a los racks de **Server Room** (`running`, `spawning`).
   - **Al Completar (100%) u Ocio**: Cuando todo el equipo finaliza su labor o no hay diseño en curso, los agentes no se quedan atascados en las pantallas; se desplazan a descansar a la **Terraza**, la cafetería del **Lobby** o se reúnen en la **Meeting Room**.
   - **Sala de Juntas Multi-Asiento**: Se expandió la capacidad de la mesa de conferencias con 4 slots (`x = 0.650, 0.700, 0.745, 0.790` en `y = 0.730`), permitiendo que varios agentes debatan o descansen sentados juntos.
3. **Prevención de Solapamiento y Colisiones (`claimedSlots` & `freeSlots`)**:
   - Se implementó un sistema de asignación exclusiva de slots: un agente sentado o en camino a una silla "reclama" la posición.
   - Los demás agentes que buscan asiento o deambulan descartan slots ocupados y eligen sillas libres o puntos de paseo aleatorios independientes, evitando que se encimen o superpongan.
4. **Corrección Visual de la Piscina**:
   - Se eliminaron el `backdrop-filter: blur` y la capa superpuesta con tinte que generaba la ilusión de que los personajes caminaban sumergidos bajo el agua.
5. **Calibración de Alturas en Desarrollo**:
   - **Asientos (`SLOTS_INIT.studio`)**: Coordenada ajustada a `y = 0.493` (~378px de 768px). El cuerpo de los personajes descansa en el cojín de cuero de las sillas (`y = 368-376px`).
   - **Caminata (`ZONE_WALK_FLOOR_Y.studio = 0.500`)**: Altura de suelo calibrada a `0.500` (~384px), asegurando pisada firme sin levitar.
   - **Slots de Server Room**: 4 puestos a lo largo del pasillo (`x = 0.360, 0.430, 0.505, 0.580` en `y = 0.740`).

### Consola del Pipeline en la Barra Lateral (`SiliconSidebar.tsx` + `globals.css`)
- **Auto-despliegue**: Al iniciar un pipeline (`running === true`), la consola se abre de forma automática sin requerir clic del usuario.
- **Aprovechamiento del Espacio**: `.si-log` posee altura dinámica responsiva (`min-height: 220px; max-height: clamp(260px, calc(100vh - 360px), 580px);`), aprovechando el espacio vertical antes del logo flotante del búho (`.si-logo`).
- **Margen de Seguridad**: `.si-side-right` incluye `padding-bottom: 75px` para evitar cualquier solapamiento con el logo.

### API Routes (`src/app/api/pixel-agents/`)
1. **`silicon-stream/route.ts`**: Endpoint SSE (Server-Sent Events) que lee y combina en tiempo real los eventos de `.coresmith/pipeline_events.jsonl` y `siliconia_events.jsonl` de cada ejecución en `SiliconIA/silicon-runs/`, o genera un replay sintético desde `pipeline_report.json`.
2. **`silicon-launch/route.ts`**: Endpoint seguro (`GET`, `POST`, `DELETE`) con guardia de loopback (`localGuard.ts`) para ejecutar `run_pipeline.ps1` en PowerShell con argumentos controlados sin shells inseguros. El método `DELETE` (y la terminación por código 137 / fallas) invoca `abortRun()` para emitir el evento `silicon_abort`, limpiar etapas/agentes a `idle`, marcar el badge en **ABORTADO** y resetear el tablero a 0%.
3. **`silicon-gui/route.ts`**: Lanza contenedores aislados (`siliconia-gui-<runId>`) para levantar la interfaz gráfica de OpenROAD con aceleración X11/WSLg (`/tmp/.X11-unix` y `/mnt/wslg`).
4. **`silicon-runs/route.ts`**:
   - `GET`: Lista los runs existentes, sus métricas, reportes y disponibilidad de archivos de layout `.odb`.
   - `DELETE`: Elimina permanentemente un run del disco (`silicon-runs/<runId>`), reasigna o limpia `current_run.json`, purga en caliente la telemetría en el stream SSE y limpia la tarjeta de "Actividad" en el frontend. Incluye confirmación en 2 pasos en la UI (`SiliconHistory.tsx`).

---

## 4. Pipeline EDA & Core de Silicio (`SiliconIA/`)

### Herramientas EDA Integradas en Docker
- **Docker Image**: `siliconia-pipeline:latest`
- **PDK**: SkyWater 130nm (`sky130A`), librerías de celdas estándar `sky130_fd_sc_hd`.
- **Síntesis Lógica**: Yosys.
- **Simulación & Lint**: Verilator + Icarus Verilog + Cocotb (Python).
- **Flujo Físico Backend**: OpenROAD / OpenROAD-flow-scripts (ORFS).
- **Orquestador**: `SiliconIA/silicon_pipeline.py`.
- **Launcher CLI**: `SiliconIA/run_pipeline.ps1`.
- **Simulación cocotb**: cocotb 2.x exige **Verilator ≥ 5.036**. El `Dockerfile` compila Verilator `v5.036` en una etapa `verilator-build` y lo instala en `/opt/verilator` (primero en `PATH`). `verilator_shim.sh` usa `/opt/verilator` y sólo cae a la 4.038 de apt como respaldo. Hasta 2026-10-05 la simulación **nunca** corría (abortaba con "cocotb requires Verilator 5.036"); los runs "exitosos" seguían sólo porque el orquestador continúa si existe RTL.

### LLM agnóstico y tolerancia a "fatiga" del modelo
- **Configuración** (`pipeline_config.yaml` → `llm`): `provider`, `model` (principal), `fallback_models` (cadena), `model_cooldown_s`, `isolate_workdir`. Overrides del host sin editar el YAML: `SILICONIA_LLM_PROVIDER`, `SILICONIA_LLM_MODEL`, `SILICONIA_LLM_FALLBACKS="m1,m2"` (reenviados por `run_pipeline.ps1`).
- **Failover** (`coresmith-main/orchestrator/langchain/agents/coresmith_llm.py`): si una llamada devuelve/lanza un error de capacidad (`Selected model is at capacity`, 429/503/529, overloaded, rate limit, quota), se reintenta **de inmediato** con el siguiente modelo y el saturado queda en enfriamiento (`CORESMITH_MODEL_COOLDOWN_S`, 300 s). Modelos desconocidos/sin acceso se omiten 6 h. Funciona para cualquier provider (codex, claude, kimi, agy, opencode). Emite el evento `llm_model_fallback` (consola + tarjeta Actividad).
- **Bug corregido en el parser de Codex**: un `turn.failed` a mitad de turno devolvía el último mensaje parcial como si fuera la respuesta; ahora se reporta como error (antes aparecía como "agent did not write <archivo>").
- **Workdir**: `CORESMITH_CODEX_ISOLATE_WORKDIR=0` → el agente trabaja dentro del run; antes usaba carpetas vacías `codex-call-*` y perdía las rutas relativas.
- **Tests**: `orchestrator/tests/test_model_fallback.py`. Correr con `env -u CORESMITH_MODEL -u CORESMITH_CODEX_MODEL ...` y un `CORESMITH_PROJECT_ROOT` temporal: los tests existentes escriben telemetría en `silicon-runs/current`.

### Formatos Generados por Run (`silicon-runs/<runId>/outputs/`)
- **`6_final.odb`**: Base de datos binaria completa de OpenROAD / OpenDB.
- **`6_final.def`**: Formato geométrico estándar de la industria (ASCII). Contiene `DIEAREA`, `COMPONENTS` (posiciones $X,Y$ de celdas), `PINS` y `NETS` de todas las capas metálicas (`li1`, `met1`-`met5`).
- **`6_final.gds`**: Máscara binaria GDSII para fabricación en fundición.
- **Reportes y Métricas**: `6_report.log` y `pipeline_report.json` con área, potencia, timing y celdas.

### Visualización de OpenROAD GUI & Visor Web
- **Ejecución actual**: OpenROAD corre en el contenedor Linux de Docker y actualmente se proyecta mediante X11 de WSLg (`\\wsl.localhost\Ubuntu\tmp\.X11-unix`).
- **Decisión de Arquitectura**: Se ha seleccionado formalmente implementar la **Opción B: Visor Nativo Canvas / WebGL (Lector DEF/GDS)** directamente embebido en el navegador, eliminando la dependencia de ventanas externas de WSLg o servidores VNC.

### Las 10 Etapas Monitoreadas por el Pipeline
1. `pdk`: Validación del kit de diseño Sky130.
2. `spec`: Generación de requerimientos, PRD y arquitectura de bloques con LLM (CoreSmith).
3. `rtl`: Escritura del código Verilog y linting con Verilator.
4. `verify`: Simulación funcional con Cocotb.
5. `logic_synth`: Síntesis lógica con Yosys hacia celdas estándar.
6. `floorplan`: Definición de dimensiones del die/core y disposición de pines I/O.
7. `place`: Colocación física de celdas estándar.
8. `cts`: Clock Tree Synthesis (balanceo de reloj).
9. `route`: Enrutamiento global y detallado de capas metálicas.
10. `finish`: Generación final de archivos DEF, ODB y máscara GDSII.

---

## 5. Rutas Clave y Directorios

- **Raíz del Proyecto**: `C:\Users\carlo\pixel-agents-main`
- **Directorio del Pipeline SiliconIA**: `C:\Users\carlo\pixel-agents-main\SiliconIA`
- **Runs / Resultados de Silicio**: `C:\Users\carlo\pixel-agents-main\SiliconIA\silicon-runs`
- **Modelos y Tipos de Datos**: `src/lib/siliconia.ts`
- **Launcher para Windows**: `iniciar.bat`

---

## 6. Comandos Frecuentes y Guía de Operación

### Levantar la Web (Dev Server)
```powershell
npm run dev -- -p 3031
# O simplemente ejecutar haciendo doble clic en:
.\iniciar.bat
```

### Ejecutar un Diseño Manualmente por CLI (PowerShell)
```powershell
cd C:\Users\carlo\pixel-agents-main\SiliconIA
.\run_pipeline.ps1 "Diseña un sumador de 32 bits con acarreo" -AutoApprove
```

### Abrir el Layout Físico en la GUI de OpenROAD
```powershell
.\run_pipeline.ps1 -ShowGUI [nombre_del_run_o_vacio_para_el_ultimo]
```

---

## 7. Reglas Críticas para Futuros Agentes de IA

1. **Nunca cambiar el puerto 3031 a 3000** salvo instrucción explícita del usuario.
2. **Seguridad local**: Cualquier nuevo endpoint que invoque procesos en el host debe usar `localOnlyGuard` (`src/lib/localGuard.ts`).
3. **Calibración geométrica de personajes**: Si se modifica el fondo del edificio o se mueven muebles, respetar las fracciones de altura `SLOTS_INIT.studio.y = 0.493` y `ZONE_WALK_FLOOR_Y.studio = 0.500`.
4. **Persistencia de telemetría**: Si se agregan nuevas etapas o métricas a `silicon_pipeline.py`, deben reflejarse tanto en `TASK_DEFS` y `PIPELINE_STAGES` en `src/lib/siliconia.ts` como en `SiliconBoard.tsx`.

---

## 8. Próxima Tarea Aprobada: Visor Nativo Canvas / WebGL (Lector DEF/GDS) [Opción B]

> **ESTADO: APROBADO PARA IMPLEMENTACIÓN**  
> El usuario ha seleccionado formalmente la **Opción B** para visualizar los resultados de silicio directamente en el navegador, sin depender de ventanas externas de WSLg ni de tener OpenROAD instalado localmente en Windows.

### 8.1. Objetivo
Desarrollar un visor de layout físico de circuitos integrados embebido directamente en la aplicación web (`http://localhost:3031/pixel-agents`), que lea los archivos resultantes del pipeline (`6_final.def` y opcionalmente `.gds`) y renderice el chip en un lienzo interactivo de alto rendimiento (HTML5 Canvas 2D / WebGL) a 60 FPS.

### 8.2. Archivos Fuente del Circuito
Ubicados en `SiliconIA/silicon-runs/<runId>/outputs/`:
- **`6_final.def`**: Archivo de texto estructurado en estándar IEEE/Cadence DEF (Design Exchange Format). Contiene:
  - `UNITS DISTANCE MICRONS <factor>`: Escala de coordenadas (típicamente 1000 DBU por micra en Sky130).
  - `DIEAREA ( x1 y1 ) ( x2 y2 )`: Límites físicos del silicio.
  - `COMPONENTS <n>`: Lista de celdas colocadas con nombre, tipo (`sky130_fd_sc_hd__...`), coordenadas `( X Y )` y orientación (`N`, `S`, `FN`, etc.).
  - `PINS <n>`: Pines de entrada/salida en el perímetro del chip con sus capas y posiciones.
  - `SPECIALNETS`: Rieles de alimentación (`VDD`, `VSS`) y mallas globales.
  - `NETS`: Enrutamiento de señales en capas metálicas (`li1`, `met1`, `met2`, `met3`, `met4`, `met5`) con pares de coordenadas de segmentos de pistas.

### 8.3. Arquitectura de Implementación

#### 1. Backend Parser (`src/app/api/pixel-agents/silicon-layout/route.ts`)
- **Método**: `GET /api/pixel-agents/silicon-layout?runId=<runId>&layerDetail=<low|high>`
- **Función**:
  - Lee de forma eficiente el archivo `6_final.def` del run solicitado.
  - Parsea las secciones principales: `DIEAREA`, `COMPONENTS`, `PINS`, y opcionalmente las pistas de `NETS` / `SPECIALNETS`.
  - Puede cachear el resultado en formato liviano JSON (`silicon_layout.json` dentro de la carpeta del run) para cargas instantáneas subsecuentes.
  - Retorna un payload JSON optimizado con:
    ```json
    {
      "runId": "un-20261004-175043",
      "units": 1000,
      "dieArea": { "x1": 0, "y1": 0, "x2": 150000, "y2": 150000 },
      "components": [
        { "name": "_042_", "type": "sky130_fd_sc_hd__nand2_1", "x": 12400, "y": 25000, "orient": "N", "w": 1380, "h": 2720 }
      ],
      "pins": [...],
      "netsCount": 184,
      "stats": { "cellCount": 115, "areaUm2": 22500 }
    }
    ```

#### 2. Componente Frontend (`src/app/pixel-agents/SiliconLayoutViewer.tsx`)
- **Lienzo**: Canvas interactivo con transformaciones matriciales 2D (Pan & Zoom mediante arrastre y rueda del ratón).
- **Capas Conmutables (Layer Toggles)**:
  - Marco del Die (`DIEAREA`).
  - Celdas Estándar (renderizadas con colores codificados según tipo: compuertas lógicas, flip-flops, buffers).
  - Rieles de Alimentación (VDD / VSS).
  - Pistas Metálicas (Met1 azul, Met2 naranja, Met3 verde, etc.).
  - Pines I/O perimetrales con etiquetas de señal (`clk`, `rst`, `data_in`, etc.).
- **Inspección de Celdas (Hover / Click Inspector)**:
  - Al pasar el cursor o hacer clic sobre una compuerta, muestra un popup contextual flotante con el nombre de la instancia, tipo de celda, dimensiones y posición exacta en micras.
- **Controles Rápidos**:
  - `Centrar / Reset Zoom` (ajuste automático a la vista completa del die).
  - Selector de resolución / nivel de detalle.
  - Selector de capas individuales (on/off).

#### 3. Puntos de Integración en la UI
- **`SiliconSidebar.tsx` / `SiliconHistory.tsx`**: Añadir un botón destacado **"Ver Layout Web (DEF)"** junto a cada corrida completada que disponga de archivos de salida.
- **Modal o Pestaña Integrada**: Al hacer clic, abre el visor como un modal flotante o una vista de pantalla completa estilizada con la paleta retro/cyberpunk del proyecto.

---

## 9. Desglose Detallado de los 6 Roles de Silicio

Cada uno de los 6 puestos representa una etapa de la metodología ASIC industrial:

1. **Supervisor (`supervisor`)**:
   - Actúa como el Director Técnico / Project Lead.
   - Valida el entorno y PDK SkyWater 130nm, divide el prompt en requerimientos viables, orquesta a los demás agentes, y al final recolecta las métricas de síntesis y PnR para consolidar el `pipeline_report.json`.
2. **Architect (`architect`)**:
   - Ingeniero de Arquitectura y Especificación.
   - Convierte el lenguaje natural en un documento de microarquitectura (`uarch_specs`), definiendo interfaces de pines (`clk`, `rst`, buses), anchos de palabra, máquinas de estados y partición de bloques.
3. **RTL Coder (`rtl`)**:
   - Diseñador de Lógica Digital Front-End.
   - Escribe el código Verilog-2005 sintetizable y ejecuta Verilator para linting estático. Si hay errores de sintaxis, los corrige iterativamente mediante bucles de reflexión con el LLM.
4. **Verification / DV (`dv`)**:
   - Ingeniero de Verificación Funcional (Design Verification).
   - Genera bancos de prueba en Python usando **Cocotb** y corre simulaciones con Verilator 5.036. Inyecta vectores de estímulo exhaustivos o aleatorios y mide cobertura funcional.
5. **Synthesis (`synth`)**:
   - Ingeniero de Síntesis Lógica.
   - Toma el Verilog verificado y mediante **Yosys** lo traduce a una red de compuertas lógicas (netlist gate-level), mapeando cada función booleana a las celdas estándar de la biblioteca SkyWater `sky130_fd_sc_hd`.
6. **Place & Route (`pnr`)**:
   - Ingeniero de Diseño Físico Back-End.
   - Utiliza **OpenROAD** para crear el layout físico: define el tamaño del chip y pines (Floorplan), ubica las celdas (Placement), construye el árbol balanceado de reloj (CTS), traza las pistas metálicas (Routing) y exporta los archivos de manufactura (DEF, ODB y máscara GDSII).

---

## 10. Interpretación de Métricas de Silicio y Escalado de Nanómetros

En la tecnología **SkyWater 130nm (`sky130A`)**:
- El nodo de fabricación base es **130 nm** (longitud mínima del canal del transistor).
- Las métricas de dimensiones en los reportes o logs (ej. `1,215 nm` vs `798 nm` o medidas de área en µm²) corresponden a las dimensiones físicas de las celdas estándar, la densidad de empaquetado o el área ocupada por la lógica.
- Cuando una nueva iteración de un circuito (ej. ALU de 8 bits) reduce su huella de `1,215 nm` a `798 nm` o su área total en micrómetros cuadrados:
  - **Representa una optimización directa**: Mejor síntesis booleana (menos compuertas redundantes), mejor selección de celdas por parte de Yosys o un empaquetado más denso en OpenROAD.
  - **Beneficios en silicio**: Menor área de oblea ocupada (menor costo por chip), menor capacitancia parásita en las interconexiones, menor consumo de potencia dinámica y menor retardo de propagación (mayor frecuencia máxima alcanzable).

