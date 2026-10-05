# Reglas e Instrucciones para Agentes de Antigravity (Pixel Agents + SiliconIA)

Este repositorio contiene la integración entre **Pixel Agents** y la fábrica de semiconductores **SiliconIA**.

## Memoria Principal del Proyecto
Por favor consulta siempre [PROJECT_MEMORY.md](file:///c:/Users/carlo/pixel-agents-main/PROJECT_MEMORY.md) para conocer la arquitectura completa, roles de los agentes de silicio, puertos, flujos de telemetría y comandos operativos.

## Reglas Críticas de Operación
1. **Puerto del Servidor Web**: La aplicación web se ejecuta en el **puerto 3031** (`http://localhost:3031/pixel-agents`). No modificar a 3000.
2. **Lanzador Rápido**: El archivo [iniciar.bat](file:///c:/Users/carlo/pixel-agents-main/iniciar.bat) en la raíz levanta el entorno con doble clic en Windows.
3. **Pipeline de Silicio**:
   - Se ejecuta vía Docker (`siliconia-pipeline:latest`).
   - El script launcher es `SiliconIA/run_pipeline.ps1`.
   - La telemetría se guarda en `SiliconIA/silicon-runs/`.
4. **Mapeo de Escritorios y Roles**:
   - Asiento 0: `supervisor` (Ámbar)
   - Asiento 1: `architect` (Púrpura)
   - Asiento 2: `rtl` (Celeste)
   - Asiento 3: `dv` (Verde)
   - Asiento 4: `synth` (Rosa)
   - Asiento 5: `pnr` (Índigo)
5. **Seguridad**: Todos los endpoints locales que ejecuten comandos en el host deben estar protegidos con `localOnlyGuard` (`src/lib/localGuard.ts`).
