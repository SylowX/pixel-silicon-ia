import { NextResponse } from "next/server";
import { RUNS_DIR, deleteRun, isValidRunId, listRuns, readCurrentRun } from "@/lib/siliconia";
import { localOnlyGuard } from "@/lib/localGuard";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Lists SiliconIA runs (newest first) plus the run marked active in current_run.json. */
export async function GET() {
  return NextResponse.json({
    runsDir: RUNS_DIR,
    current: readCurrentRun(),
    runs: listRuns(),
  });
}

/** Deletes a run from disk and cleans up current_run.json if needed. */
export async function DELETE(req: Request) {
  const denied = localOnlyGuard(req, false);
  if (denied) return denied;

  const url = new URL(req.url);
  let runId = url.searchParams.get("runId");
  if (!runId && req.headers.get("content-type")?.includes("application/json")) {
    try {
      const body = await req.json();
      runId = body.runId;
    } catch {
      /* ignore */
    }
  }

  if (!runId || !isValidRunId(runId)) {
    return NextResponse.json({ error: "runId inválido" }, { status: 400 });
  }

  const ok = deleteRun(runId);
  if (!ok) {
    return NextResponse.json({ error: "No se pudo eliminar el run (no existe o error en disco)" }, { status: 404 });
  }

  return NextResponse.json({
    ok: true,
    deleted: runId,
    current: readCurrentRun(),
    runs: listRuns(),
  });
}
