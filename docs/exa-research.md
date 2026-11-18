# Exa product research

Exa is Fieldnote's normal development discovery and research API. A submitted shopping request can return real product research leads, supporting quotations, safe source links and page-observed price text. These observations are separate from merchant-verified offers. No authorized merchant API is configured. Stock and delivery remain unverified, and Issue #2 stays open for genuine merchant proof.

## Private development setup

Use Node.js 22.12 or newer and npm 11. The API development command reads the repository-root `.env` using Node's environment-file mechanism. Preserve the existing `EXA_API_KEY` there. Never prefix it with `VITE_`, put it in command arguments, copy it into another checkout or add it to GitHub.

Set `EXA_RESEARCH_LEDGER_PATH` to one absolute private file path shared by every development checkout using this key. The existing local setup points to the original checkout's ignored `.local/exa-research-budget.json`. A fresh setup can use `.env.example` as a guide. Do not overwrite an existing environment file.

```sh
npx --yes npm@11.6.2 ci
npm run dev
```

Submit a supported request in chat. Research appears in the assistant response. Open evidence or comparisons for details and use **View source** for the actual cited page. No external page opens automatically. Source links are not purchase or verified-offer links.

Explicit development mode is required for live composition. `EXA_RESEARCH_ENABLED=false`, missing key, missing/invalid ledger configuration, production mode, provider failure, missing evidence or exhausted allowance returns an unavailable state. Normal interactions never fall back to fixture products. Automated tests select their fixture composition explicitly and disable live research even if the developer environment contains a key.

## Search and evidence

The existing official `exa-js` transport is reused. One research operation sends one compact `/search` request on `auto`, five results, highlights, an objective and a small structured-output schema. The five-result cap is a deliberate credit-conservation choice. No automatic retries, Agent/deep chain, extra LLM dependency or per-page summary fan-out is added.

The query expresses the accepted shopping intent. The objective supports useful product comparison. The extraction prompt requires model-specific verbatim evidence, preserves negation and variant/currency context, treats page instructions as untrusted data and leaves missing values unknown. The adapter validates every returned structure and destination. Grounding field names remain opaque provider metadata; confidence is not proof.

A displayed structured fact or price must retain its supporting quotation in a visible bounded excerpt from its validated returned source. Ambiguous model attribution is dropped from structured product observations. Safe sources may still be shown when extraction cannot establish products, with that limitation visible. Sources-only degradation does not establish successful structured discovery.

Page prices are visibly observed and unverified. Retrieval time is not page freshness, an inventory timestamp or a current payable amount. Unknown hard constraints remain unresolved. Retrieval restriction notices cannot relax the shopper's requirements. Never infer stock, shipping, merchant authorization, variant equivalence or budget eligibility from an unrelated page quotation.

## Development usage allowance

The initial local policy permits at most 40 attempted searches, reserves US$0.05 per attempt, limits reserved usage to US$2 and allows one active search. It leaves most of the user's initial US$10 outside this application allowance. These are admission limits, not the current account balance or a guarantee of Exa's billing. Actual reported cost is recorded separately.

The ledger persists before dispatch and survives refresh, reset and server restart. Duplicate operation IDs spend nothing. Locks and pending reservations prevent another process from silently multiplying the allowance. Unknown charges, cancellation, errors or crashes retain their reservation and stop further paid work pending developer inspection. Do not delete the ledger to make a blocked request succeed or automatically replenish it.

Cancellation reaches the SDK request and response-body read. Stopping the browser request does not prove that Exa charged nothing. Presentation changes, ordinary replies, disclosures and comparisons of already held evidence do not make another paid request.

## Follow the canonical Exa skill

For Exa API changes, fetch and read the current skill output before editing call shapes.

```sh
npx skills use "https://github.com/exa-labs/agent-skills" --skill "build-with-exa"
```

Read its complete output. Resolve relative references against the supporting-files directory printed by that run. Use the skill rather than remembered API options. The current feature uses `/search`; no Agent, Monitor, Webset, Answer, or OpenAI-compatible endpoint is needed for this interface.

The app has no separate LLM tool loop. Exa performs the bounded structured extraction. If a future feature gives an LLM web search, prefer the SDK tool helpers and require both `query` and `objective`. Pass the model's objective unchanged. The required objective description is:

> Goal for this search turn; say which documents should rank first, which should be excluded, and what specific facts or figures to pull from them.

Add this exact sentence to the existing model system prompt, replacing `web_search` with the actual tool name:

> Call web_search before answering unless you're certain the answer can't have changed since your training cutoff.

Keep the rest of that system prompt. Do not add an unused prompt or a model dependency to the current deterministic application.

## Verify safely

Automated tests use local SDK substitutes, local HTTP transports and explicit fixture composition. They spend no Exa credits. Cover source/model attribution, missing or malformed data, observed-price labels, notices, quota persistence, duplicate/concurrent requests, stale results and actual upstream cancellation. Inspect desktop/mobile screenshots through the project verification skill.

Live verification is separate. Root's initial proof allowance is at most two bounded calls through the real project runtime. Load the original private environment without copying it. Capture only sanitized request IDs, returned costs, accepted/rejected observation counts, source excerpts and inspected screenshots. Stop on the first unexpected error or charge. A successful search proves that observed research path, not stock, delivery or authorized merchant offers.

Run the existing private leak check after building. It checks reachable Git objects, compressed traces and assets without printing the key.

```sh
node --env-file=.env .codex/pstack-runs/exa-integration/verify-no-secret.mjs
```

## Current dependency advisory

The current full audit reports12 propagated high package findings from one inherited picomatch ReDoS advisory. Base and Exa candidate have the same finding set; no finding originates in exa-js. The primary [GHSA-fc5q-39xc-vjpf advisory](https://github.com/advisories/GHSA-fc5q-39xc-vjpf) currently lists no patched release. [Issue27](https://github.com/d3F0g/research-shopping/issues/27) tracks compatible remediation and actual untrusted-pattern reachability. Do not suppress this audit or represent earlier zero-audit installation records as the current result. The independent security verdict is required before shipping.
