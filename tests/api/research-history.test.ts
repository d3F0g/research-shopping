import { describe, expect, it } from "vitest";
import { createApp } from "../../src/server/app";
import { defaultPreferences } from "../../src/domain/contracts";
import type { ApplicationTurnResponse } from "../../src/domain/research";
import capture from "../fixtures/research-history/unversioned-application-response.json";
import { version2Response } from "../fixtures/research-history/records";

describe("fresh research HTTP output", () => {
  it.each([
    { name: "unversioned history", value: capture, status: 500 },
    {
      name: "unknown version",
      value: {
        ...capture,
        research: { ...capture.research, evidenceVersion: 3 },
      },
      status: 500,
    },
    { name: "version 2", value: version2Response, status: 200 },
  ])("accepts only current evidence for $name", async ({ value, status }) => {
    const app = createApp({
      researchTurns: { turn: async () => value as ApplicationTurnResponse },
    });
    const response = await app.request("http://127.0.0.1:3000/api/turn", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        message: "headphones under SGD250",
        preferences: defaultPreferences(),
        operationId: crypto.randomUUID(),
      }),
    });
    expect(response.status).toBe(status);
    const body = await response.json();
    if (status === 200) expect(body).toEqual(version2Response);
    else expect(body).not.toHaveProperty("research");
  });
});
