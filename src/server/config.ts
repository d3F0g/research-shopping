export type ServerConfig = { apiPort: number; webPort: number };

function port(value: unknown, fallback: number): number {
  if (value === undefined) return fallback;
  if ((typeof value !== "number" && typeof value !== "string") || !/^\d+$/.test(String(value))) throw new Error("Ports must be integers between 1 and 65535");
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > 65535) throw new Error("Ports must be integers between 1 and 65535");
  return parsed;
}

export function resolveServerConfig(input: Partial<ServerConfig> = {}): ServerConfig {
  return { apiPort: port(input.apiPort, 3000), webPort: port(input.webPort, 5173) };
}

export function configFromEnvironment(environment: NodeJS.ProcessEnv): ServerConfig {
  return { apiPort: port(environment.API_PORT ?? environment.PORT, 3000), webPort: port(environment.WEB_PORT, 5173) };
}
