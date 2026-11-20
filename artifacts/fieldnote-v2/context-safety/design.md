# Context meaning fix

The user needs held-evidence questions and product-price selections to stay free while preserving the accepted shopping request and complete buyer restrictions.

The first wrong decisions occur before dispatch. The reducer has no contextual source-question operation, so the source report becomes a new hard criterion. Its monetary parser also receives selection text without knowing whether the amount refers to a product or a budget.

Two designs were compared before implementation.

1. A bounded whole-message operation union identifies source inspection, held selection with buyer qualifications, or a pending unsupported compound. The existing validated money parser and shared reducer remain the only mutation path. This needs no contract or service change.
2. A clause-role syntax tree assigns observations, questions, restrictions, budgets and edits to arbitrary spans, then validates composed operations. This could express more language, but it creates a second general conversational grammar and requires broader ambiguity policy.

The first design was selected. Model the Domain changed the organizing shape from money-presence and fallback requirements to typed contextual operations. Fix Root Causes placed the decision before monetary extraction and preference fallback. Test Behavior, Not Implementation led to Hono request tests using the actual Exa SDK, loopback-only fake-key transport and an in-memory quota. Paired explicit research and budget edits prove those tests can observe dispatch.

Source questions disclose retained AI assessments, complete supporting passages and uncertainty. User reports do not become source proof. Buyer qualifications remain raw hard criteria. Retained observations are reassessed conservatively and never gain membership or subscription eligibility from a newly accepted user fact.

The initial reproduction has four failing assertions and 64 passing tests. Both bugs failed through Hono and the actual SDK. See reproduction.log. The remaining checkpoints are focused regressions, the full source/API suite, typecheck, a clean candidate commit and the unchanged 60-scenario critical gate. Independent browser QA, security and comment review remain owned by the orchestrator.
