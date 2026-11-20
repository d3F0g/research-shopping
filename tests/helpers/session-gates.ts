import { createHash } from "node:crypto";

type Gate = {
  phase: "headers" | "body";
  entered: boolean;
  released: boolean;
  release: () => void;
  wait: Promise<void>;
};

export function sessionGates(fetchApp: (request: Request) => Response | Promise<Response>) {
  let gate: Gate | null = null;
  let sequence = 0;
  const events: Record<string, unknown>[] = [];
  const digest = (header: string | null) => {
    const id = header?.match(/(?:^|;\s*)fieldnote-session=([^;]+)/)?.[1];
    return id ? createHash("sha256").update(id).digest("hex").slice(0, 12) : null;
  };
  return async (request: Request) => {
    const url = new URL(request.url);
    if (url.pathname === "/api/test-session-control") {
      if (request.method === "POST") {
        const input = await request.json() as {
          action: "arm" | "release" | "reset";
          phase?: Gate["phase"];
        };
        if (input.action === "arm") {
          if (gate && !gate.released) return Response.json({ error: "Unreleased fixture gate" }, { status: 409 });
          let release!: () => void;
          const wait = new Promise<void>((resolve) => { release = resolve; });
          gate = { phase: input.phase ?? "headers", entered: false, released: false, release, wait };
        } else {
          if (gate) { gate.released = true; gate.release(); }
          if (input.action === "reset") { gate = null; events.length = 0; sequence = 0; }
        }
      }
      return Response.json({ events, gate: gate && { entered: gate.entered, released: gate.released, phase: gate.phase } });
    }
    if (!url.pathname.startsWith("/api/") || url.pathname.startsWith("/api/test-") || url.searchParams.has("session-proof")) return fetchApp(request);
    const id = ++sequence;
    const record = (event: string, values: Record<string, unknown> = {}) => events.push({ id, event, path: url.pathname, ...values });
    record("request", { cookie: digest(request.headers.get("cookie")) });
    request.signal.addEventListener("abort", () => record("aborted"), { once: true });
    const response = await fetchApp(request);
    record("created", { cookie: digest(response.headers.get("set-cookie")), status: response.status });
    const held = gate && !gate.entered && url.pathname === "/api/session" ? gate : null;
    if (!held) return response;
    held.entered = true;
    const text = await response.text();
    record("held", { phase: held.phase, snapshot: JSON.parse(text) });
    const headers = new Headers(response.headers);
    if (held.phase === "headers") {
      await held.wait;
      record("released", { aborted: request.signal.aborted });
      return new Response(text, { headers, status: response.status });
    }
    headers.delete("content-length");
    let cancelled = false;
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(text.slice(0, 1)));
        void held.wait.then(() => {
          record("released", { aborted: request.signal.aborted, cancelled });
          if (!cancelled) {
            controller.enqueue(new TextEncoder().encode(text.slice(1)));
            controller.close();
          }
        });
      },
      cancel() { cancelled = true; record("body-cancelled"); },
    });
    return new Response(stream, { headers, status: response.status });
  };
}
