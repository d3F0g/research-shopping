import { afterEach, describe, expect, it, vi } from "vitest";

const local = vi.hoisted(() => vi.fn(() => async () => ({ status: "unavailable" as const })));
vi.mock("../../src/server/ollama-intent", () => ({ createOllamaIntentInterpreter: local }));
vi.mock("@hono/node-server", () => ({ serve: vi.fn() }));

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

describe("optional local intent composition", () => {
  it.each([
    { mode: "development", provider: "ollama", model: "fixture-local:latest", enabled: true },
    { mode: "development", provider: "ollama", model: "  fixture-local:latest  ", enabled: true },
    { mode: "development", provider: "ollama", model: "", enabled: false },
    { mode: "development", provider: "ollama", model: "  ", enabled: false },
    { mode: "development", provider: "", model: "fixture-local:latest", enabled: false },
    { mode: "development", provider: "openai", model: "fixture-local:latest", enabled: false },
    { mode: "test", provider: "ollama", model: "fixture-local:latest", enabled: false },
    { mode: "production", provider: "ollama", model: "fixture-local:latest", enabled: false },
    { mode: "", provider: "ollama", model: "fixture-local:latest", enabled: false },
  ])("requires development, explicit Ollama selection and a model for $mode / $provider / $model", async ({ mode, provider, model, enabled }) => {
    vi.resetModules();
    vi.stubEnv("NODE_ENV", mode);
    vi.stubEnv("FIELDNOTE_TEST_FIXTURES", "false");
    vi.stubEnv("FIELDNOTE_INTENT_PROVIDER", provider);
    vi.stubEnv("OLLAMA_INTENT_MODEL", model);
    vi.stubEnv("OLLAMA_HOST", "https://external.example");
    vi.stubEnv("OPENAI_INTENT_ENABLED", "true");
    vi.stubEnv("OPENAI_API_KEY", "fake-unused-key");
    vi.stubEnv("OPENAI_INTENT_LEDGER_PATH", "/not-used/receipts.json");
    vi.stubEnv("EXA_API_KEY", "");
    vi.stubEnv("EXA_RESEARCH_ENABLED", "false");
    vi.stubEnv("EXA_RESEARCH_LEDGER_PATH", "");
    vi.stubEnv("API_PORT", "3000");
    vi.stubEnv("WEB_PORT", "5173");
    const external = vi.fn(() => { throw new Error("No network during composition"); });
    vi.stubGlobal("fetch", external);
    vi.spyOn(process.stdout, "write").mockReturnValue(true);
    await import("../../src/server/index");
    if (enabled) {
      expect(local).toHaveBeenCalledExactlyOnceWith("fixture-local:latest");
    } else {
      expect(local).not.toHaveBeenCalled();
    }
    expect(external).not.toHaveBeenCalled();
  });
});
