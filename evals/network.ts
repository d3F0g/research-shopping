const originalFetch = globalThis.fetch;
type Policy = { origins: Set<string>; denied: string[]; maximumOrigins: number; traceHeaders: Map<string, () => Record<string, string>> };
let active: Policy | null = null;
const guardedFetch: typeof fetch = async (input, init) => {
  const policy = active;
  const target = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
  if (!policy || !policy.origins.has(target.origin) || target.username || target.password) {
    policy?.denied.push(`${target.protocol}//${target.host}${target.pathname}`);
    throw new Error(`Offline evaluation denied network destination ${target.origin}`);
  }
  const trace = policy.traceHeaders.get(target.origin)?.();
  const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
  for (const [name, value] of Object.entries(trace ?? {})) headers.set(name, value);
  const response = await originalFetch(input, { ...init, headers, redirect: "manual" });
  if (response.status >= 300 && response.status < 400) {
    await response.body?.cancel();
    throw new Error("Offline evaluation refuses redirects");
  }
  return response;
};
export function offlineNetwork() {
  if (active) throw new Error("Offline evaluations must run serially within a process");
  const policy: Policy = { origins: new Set(), denied: [], maximumOrigins: 0, traceHeaders: new Map() };
  active = policy;
  globalThis.fetch = guardedFetch;
  return {
    allow(origin: string) {
      const url = new URL(origin);
      if (url.protocol !== "http:" || url.hostname !== "127.0.0.1" || url.origin !== origin) throw new Error("Only exact owned IPv4 loopback origins are allowed");
      policy.origins.add(origin);
      policy.maximumOrigins = Math.max(policy.maximumOrigins, policy.origins.size);
    },
    traceRequests(origin: string, headers: () => Record<string, string>) {
      if (!policy.origins.has(origin)) throw new Error("Trace metadata requires an owned allowed origin");
      policy.traceHeaders.set(origin, headers);
    },
    forget(origin: string) { policy.origins.delete(origin); policy.traceHeaders.delete(origin); },
    snapshot() { return { denied: [...policy.denied], allowedOriginCount: policy.maximumOrigins, externalRequests: 0 as const }; },
    close() { active = null; globalThis.fetch = originalFetch; },
  };
}
