Listed directory SiliconIA
Searched for "agent"
Viewed integration_plan_01_290926.md:1-150
Listed directory coresmith-main
Listed directory orchestrator
Listed directory langgraph
Viewed README.md:1-100
Viewed CLAUDE.md:1-120
Viewed silicon_pipeline.py:1-140
Viewed silicon_pipeline.py:141-260
Viewed silicon_pipeline.py:261-380
Viewed silicon_pipeline.py:381-500
Viewed silicon_pipeline.py:501-620
Searched for "agent"
Viewed pipeline_graph.py:1-100
Viewed architecture_graph.py:1-60

En el proyecto **SiliconIA** (`C:\Users\carlo\SiliconIA`), la meta es convertir una especificación en lenguaje natural (un prompt) en un chip de silicio real (**GDSII**), visualizable en el GUI de OpenROAD.

A continuación te detallo **cuántos agentes se levantan**, qué rol cumple cada uno y **el pipeline a grandes rasgos**.

---

## 1. ¿Cuántos agentes de IA intervienen en el diseño?

El proyecto utiliza **[CoreSmith](file:///c:/Users/carlo/SiliconIA/coresmith-main)** (desarrollado sobre **LangGraph**), coordinado por el script orquestador **[silicon_pipeline.py](file:///c:/Users/carlo/SiliconIA/silicon_pipeline.py)**. 

No se levanta un único agente estático, sino una **red multi-agente organizada en 3 niveles/fases principales**:

### Nivel 0: El Orquestador Externo (Supervisor)
* **Agente Supervisor / Driver:** [silicon_pipeline.py](file:///c:/Users/carlo/SiliconIA/silicon_pipeline.py) ejecuta el demonio de CoreSmith, escucha los eventos en tiempo real (`pipeline_events.jsonl`) y resuelve las interrupciones humanas (*human-in-the-loop*) de forma automática (`--auto-approve`) o interactiva.

---

### Nivel 1: Subagentes de Arquitectura ([architecture_graph.py](file:///c:/Users/carlo/SiliconIA/coresmith-main/orchestrator/langgraph/architecture_graph.py)) *(3 a 5 agentes)*
Si se inicia desde requerimientos complejos, se levantan secuencialmente:
1. **Requirements & PRD Agent:** Analiza el prompt y crea el documento de requerimientos del producto (PRD).
2. **System Architect Agent:** Propone la descomposición modular, define la arquitectura del sistema (SAD/FRD) y genera el diagrama en bloques (`block_diagram.json`).
3. **Constraint & Memory/Clock Agent:** Valida restricciones técnicas (reglas de dominio de reloj, buses de memoria, áreas estimadas).

---

### Nivel 2: Subagentes por Bloque / RTL Frontend ([pipeline_graph.py](file:///c:/Users/carlo/SiliconIA/coresmith-main/orchestrator/langgraph/pipeline_graph.py)) *(4 agentes por cada bloque)*
Para cada módulo de hardware a diseñar (por ejemplo, si el chip tiene una ALU y un decodificador, o un módulo individual como `adder32`):
1. **Micro-Architecture (uArch) Agent:** Diseña la microarquitectura específica del bloque, sus interfaces, puertos y latencias esperadas.
2. **RTL Generation Agent:** Escribe el código en Verilog sintetizable (Verilog-2005) e itera con Verilator si hay errores de sintaxis o *linting*.
3. **Verification (DV) Agent:** Escribe los bancos de prueba (`cocotb` en Python) para verificar funcionalmente el bloque y medir la cobertura de líneas.
4. **Diagnosis & Debug Agent:** Si la simulación o la síntesis lógica (Yosys) fallan, este agente analiza el log del simulador/sintetizador y le devuelve instrucciones correctivas al agente de RTL.

> **Resumen del conteo:**  
> Para un diseño estándar de 1 bloque (como un sumador o ALU), intervienen activamente **entre 4 y 7 agentes LLM especializados**. Si el chip se descompone en $N$ bloques que corren en paralelo dentro del grafo de LangGraph, se ejecutan $4 \times N$ instancias especializadas más los agentes de integración del chip completo (`chip_top`).

---

## 2. Pipeline a Grosso Modo (Flujo de Ejecución)

El flujo completo consta de **4 Fases Consecutivas**:

```
[Prompt de Usuario]
        │
        ▼
┌─────────────────────────────────────────────────────────────┐
│ FASE 1: CoreSmith (Diseño Frontend con LLM + EDA básico)    │
│  1. Especificación & Bloques (blocks.yaml / PRD)            │
│  2. Generación de Verilog (RTL)                             │
│  3. Simulación & Cobertura (Verilator + Cocotb)             │
│  4. Síntesis Lógica (Yosys → Netlist a nivel compuertas)    │
└─────────────────────────────────────────────────────────────┘
        │
        ▼ (Archivos .v sintetizados + constraints .sdc)
┌─────────────────────────────────────────────────────────────┐
│ FASE 2: OpenROAD-flow-scripts (Diseño Físico / Backend)     │
│  1. Generación dinámica de config.mk                        │
│  2. Floorplanning (Definición del área de silicio e I/O)    │
│  3. Placement (Colocación de celdas estándar)               │
│  4. Clock Tree Synthesis / CTS (Árbol de reloj balanceado)  │
│  5. Routing (Enrutamiento de pistas metálicas)              │
│  6. Finish (Generación de layouts DEF, ODB y GDSII)         │
└─────────────────────────────────────────────────────────────┘
        │ (Usa el PDK Open-Source)
        ├──► FASE 3: SkyWater Sky130 PDK (Celdas estándar y reglas físicas)
        │
        ▼
┌─────────────────────────────────────────────────────────────┐
│ FASE 4: Visualización GUI (OpenROAD)                        │
│  Abre interactivamente el layout 2D del chip terminado      │
└─────────────────────────────────────────────────────────────┘
```

### Paso a paso de lo que está ocurriendo internamente:

1. **Lanzamiento:** Ejecutas [run_pipeline.ps1](file:///c:/Users/carlo/SiliconIA/run_pipeline.ps1) con un prompt (ej. `"Design a 32-bit ripple carry adder"`).
2. **Entorno Docker:** Se inicia el contenedor Docker `siliconia-pipeline` que tiene montadas las herramientas de EDA (`yosys`, `openroad`, `verilator`) y el PDK de SkyWater 130nm.
3. **Fase 1 (Frontend - CoreSmith):**
   * El orquestador crea [inputs/requirements.md](file:///c:/Users/carlo/SiliconIA/integration_plan_01_290926.md) y [blocks.yaml](file:///c:/Users/carlo/SiliconIA/silicon_pipeline.py#L238-L256).
   * Los agentes generan el código Verilog en `silicon-runs/<run_id>/rtl/`.
   * Verilator verifica que no haya advertencias ni errores lógicos.
   * Yosys mapea el Verilog a celdas lógicas de SkyWater (`sky130_fd_sc_hd`) y produce un archivo Netlist (`.v`) y los retardos de reloj (`.sdc`).
4. **Fase 2 (Backend - OpenROAD Flow Scripts):**
   * El orquestador toma el netlist sintetizado, detecta los puertos de reloj y genera automáticamente un archivo `config.mk`.
   * OpenROAD coloca físicamente los transistores en la matriz de silicio, crea la red de distribución de reloj y conecta los cables metálicos.
5. **Fase 4 (Salida & Visualización):**
   * Se exportan los archivos finales del chip (`.gds`, `.odb`).
   * Si no se especifica `-NoGUI`, se abre la interfaz gráfica de OpenROAD con un script TCL precargado para que puedas inspeccionar visualmente las pistas de metal y celdas del silicio generado.