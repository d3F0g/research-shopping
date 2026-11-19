import { randomUUID } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import {
  initialConversation,
  type TurnResponse,
} from "../../src/domain/conversation";
import { reduceTurn } from "../../src/domain/turn-reducer";
import { projectExaAnswer } from "../../src/server/exa-research";
import { createApp } from "../../src/server/app";
import { createConversationService } from "../../src/server/conversations";
import { nativeMaterial } from "../helpers/v2-material";

const intent = reduceTurn(initialConversation(), {
  phase: "prepare",
  operationId: randomUUID(),
  message: "a USB-C powerbank between SGD30 and40",
}).state.intent;
const identity =
  "Fixture data: Fixture Powerbank Model A is a USB-C powerbank.";
function materialWith(text: string, current = intent) {
  const material = nativeMaterial(current);
  return JSON.parse(
    JSON.stringify(material).replaceAll(
      JSON.stringify(material.citations[0]!.text).slice(1, -1),
      JSON.stringify(text).slice(1, -1),
    ),
  ) as ReturnType<typeof nativeMaterial>;
}
function project(material: ReturnType<typeof nativeMaterial>) {
  const result = projectExaAnswer(material, intent);
  if (result.status !== "ready")
    throw new Error("Expected an honest comparison");
  return result.research;
}
const negatives = [
  "Model A costs SGD 35, not tax included.",
  "Model A costs SGD 35 without tax included.",
  "Model A costs SGD 35, tax included.\n\nFixture data: technical details follow.\n\nModel A requires SGD 15 shipping in addition to the displayed price.",
  "Model A costs SGD 65 while Model B costs SGD 35, tax included.",
  "Model A costs SGD 35 to SGD 65 depending on configuration, tax included.",
  "Model A costs SGD 35 for one unit, tax included.\n\nFixture data: ordinary packaging.\n\nThe displayed price applies only to members.",
  "Model A costs SGD 35 for one unit, tax included.\n\nFixture data: ordinary packaging.\n\nShipping costs SGD 15.",
  "Model A costs SGD 35 for one unit, tax included.\n\nTax is excluded from the displayed amount.",
  "Model A costs SGD 35 for one unit, tax included, unless the buyer lives overseas.",
  "Model A costs SGD 35 for one unit, tax included.\n\nModel A costs SGD 65 for one unit, tax included.",
];
describe("complete atomic price evidence", () => {
  it.each(negatives)(
    "does not recommend the misleading observation %s",
    (text) => {
      const research = project(materialWith(`${identity} ${text}`));
      expect(research.choice).toBeNull();
      const product = research.products[0]!;
      expect(product.eligible).toBe(false);
      expect(product.price?.conditionsResolved ?? false).toBe(false);
      expect(product.price?.conditions ?? []).not.toContain("tax included");
      if (product.price) {
        expect(
          product.price.assessment.support.some((span) =>
            span.quote.includes(text),
          ),
        ).toBe(true);
      }
      expect(research.intent.budget).toEqual({
        minimum: 30,
        maximum: 40,
        currency: "SGD",
      });
    },
  );
  it.each(["Model A", "Lumen 7.2 (warm)", "Rook [wide] + amber"])(
    "retains an ordinary exact price for arbitrary variant %s",
    (variant) => {
      const material = JSON.parse(
        JSON.stringify(nativeMaterial(intent)).replaceAll("Model A", variant),
      );
      const research = project(material);
      expect(research.choice?.productId).toBe("model-a");
      expect(research.products[0]!.price).toMatchObject({
        amount: 35,
        currency: "SGD",
        variant,
        conditionsResolved: true,
        conditions: ["tax included"],
      });
      const support = research.products[0]!.price!.assessment.support[0]!;
      const source = research.sources.find(
        (source) => source.id === support.sourceId,
      )!;
      expect(
        source.text.slice(support.originalStart, support.originalEnd),
      ).toBe(support.originalQuote);
      expect(source.text.slice(support.start, support.end)).toBe(support.quote);
    },
  );
  it.each([29, 41])(
    "preserves both numeric bounds for observed price %s",
    (amount) => {
      const material = materialWith(
        `${identity} Model A costs SGD ${amount} for one unit, tax included.`,
      );
      material.answer.products[0]!.price.amount = amount;
      const research = project(material);
      expect(research.products[0]!.price?.conditionsResolved).toBe(true);
      expect(research.choice).toBeNull();
    },
  );
  it("does not infer explicit currency from a bare dollar or accept a different currency", () => {
    expect(
      project(
        materialWith(
          `${identity} Model A costs $35 for one unit, tax included.`,
        ),
      ).choice,
    ).toBeNull();
    const material = materialWith(
      `${identity} Model A costs USD 35 for one unit, tax included.`,
    );
    material.answer.products[0]!.price.currency = "USD";
    expect(project(material).choice).toBeNull();
  });
  it.each(["source-limit", "duplicate-url"])(
    "does not lose adverse context while packing %s",
    (mode) => {
      const material = nativeMaterial(intent);
      const adverse = {
        ...material.citations[0]!,
        text: `${identity} Model A costs SGD 65.`,
        url:
          mode === "duplicate-url"
            ? material.citations[0]!.url
            : "https://manufacturer.com/terms",
      };
      if (mode === "source-limit") {
        for (let i = 0; i < 9; i++)
          material.citations.push({
            ...material.citations[0]!,
            url: `https://manufacturer.com/other-${i}`,
            text: "Fixture data: unrelated technical specifications.",
          });
      } else {
        material.citations.push({
          ...material.citations[0]!,
          url: "https://manufacturer.com/other",
        });
        material.answer.products[0]!.price.assessment.support[0]!.url =
          "https://manufacturer.com/other";
      }
      material.citations.push(adverse);
      expect(project(material).choice).toBeNull();
    },
  );
  it("retains an adverse fourth source without inventing a native excerpt", () => {
    const material = nativeMaterial(intent);
    for (let i = 0; i < 3; i++)
      material.citations.push({
        ...material.citations[0]!,
        url: `https://manufacturer.com/other-${i}`,
        ...(i === 2
          ? {
              text: "Fixture data: Shipping costs SGD 15 in addition to the displayed price.",
            }
          : {}),
      });
    const research = project(material);
    expect(research.choice).toBeNull();
    expect(
      research.sources.some((source) =>
        source.text.includes("Shipping costs SGD 15"),
      ),
    ).toBe(true);
    const actualNativeQuotes =
      material.answer.products[0]!.price.assessment.support.map(
        (span) => span.quote,
      );
    for (const span of research.products[0]!.price!.assessment.support)
      expect(actualNativeQuotes).toContain(span.originalQuote);
  });
  it("preserves native adverse status and complete quotes", () => {
    const material = materialWith(
      `${identity} Model A costs SGD 35 without tax included.`,
    );
    material.answer.products[0]!.price.assessment.status = "contradicted";
    const research = project(material);
    expect(research.products[0]!.price?.assessment.status).toBe("contradicted");
    expect(research.products[0]!.price?.assessment.support[0]!.quote).toContain(
      "without tax included",
    );
    expect(research.choice).toBeNull();
  });
  it("exposes the guarded choice and honest price labels through the actual research route", async () => {
    const app = createApp({
      conversations: createConversationService({
        research: async ({ intent }) =>
          projectExaAnswer(
            materialWith(`${identity} ${negatives[0]}`, intent),
            intent,
          ),
        quota: {
          reserve: vi.fn(async () => "admitted" as const),
          settle: vi.fn(async () => {}),
        },
      }),
    });
    const session = await app.request("http://localhost:3000/api/session");
    const cookie = session.headers.get("set-cookie")!.split(";")[0]!;
    async function post(body: unknown) {
      const response = await app.request("http://localhost:3000/api/turn", {
        method: "POST",
        headers: { cookie, "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      expect(response.status).toBe(200);
      return (await response.json()) as TurnResponse;
    }
    const prepared = await post({
      phase: "prepare",
      operationId: randomUUID(),
      message: "a USB-C powerbank between SGD30 and40",
    });
    if (prepared.kind !== "prepared")
      throw new Error("Expected prepared research");
    const result = await post({
      phase: "research",
      preparedId: prepared.preparedId,
    });
    if (result.kind !== "research")
      throw new Error("Expected research response");
    expect(result.research.choice).toBeNull();
    expect(result.research.products[0]!.price?.conditions).not.toContain(
      "tax included",
    );
    expect(result.state.intent.budget).toEqual({
      minimum: 30,
      maximum: 40,
      currency: "SGD",
    });
  });
});
