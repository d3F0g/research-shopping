## Overview

The goal is useful shopping advice across product types without a fixed category registry. The checkpoint at `fc06282a9921ab5b8608399a9b225b9c39023b8e` establishes working retrieval, but failed product convergence. Music provides partial specifications, laptops produce no admitted products, and commuting produces no demonstrated hard-constraint fit. These are findings from the [independent QA report](product-checkpoint-independent-qa.md) and [integration report](product-checkpoint-independent-integration.md), not new runtime verification.

The supplied [explorer synthesis](/Users/josiahwong/Documents/research-shopping-exa-primary/.codex/pstack-runs/dynamic-shopping/grounding-input.md) identifies two missing capabilities. Admission must understand request-specific products and evidence. The response must express a justified comparative choice. Replacing category enums alone cannot provide either.

## Key Concepts

Current preferences describe the active shopping intent. Request preferences and completed response preferences are separate historical snapshots. Dynamic intent needs open product descriptions, stable criterion identities, original wording, and explicit hard or flexible status across follow-ups and contextual editing.

Structural validation bounds shapes, identifiers, URLs, references, and quotation containment. Semantic admission determines which exact product or variant a statement describes, its conditions, and whether each requirement is supported, unknown, conflicting, or violated. A valid schema or literal quotation does not prove eligibility. Unknown hard compliance cannot authorize a confident recommendation.

## How It Works

`useConversation` snapshots the request and parses preferences before sending. `research-turns.ts` parses again and chooses conversation, clarification, or paid research. `contracts.ts`, `preferences.ts`, category-indexed controls, and the headphones fallback jointly impose the current product scope.

`exa-research.ts` requests native observations. `page-evidence.ts` independently reparses identity, category, scope, features, battery, and prices through headphone/laptop grammars. The checkpoint loses a qualified price through variant alignment and rejects relevant laptop identities. Some generated snippets also rewrite source text and cannot serve as literal quotations.

`research.ts` and `LiveResearchResults.tsx` carry retained facts, price text, and unresolved notes. `research-turns.ts` generates static count-based answer text. No existing owner produces an evidence-backed comparative judgment. Architecture candidates must give that outcome an explicit bounded representation and coherent owner.

Both SDK search and answer support structured output, cancellation, deadlines, and reported cost. Their response shapes differ. The app has no separate chat LLM. These are available integration seams, not an endpoint decision or proof of shopping quality.

## Where Things Live

- `src/domain/contracts.ts` and `preferences.ts` own current intent and parsing.
- `src/client/useConversation.ts`, `PreferencePanel.tsx`, `PreferenceQuestion.tsx`, `preference-options.ts`, and `App.tsx` own conversation state and contextual controls.
- `src/server/research-turns.ts`, `exa-research.ts`, and `page-evidence.ts` own turn orchestration, retrieval, and admission.
- `src/domain/research.ts` and `src/client/LiveResearchResults.tsx` own the public research contract and presentation.
- PR #41 at `1b79732` adds `src/domain/research-history.ts`, `research-history-unversioned.ts`, and `research-evidence-v2.ts`. Its `workspace.ts` owns stored turn envelopes.

## Gotchas

At `1b79732`, saved requests are `{message, preferences}`. Old preferences contain `hard.{category,budget,region,excludedBrands,requiredFeatures,pendingConstraint}` and `soft.{useCase,priorities,responseLength}`. Saved turns contain `{id,operationId,digest,createdAt,message,request,body}`. Bodies are `pending`, `question` with `question:"budget"` and preferences, `complete` with a response value, or `interrupted` with a reason.

Old complete responses include `message`, `clarification`, `recommendations`, `no-match`, `error`, and `research`. Research is `{kind,answer,preferences,notes,research}`. Its snapshot contains `dataKind,retrievedAt,products,sources,limitations,requestId,reportedCostUsd,grounding`. Unversioned products have `id,name,facts,price,stock,unresolvedConstraints`. Version 2 adds `evidenceVersion:2` and product `identity`, and allows a second price kind. The pinned codec files retain their exact nested bounds and evidence rules.

Non-research responses share `kind,preferences,notes,toolActivity`. Message and no-match add `message`. Clarification adds `message,reason`. Recommendations add `answer,candidates`. Error adds `code,message,retryable` and permits null preferences. Their nested fixture candidate and event schemas remain in pinned `contracts.ts`.

Only research responses have frozen version dispatch. Other responses, request/question preferences, and workspace preferences still use mutable current schemas. A dynamic migration needs independently frozen historical envelopes and explicit active-preference migration. Unknown versions must fail closed. Historical evidence and requests must remain unchanged and inactive.

Retain actual SDK abort, generation checks, session isolation, quota reserve/call/settle order, safe navigation, fixture separation, and unknown merchant availability. Quota allows one pending reservation at $0.05, with 40-attempt/$2 local limits. Unknown cost, errors, or reservation overruns stop work without retries. Diagnostics need endpoint-aware capture while preserving development-only absolute paths, exclusive `0600` writes, 128KiB limits, allowlisting, hashes, truncation, and sink-failure independence. Captures stay outside public history. Existing five settled calls report $0.035. No live allowance is delegated. Auth integration remains separate.
