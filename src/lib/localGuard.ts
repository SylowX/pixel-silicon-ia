// Shared guard for local-only API routes that execute commands on this machine
// (pipeline launcher, OpenROAD GUI launcher).
//
// Only same-origin requests addressed to a loopback host are accepted. Pair it
// with a dev server bound to loopback:  next dev -p 3031 -H 127.0.0.1

/** Returns an error Response when the request is not allowed, otherwise null. */
export function localOnlyGuard(req: Request, requireJson: boolean): Response | null {
  const host = (req.headers.get("host") ?? "").toLowerCase();
  const hostname = host.startsWith("[") ? host.slice(0, host.indexOf("]") + 1) : host.split(":")[0];
  if (!["localhost", "127.0.0.1", "[::1]"].includes(hostname)) {
    return Response.json({ error: "Solo disponible desde localhost" }, { status: 403 });
  }
  const origin = req.headers.get("origin");
  if (origin) {
    let oh = "";
    try { oh = new URL(origin).host.toLowerCase(); } catch { /* invalid */ }
    if (oh !== host) return Response.json({ error: "Origen no permitido" }, { status: 403 });
  }
  if (requireJson && !(req.headers.get("content-type") ?? "").toLowerCase().startsWith("application/json")) {
    return Response.json({ error: "Content-Type debe ser application/json" }, { status: 415 });
  }
  return null;
}

// eslint-disable-next-line no-control-regex
const ANSI_RE = /\x1b\[[0-9;?]*[ -/]*[@-~]/g;

export function stripAnsi(s: string): string {
  return s.replace(ANSI_RE, "").replace(/\r(?!\n)/g, "\n");
}
