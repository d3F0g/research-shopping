# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: research-shopping.spec.ts >> shows and removes the starter portability priority without changing hard constraints
- Location: tests/e2e/research-shopping.spec.ts:92:1

# Error details

```
Error: expect(locator).toBeChecked() failed

Locator: getByRole('checkbox', { name: 'Portability', exact: true })
Expected: checked
Timeout: 6000ms
Error: element(s) not found

Call log:
  - Expect "toBeChecked" getByRole('checkbox', { name: 'Portability', exact: true }) with timeout 6000ms
  - waiting for getByRole('checkbox', { name: 'Portability', exact: true })

```

```yaml
- banner:
  - link "Fieldnote research home":
    - /url: /
    - text: fieldnote
  - text: FIXTURE MODE
  - button "Reset session"
- main:
  - paragraph: PRODUCT RESEARCH
  - heading "Find what fits." [level=1]
  - paragraph: A considered shortlist, with evidence and tradeoffs. Explore sample headphones and laptops.
  - region "Product research workspace":
    - complementary "Your filters":
      - heading "Your filters" [level=2]
      - group "Hard limits Required":
        - text: Hard limits Required
        - paragraph: Every result must meet these boundaries.
        - group:
          - text: Product type
          - combobox "Product type":
            - option "Choose a category"
            - option "Headphones" [selected]
            - option "Laptops"
        - group:
          - text: Maximum budget
          - combobox "Budget currency":
            - option "SGD" [selected]
            - option "USD"
          - spinbutton "Maximum budget amount": "500"
          - button "Clear budget cap"
        - group:
          - text: Offer region
          - combobox "Offer region":
            - option "Singapore · SGD" [selected]
            - option "United States · USD"
          - paragraph: Sample offers only. Shipping is not checked.
        - group:
          - text: Brands to exclude
          - textbox "Brands to exclude":
            - /placeholder: For example, Bose, Sony
          - paragraph: Separate brands with commas.
        - group "Must have":
          - text: Must have
          - group:
            - checkbox "Active noise cancelling"
            - text: Active noise cancelling
          - group:
            - checkbox "Wireless" [checked]
            - text: Wireless
          - group:
            - checkbox "Connect to two devices"
            - text: Connect to two devices
          - group:
            - checkbox "Long battery life"
            - text: Long battery life
          - group:
            - checkbox "Lightweight"
            - text: Lightweight
      - separator
      - group "Preferences Flexible":
        - text: Preferences Flexible
        - group:
          - text: Use case
          - textbox "Use case":
            - /placeholder: Flights, writing, study…
            - text: long flights
        - group "What matters more?":
          - text: What matters more?
          - group:
            - checkbox "Comfort"
            - text: Comfort
          - group:
            - checkbox "Sound"
            - text: Sound
          - group:
            - checkbox "Noise cancelling"
            - text: Noise cancelling
          - group:
            - checkbox "Battery"
            - text: Battery
          - group:
            - checkbox "Value" [checked]
            - text: Value 2
          - paragraph: The most recently selected priority has the most influence.
        - group:
          - text: Answer length
          - combobox "Answer length":
            - option "Concise" [selected]
            - option "More detail"
      - button "Update comparison"
    - text: Start with the outcome, not a model number.
    - group:
      - textbox "Start with the outcome, not a model number.":
        - /placeholder: For example, headphones for long flights under S$500…
      - group:
        - text: Preferences stay in this tab
        - button "Update shortlist"
    - button "Example requests"
    - region "Current research exchange":
      - log:
        - text: Wireless headphones for long flights, under S$500
        - region "Your shortlist":
          - paragraph: RESEARCH SUMMARY
          - heading "Your shortlist" [level=2]
          - text: Fixture data
          - paragraph: Sony WH-CH720N is the leading sample match. Sample price SGD 149.00 meets your budget. Check the tradeoffs before choosing.
          - list:
            - listitem: Synthetic development samples. Scenario timestamp 15 Jan 2025, not observed prices, stock or specification research.
          - heading "3 options that fit" [level=3]
          - text: Hard limits applied
          - article "Sony WH-CH720N":
            - text: Leading sample match Headphones
            - heading "Sony WH-CH720N" [level=3]
            - button "Preview reference Synthetic fixture reference. Sony model reference": Model reference
            - strong: S$149
            - text: SAMPLE
            - paragraph: Sample price · fixture only
            - paragraph: Sample says in stock
            - paragraph: Fixture snapshot · 15 Jan 2025 · SG
            - list:
              - listitem: Sample price SGD 149.00 meets your budget.
              - listitem: Sample fixture supports wireless.
            - paragraph: Tradeoff Conflicting sample claims are excluded from ranking. Inspect the evidence.
            - button "More fit details"
            - button "Evidence and limits"
            - button "Select this product"
          - article "Sony WH-1000XM5":
            - text: Sample option 2 Headphones
            - heading "Sony WH-1000XM5" [level=3]
            - button "Preview reference Synthetic fixture reference. Sony model reference": Model reference
            - strong: S$399
            - text: SAMPLE
            - paragraph: Sample price · fixture only
            - paragraph: Sample says in stock
            - paragraph: Fixture snapshot · 15 Jan 2025 · SG
            - list:
              - listitem: Sample price SGD 399.00 meets your budget.
              - listitem: Sample fixture supports wireless.
            - paragraph: Tradeoff Sample evidence does not establish real-world quality, current price, or stock.
            - button "More fit details"
            - button "Evidence and limits"
            - button "Select this product"
          - article "Sennheiser MOMENTUM 4 Wireless":
            - text: Sample option 3 Headphones
            - heading "Sennheiser MOMENTUM 4 Wireless" [level=3]
            - button "Preview reference Synthetic fixture reference. Sennheiser model reference": Model reference
            - strong: S$329
            - text: SAMPLE
            - paragraph: Sample price · fixture only
            - paragraph: Sample says in stock
            - paragraph: Fixture snapshot · 15 Jan 2025 · SG
            - list:
              - listitem: Sample price SGD 329.00 meets your budget.
              - listitem: Sample fixture supports wireless.
            - paragraph: Tradeoff Sample evidence does not establish real-world quality, current price or stock.
            - button "Evidence and limits"
            - button "Select this product"
          - button "Compare 3 sample options"
          - button "Recorded activity · 9 outcomes"
  - text: Fieldnote · Research workspace Fixture demo. Prices, claims, and stock are synthetic.
```

# Test source

```ts
  1   | import { mkdir } from "node:fs/promises";
  2   | import { expect, test, type Page, type Route } from "@playwright/test";
  3   | 
  4   | async function researchWithPrompt(page: Page, prompt: string) {
  5   |   await page.goto("/");
  6   |   await page.getByLabel("Start with the outcome, not a model number.").fill(prompt);
  7   |   await page.getByRole("button", { name: "Research options" }).click();
  8   |   await expect(page.getByRole("heading", { name: "Your shortlist" })).toBeVisible();
  9   | }
  10  | 
  11  | async function assertNoHorizontalOverflow(page: Page) {
  12  |   const width = await page.evaluate(() => ({ viewport: window.innerWidth, document: document.documentElement.scrollWidth, body: document.body.scrollWidth }));
  13  |   expect(width.document).toBeLessThanOrEqual(width.viewport);
  14  |   expect(width.body).toBeLessThanOrEqual(width.viewport);
  15  | }
  16  | 
  17  | function deferred() {
  18  |   let resolve!: () => void;
  19  |   const promise = new Promise<void>((done) => { resolve = done; });
  20  |   return { promise, resolve: () => resolve() };
  21  | }
  22  | 
  23  | async function holdResponse(route: Route, started: ReturnType<typeof deferred>, release: ReturnType<typeof deferred>, finished: ReturnType<typeof deferred>) {
  24  |   started.resolve();
  25  |   try {
  26  |     const response = await route.fetch();
  27  |     await release.promise;
  28  |     await route.fulfill({ response }).catch(() => undefined);
  29  |   } catch {
  30  |     await route.abort().catch(() => undefined);
  31  |   } finally {
  32  |     finished.resolve();
  33  |   }
  34  | }
  35  | 
  36  | type HandoffPatch = Partial<{
  37  |   productId: string;
  38  |   productName: string;
  39  |   productUrl: string;
  40  |   offer: Partial<{ productId: string; productUrl: string; merchantHost: string }>;
  41  | }>;
  42  | 
  43  | async function fulfillAlteredSelection(route: Route, patch: HandoffPatch) {
  44  |   const response = await route.fetch();
  45  |   const payload = await response.json() as {
  46  |     productId: string;
  47  |     productName: string;
  48  |     productUrl: string;
  49  |     offer: { productId: string; productUrl: string; merchantHost: string };
  50  |   };
  51  |   const { offer, ...productPatch } = patch;
  52  |   Object.assign(payload, productPatch);
  53  |   if (offer) Object.assign(payload.offer, offer);
  54  |   await route.fulfill({ response, body: JSON.stringify(payload) });
  55  | }
  56  | 
  57  | test("compares fixture headphones, shows evidence and hands off through the selected product ID", async ({ page }) => {
  58  |   await page.setViewportSize({ width: 1440, height: 1000 });
  59  |   await page.goto("/");
  60  |   await page.getByRole("button", { name: /Wireless headphones for long flights/ }).click();
  61  |   await expect(page.getByRole("heading", { name: "Your shortlist" })).toBeVisible();
  62  |   await expect(page.getByText("Sample price · fixture only").first()).toBeVisible();
  63  |   await expect(page.getByText("Synthetic development samples.")).toBeVisible();
  64  |   await expect(page.locator(".product-card")).toHaveCount(3);
  65  |   await expect(page.locator(".product-grid")).not.toContainText("ATH-M50xBT2");
  66  |   await expect(page.getByLabel("Start with the outcome, not a model number.")).toHaveValue("");
  67  | 
  68  |   const sony = page.locator(".product-card").filter({ hasText: "Sony WH-CH720N" });
  69  |   await sony.getByText("Evidence and limits").click();
  70  |   await expect(sony.getByText("CONFLICTING SAMPLE CLAIMS", { exact: true })).toBeVisible();
  71  |   await expect(sony.getByText("Synthetic fixture timestamp · 15 Jan 2025").first()).toBeVisible();
  72  |   const sourceLink = sony.getByRole("link", { name: /Manufacturer reference\/model page/ }).first();
  73  |   await expect(sourceLink).toHaveAttribute("href", "https://www.sony.com.sg/headphones/products/wh-ch720n");
  74  |   await expect(sourceLink).toHaveAttribute("target", "_blank");
  75  |   await expect(sourceLink).toHaveAttribute("rel", /noopener/);
  76  | 
  77  |   await mkdir("artifacts/screenshots", { recursive: true });
  78  |   await page.screenshot({ path: "artifacts/screenshots/shortlist-desktop.png", fullPage: true, animations: "disabled" });
  79  |   await page.setViewportSize({ width: 390, height: 844 });
  80  |   await assertNoHorizontalOverflow(page);
  81  |   await page.screenshot({ path: "artifacts/screenshots/shortlist-mobile.png", fullPage: true, animations: "disabled" });
  82  | 
  83  |   await sony.getByRole("button", { name: "Select this product" }).click();
  84  |   await expect(page.getByRole("heading", { name: "Sony WH-CH720N" })).toBeVisible();
  85  |   const merchantLink = page.getByRole("link", { name: /Open manufacturer product page/ });
  86  |   await expect(merchantLink).toHaveAttribute("href", "https://www.sony.com.sg/headphones/products/wh-ch720n");
  87  |   await expect(merchantLink).toHaveAttribute("rel", /noopener/);
  88  |   await expect(page.getByText("Sample price · fixture only")).toBeVisible();
  89  |   await assertNoHorizontalOverflow(page);
  90  | });
  91  | 
  92  | test("shows and removes the starter portability priority without changing hard constraints", async ({ page }) => {
  93  |   const payloads: { preferences: { hard: { category: string | null; budget: { amount: number; currency: string } | null; region: string; requiredFeatures: string[] }; soft: { priorities: string[] } } }[] = [];
  94  |   page.on("request", (request) => {
  95  |     if (request.url().endsWith("/api/turn") && request.method() === "POST") payloads.push(request.postDataJSON() as typeof payloads[number]);
  96  |   });
  97  | 
  98  |   await page.goto("/");
  99  |   await page.getByRole("button", { name: /Wireless headphones for long flights/ }).click();
  100 |   const portability = page.getByRole("checkbox", { name: "Portability", exact: true });
> 101 |   await expect(portability).toBeChecked();
      |                             ^ Error: expect(locator).toBeChecked() failed
  102 |   await expect(page.getByLabel("Priority 1")).toHaveCount(1);
  103 | 
  104 |   await portability.uncheck();
  105 |   await page.getByRole("button", { name: "Update comparison" }).click();
  106 |   await expect.poll(() => payloads.at(-1)?.preferences.soft.priorities).not.toContain("portability");
  107 |   expect(payloads.at(-1)?.preferences.hard).toMatchObject({
  108 |     category: "headphones",
  109 |     budget: { amount: 500, currency: "SGD" },
  110 |     region: "SG",
  111 |     requiredFeatures: ["wireless"],
  112 |   });
  113 | });
  114 | 
  115 | test("shows a visible focus indicator while tabbing to the request field", async ({ page }) => {
  116 |   await page.goto("/");
  117 |   const request = page.getByLabel("Start with the outcome, not a model number.");
  118 |   let focusedRequest = false;
  119 |   for (let tab = 0; tab < 30 && !focusedRequest; tab += 1) {
  120 |     await page.keyboard.press("Tab");
  121 |     focusedRequest = await request.evaluate((element) => document.activeElement === element);
  122 |   }
  123 |   expect(focusedRequest).toBe(true);
  124 |   await expect(request).toBeFocused();
  125 |   const focusStyle = await request.evaluate((element) => {
  126 |     const style = getComputedStyle(element);
  127 |     return { outlineStyle: style.outlineStyle, outlineWidth: style.outlineWidth };
  128 |   });
  129 |   expect(focusStyle.outlineStyle).toBe("solid");
  130 |   expect(Number.parseFloat(focusStyle.outlineWidth)).toBeGreaterThanOrEqual(3);
  131 | });
  132 | 
  133 | test("keeps the prior budget while an invalid draft is visible and applies a lower cap without replaying the old request", async ({ page }) => {
  134 |   const payloads: { message: string; preferences: { hard: { budget: { amount: number; currency: string } | null } } }[] = [];
  135 |   page.on("request", (request) => {
  136 |     if (request.url().endsWith("/api/turn") && request.method() === "POST") payloads.push(request.postDataJSON() as typeof payloads[number]);
  137 |   });
  138 |   await page.goto("/");
  139 |   await page.getByRole("button", { name: /Wireless headphones for long flights/ }).click();
  140 |   const budget = page.getByLabel("Maximum budget amount");
  141 |   await expect(budget).toHaveValue("500");
  142 | 
  143 |   await budget.fill("0");
  144 |   await expect(page.getByRole("alert").filter({ hasText: "Enter a positive amount" })).toBeVisible();
  145 |   await expect(budget).toHaveValue("0");
  146 |   await expect(page.getByRole("button", { name: "Update shortlist" })).toBeDisabled();
  147 | 
  148 |   await budget.fill("100");
  149 |   await expect(page.getByRole("alert")).toHaveCount(0);
  150 |   await page.getByRole("button", { name: "Update comparison" }).click();
  151 |   await expect(page.getByRole("heading", { name: "No sample option meets these limits" })).toBeVisible();
  152 |   expect(payloads.at(-1)?.message).toBe("Show options");
  153 |   expect(payloads.at(-1)?.preferences.hard.budget).toEqual({ amount: 100, currency: "SGD" });
  154 |   await expect(page.locator(".product-card")).toHaveCount(0);
  155 | });
  156 | 
  157 | test("moves a selected flexible priority ahead of price and changes the leading match", async ({ page }) => {
  158 |   await researchWithPrompt(page, "Headphones under S$400");
  159 |   await expect(page.locator(".product-card").first()).toContainText("Sony WH-CH720N");
  160 |   await page.getByRole("checkbox", { name: "Battery", exact: true }).check();
  161 |   await expect(page.getByText("The most recently selected priority has the most influence.")).toBeVisible();
  162 |   await page.getByRole("button", { name: "Update comparison" }).click();
  163 |   await expect(page.locator(".product-card").first()).toContainText("MOMENTUM 4 Wireless");
  164 | });
  165 | 
  166 | test("does not convert a budget across regions, adapts answer length, and honors no budget limit", async ({ page }) => {
  167 |   await researchWithPrompt(page, "Headphones under S$400");
  168 |   const budget = page.getByLabel("Maximum budget amount");
  169 |   await expect(budget).toHaveValue("400");
  170 |   await page.getByLabel("Offer region").selectOption("US");
  171 |   await page.getByRole("button", { name: "Update comparison" }).click();
  172 |   await expect(page.getByRole("heading", { name: "No sample option meets these limits" })).toBeVisible();
  173 |   await expect(page.getByText(/No regional offer or currency conversion/)).toBeVisible();
  174 | 
  175 |   await page.getByLabel("Offer region").selectOption("SG");
  176 |   await page.getByRole("button", { name: "Update comparison" }).click();
  177 |   await expect(page.getByRole("heading", { name: "Your shortlist" })).toBeVisible();
  178 |   await page.getByLabel("Answer length").selectOption("expanded");
  179 |   await page.getByRole("button", { name: "Update comparison" }).click();
  180 |   await expect(page.getByText(/Ranking follows your supported priorities, then sample price/)).toBeVisible();
  181 | 
  182 |   await page.getByLabel("Start with the outcome, not a model number.").fill("no budget limit");
  183 |   await page.getByRole("button", { name: "Research options" }).click();
  184 |   await expect(page.getByRole("heading", { name: "Your shortlist" })).toBeVisible();
  185 |   await expect(budget).toHaveValue("");
  186 | });
  187 | 
  188 | test("asks for the product category when the request is ambiguous", async ({ page }) => {
  189 |   await page.goto("/");
  190 |   await page.getByLabel("Start with the outcome, not a model number.").fill("Something nice");
  191 |   await page.getByRole("button", { name: "Research options" }).click();
  192 |   await expect(page.getByRole("heading", { name: "One thing to clarify" })).toBeVisible();
  193 |   await expect(page.locator(".clarification-panel")).toContainText("headphones or a laptop");
  194 |   await expect(page.getByText("Unresolved hard requirement")).toHaveCount(0);
  195 |   await expect(page.locator(".product-card")).toHaveCount(0);
  196 | });
  197 | 
  198 | test("clears incompatible preferences on category change and holds unsupported hard requirements until dropped", async ({ page }) => {
  199 |   await page.goto("/");
  200 |   await page.getByLabel("Product type").selectOption("headphones");
  201 |   await expect(page.getByLabel("Product type")).toHaveValue("headphones");
```