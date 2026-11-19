# Contextual shopping intent

Fieldnote retains accepted preferences, a typed pending question and genuine message history separately. The question records its identity, original request, missing field and unresolved money draft. For the powerbank request `$30-40`, answering `SGD`, `S$` or `SGD$30` resolves currency only and preserves SGD30–40. It does not replace the range with SGD30. A bare currency without that pending draft cannot convert an unrelated accepted budget.

The server's reducer applies named operations rather than accepting a replacement intent. General language uses structured OpenAI extraction; typed edits, known local controls and pending currency answers resolve locally. Unmentioned hard constraints survive new objectives. Cheaper/lighter preferences do not invent numeric limits. Explicit maximum changes preserve the minimum. Material ambiguity remains a targeted question, while useful no-budget requests can research immediately.

## Provider and safety boundary

The user authorized the configured OpenAI account on 19 November 2026. Initial live verification is limited to two calls and US$0.10 reserved. The adapter uses the [Responses API](https://developers.openai.com/api/docs/quickstart.md) with [strict structured output](https://developers.openai.com/api/docs/guides/structured-outputs.md), model [gpt-6.2-sol](https://developers.openai.com/api/docs/models/gpt-6.2-sol.md), store false and no tools or reasoning output contract. It never supplies product facts or replaces Exa research. No search-tool prompt is needed because this model has no search tool.

Exact source spans establish provenance, not semantic truth. Validate action targets, monetary proposals, negation and existing hard constraints before applying them. A failed or malformed interpretation retains accepted state and any pending draft, returns honest interpretation unavailability and starts no Exa call. The model cannot authorize a purchase, invent a price or silently remove a hard requirement.

Bound serialized request input to 12,000 UTF-8 bytes and requested output to 2,048 tokens. Persistent private receipts reserve US$0.05 before each attempt, cap the initial program at two attempts and retain uncertainty. Completed preparation can be reused only with its stable operation identity and exact input hash. Cancellation reaches request and body consumption; stale work cannot dispatch Exa. Token-based cost calculations use documented rates conservatively and are estimates, not provider-reported bills or account balance.

## Development configuration

The key stays in the existing ignored development environment. Add only the nonsecret controls when the reviewed implementation is ready:

```dotenv
OPENAI_INTENT_ENABLED=true
OPENAI_INTENT_LEDGER_PATH=/absolute/path/to/private-intent-receipts.json
```

The existing OPENAI_API_KEY is server-only. Both live providers are disabled outside development composition. Tests inject recorded/local responses or fake-key transports; they must not load a real environment file or consume either paid allowance. Never reset or replace the receipt ledger to retry an uncertain charge or replenish the initial program.

## Conversation and evidence

The existing prepare/research transport remains. Accepted intent is committed before paid research, so Stop and retry preserve it. Stable preparation identity prevents paying to reinterpret cached preparation; an explicit research retry remains a separate action. Quick answers bind to the active question, and generation checks reject late results. Current v5 is separate from frozen v4/v3 historical codecs. Active migration may recover a draft only from a genuine retained original request; historical messages and snapshots remain unchanged and read-only.

The UI uses official shadcn/ui and AI Elements. It displays understanding during preparation and a compact search status after authoritative preparation. It does not expose private reasoning, fake intermediate stages or simulated token streaming. Source-backed product cards retain observed/unverified prices and unknown stock. Images come only from actual safe Exa citation metadata tied to an identity source; label them as representative source illustrations with visible attribution and neutral missing/load-error fallbacks.

## Acceptance

Issue #44 and PR #38 retain the exact failed reproduction and the fixing evidence. Automated browser acceptance covers the two-turn range/currency flow, contextual corrections, hard constraints, cancellation/retry/isolation, provider failure, image attribution and responsive themes/composer. Root's initial real application proof is separately limited to one Exa call and at most two OpenAI calls. A real provider failure after correct resolution verifies the no-loop failure path; it does not establish useful live recommendations. Do not claim product acceptance from local substitutes or passing tests alone.
