import { NextResponse } from "next/server";
import { RUNS_DIR, listRuns, readCurrentRun } from "@/lib/siliconia";

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
