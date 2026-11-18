# Exa product research

Fieldnote's normal development backend discovers products through Exa. It does not filter a fixed catalog or require a separate context-search button. A shopping submission updates preferences, asks for material missing information, then researches and returns structured comparisons inside the assistant message. Product descriptions and criteria are open-ended.

## Run the intended application version

Use Node.js 22.12 or newer and npm 11. Run from the verified feature or local preview checkout. A listening localhost port does not identify the served commit. The original main checkout can still contain the old fixture implementation while its replacement remains unmerged.

```sh
npx --yes npm@11.6.2 ci
npm run dev
```

The development API reads the repository-root `.env` through Node's environment-file mechanism. Preserve the existing `EXA_API_KEY`. Keep it server-only, outside Git, browser code, public responses, logs and screenshots. Never use a `VITE_` prefix, put a secret value in command arguments or copy the private environment into another worktree.

Set `EXA_RESEARCH_LEDGER_PATH` to the one absolute private ledger shared by every development checkout using the key. The existing setup uses the original checkout's ignored `.local/exa-research-budget.json`. Separate proof checkouts load the original environment through Node's `--env-file` and keep this same ledger. A different checkout is not a fresh allowance.

Normal live composition requires development mode, an enabled integration, a nonempty server key and a valid absolute ledger path. Production remains disabled. Missing configuration, explicit disablement, failed research, invalid evidence or blocked usage returns an honest unavailable or insufficient-evidence response. It never selects fixture products. Explicit automated test composition is separate and visibly labels synthetic data.

## Understand the request flow

The server owns intent interpretation. Current intent, response and evidence contracts use version 4. Budget `amount` is the maximum; optional `minimum` is the hard floor. Both are validated and enforced in the same currency. A complete range such as `Necklaces between 1k to 2k` preserves its description and bounds without a category lookup. The app discloses an assumed request currency. Source currency still needs explicit source evidence.

Preparation updates preferences without a provider call. The client acknowledges that intent before research starts, so Stop preserves accepted exclusions and price bounds. Invalid hard changes remain pending until correction or explicit discard. Completed historical data is separate from prepared transport state. Frozen version 3 and earlier snapshots do not acquire new range semantics. Only active intent is migrated explicitly.

Local greetings, acknowledgments, app-help replies, detail changes and existing evidence disclosures do not start research. Shopping submissions can trigger one paid Exa operation after necessary preferences are resolved. The composer discloses that possibility before submission. No redundant confirmation or context button is required. HTTP preparation and research are two local phases, not two provider calls or simulated token streaming.

## Use Exa without another model provider

Fieldnote has no separate chat LLM. The backend uses the existing official `exa-js` SDK and one native `/answer` request. The canonical Answer reference supports this combination of retrieval, generation, citations and structured output. Exa performs the search and synthesis; the backend binds and evaluates returned product assessments rather than trusting the proposed order or final prose.

The request's documented options have explicit jobs. `text: true` supplies source context for literal evidence and price qualifiers. `outputSchema` defines product assessments. `systemPrompt` contains behavior, attribution and uncertainty rules plus authoritative intent. `userLocation` localizes discovery to the selected market. Location does not prove manufacturer, currency, stock or delivery. There is no Agent/deep chain, per-page summary fan-out, other paid provider or additional model credential.

A future app-owned LLM would change this choice. The canonical skill recommends giving that LLM `/search` as a tool, including a required query and objective and its exact system-prompt search guidance. Inspect available configuration and explain the dependency before adding it. Do not add an unused tool prompt to this application.

## Evaluate and explain candidates on the backend

Candidates come from Exa's returned product output and citations, not a local catalog. Bind support only to the explicit matching returned URL and literal retained text. Do not map numeric citation markers to guessed array positions, rewrite quotations, repair ellipses or use a discarded source qualifier as positive evidence.

Separate identity, relevance, hard criteria, flexible preferences, attributes, observed price and budget assessment. Unknown and conflicting facts remain explicit. Positive recommendation reasons need source-supported exact-variant assessments. A budgeted choice also needs an applicable amount in the requested currency, with both bounds, variant and conditions satisfied. Bare dollar signs, seller domains and unrelated SKU prices cannot establish those facts.

The server orders candidates by hard eligibility and exact request relevance, then supported flexible-preference coverage. Equal or incomparable coverage remains a tie; it is not a performance score. Extra facts, source counts and unknown values do not earn preference credit. Conditional choice and summary follow this evaluation. Valid native preference can break a strongest-tier tie but cannot bypass stronger applicable evidence or a failed hard gate. Invalid typed references remain rejected.

The response contains ordered products, source-bound assessments, conditional choice/reason references and per-product explanation references. `explanation.reasons` identifies supported assessments; `explanation.tradeoffs` identifies actual unresolved or adverse assessments. The UI renders compact comparisons and disclosures from those references. Quotations establish provenance, not semantic entailment. Rationales remain source-based AI interpretations and need independent product verification.

Page prices are observed and unverified with the merchant. Retrieval time is not source freshness or a current payable amount. Search results do not verify inventory. Stock, delivery and authorized merchant offers remain unverified. Product links are validated source destinations and open only on user action. Payments and order placement are out of scope. Issue #36 records unavailable merchant access; do not repeatedly ask for it or close #2 without genuine proof.

## Preserve the shared usage allowance

The local admission policy permits at most 40 attempts, reserves US$0.05 for each, caps reserved exposure at US$2 and allows one active operation. These limits are not the Exa account balance or a provider-enforced spending cap. Record provider-reported costs separately.

Persist admission before dispatch. Duplicate operation IDs, ordinary replies and held-evidence controls add no provider operation. Cancellation reaches the actual SDK request and response body. An abort does not establish zero cost. Unknown charges, interrupted requests and crashes retain their reservation and stop further paid work. Do not delete or reset a ledger, clear its stopped flag, substitute a new key or fabricate a zero-cost completion to continue.

Issue #42 tracks a 30-second timeout without a reported cost. Seven settled records report US$0.045; the eighth is uncertain with US$0.05 reserved. The provider balance remains unverified. Trustworthy reconciliation remains necessary to resolve that unknown charge. Existing historical proof allowances do not replenish themselves.

On 19 November 2026, the user explicitly authorized up to US$0.50 of additional reserved usage for manual testing while preserving the uncertain charge and existing records. The private grant acknowledges only the exact existing baseline. It allows at most ten additional requests, still subject to the global attempt/exposure limits and one active operation. Usage is derived from appended ledger records, so restarts and low reported costs do not replenish it. A new uncertain or excessive-cost settlement stops further admission.

The grant is an explicit development-server configuration, not a browser permission or a provider-enforced spending cap. Activation preserves the original stopped flag and all existing records. Its operator procedure and read-only inspection must never reserve a synthetic attempt or call Exa. Keep the grant outside Git with private permissions. Do not renew or replace it without another explicit authorization. Automated tests and engineering scripts must not consume this manual allowance. Issue #42 and genuine product acceptance remain open.

### Operate the approved manual grant

The private operator CLI imports quota accounting only. It does not load the key, start the application or construct an Exa client. Creation requires development mode, an existing stopped ledger with a null-cost uncertain baseline, an expected current ledger hash, and recorded approval provenance. Stop the owned server before initial activation so the snapshot is stable.

```sh
NODE_ENV=development node --import tsx scripts/manual-research-allowance.ts create \
  --ledger /absolute/path/to/exa-research-budget.json \
  --grant /absolute/path/to/private-manual-grant.json \
  --grant-id APPROVED_GRANT_UUID \
  --approval-reference 'Explicit user approval for US$0.50 additional reserved manual testing' \
  --reviewed-commit REVIEWED_40_CHARACTER_COMMIT \
  --approved-at APPROVAL_RFC3339_TIME \
  --expected-ledger-sha256 EXPECTED_64_CHARACTER_LEDGER_HASH
```

The placeholders must be supplied from the actual authorization and reviewed candidate. This command cannot overwrite an existing grant. Repeating the identical creation does not reset consumption. Conflicting creation fails. No grant is needed or permitted for automated paid tests.

Add only the nonsecret absolute grant path to the ignored development environment as `EXA_MANUAL_RESEARCH_GRANT_PATH`. The existing development-only server composition passes it to quota. Without that setting, the original stopped behavior remains. Production composition stays disabled even if the path is set.

```sh
node --import tsx scripts/manual-research-allowance.ts inspect \
  --ledger /absolute/path/to/exa-research-budget.json \
  --grant /absolute/path/to/private-manual-grant.json
```

Inspection acquires the normal accounting lock, reads current state and reports eligibility and remaining capacity. It does not rewrite the ledger, change its modification time, reserve an attempt or call a provider. Require byte equality before/after activation and inspection. Then restart the exact reviewed development app. Do not submit a paid activation test; leave the allowance for the user.

Every reservation rereads the grant. A missing, corrupt or mismatched grant denies admission. To revoke without deleting evidence, stop using the grant path and restart the development server, or move the private grant aside so the next reservation fails closed. Settlement of an already admitted request still records its result. Restoring both the ledger and grant from old snapshots is outside this local mechanism's rollback protection and must never be used to replenish usage.

## Read the canonical skill before API changes

Run the documented setup command and read its complete output before choosing or changing API shapes.

```sh
npx skills use "https://github.com/exa-labs/agent-skills" --skill "build-with-exa"
```

Resolve relative references from the supporting-files directory printed by that run. Consult its Answer, Search, SDK and prompting references as appropriate. The latest setup output was read completely for this work. The installed exa-js 2.28 matched the npm release checked on 18 November 2026. Recheck rather than assuming that remains current.

## Verify without spending credits

CI and automated checks use explicit fixtures, injected responses or fake-key loopback SDK/Hono transport. Live Exa composition is disabled. Test actual upstream cancellation before headers and during body reads, quota persistence, concurrent/duplicate attempts, stale responses, interval boundaries, evidence/URL validation, ranking ties, ordinary help and no-fallback failures.

Use Playwright for actual chat submission, source-backed simulated comparisons, historical turns, preference changes, isolation, reset, theme and desktop/mobile disclosures. Inspect screenshots, including the short mobile composer and editor. Clearly label provider substitutes. A passing simulated journey is not a successful real Exa recommendation.

Genuine project verification is separate. Pin the candidate, original shared ledger, permitted calls and conservative reservation before dispatch. Use fresh conversations and preserve failures. A proof-only private diagnostic sink can retain bounded native/source information with truncation hashes; it is absent by default and excluded from public responses, history and routine logs. Never retain headers, keys, cookies or environment values. Sink failure cannot retry a request or change settlement.

Assess relevant distinct products, useful qualified comparisons, observed prices, hard fit, justified choice and source-link behavior independently. Neither source counts nor green CI can waive failed product acceptance. Keep merging blocked while the real research journey is unproven.

After building, run the existing private leak verifier. It inspects reachable Git objects, compressed traces and build assets without printing the key.

```sh
node --env-file=.env .codex/pstack-runs/exa-integration/verify-no-secret.mjs
```

Inherited dependency findings remain tracked in Issue #27. Its earlier audit reported 12 propagated high tooling findings. Verify the current state during security review; do not present historical zero-audit records as current approval.
