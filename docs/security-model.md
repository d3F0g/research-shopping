# Local security model

The initial milestone is a loopback-only development application. It is not a publicly deployed multi-user service. Its tools are read-only research, discovery, and merchant-link lookup. There are no payment, order, shell, arbitrary fetch, or redirect endpoints.

## Required boundaries

HTTP requests need schema validation, a body-size limit, a message-length limit, explicit JSON content types, and a deliberate Host and Origin policy. Hono's CSRF middleware alone does not cover JSON requests. Frontend and API bind to `127.0.0.1`.

Research and merchant records are untrusted input at the adapter boundary. Render text as text. Do not run source instructions or accept source-provided tool names. Merchant links resolve from product identity, require HTTPS and approved exact hosts, and reject credentials, unexpected ports, and redirect wrappers.

Budgets include currency and cannot compare across currencies without dated exchange-rate evidence. Hard constraints cannot become ranking preferences. Fixture timestamps stay fixed. Unknown and conflicting claims cannot become recommendation facts.

Sessions require isolation, reset, expiry or bounded storage, and concurrency behavior. Durable shared use requires authentication and ownership checks before exposure beyond loopback.

## Runtime evidence required

- Invalid JSON, media type, oversized body, and invalid budget fail cleanly.
- Foreign Host and Origin mutations fail. Same-origin browser requests pass.
- Browser contexts have independent preferences and reset correctly.
- Script and source-instruction payloads remain inert.
- Unsafe merchant URLs never become clickable handoffs.
- Provider failure cannot fabricate a replacement offer or leave a verified stock label.
- Logs record request IDs and tool outcomes without conversations or credentials.
- Listening sockets bind to loopback.

## Before live page retrieval

No arbitrary page retrieval belongs in the first fixture path. A future fetcher must validate resolved IPv4 and IPv6 addresses, pin connections to validated destinations, revalidate or disable redirects, and enforce deadlines and byte limits. An allowlisted hostname alone does not prevent DNS rebinding.

## Sources

- [Hono body limit](https://hono.dev/docs/middleware/builtin/body-limit)
- [Hono CSRF](https://hono.dev/docs/middleware/builtin/csrf)
- [Node listening hosts](https://nodejs.org/api/net.html#serverlistenport-host-backlog-callback)
- [OWASP session management](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html)
- [OWASP redirect prevention](https://cheatsheetseries.owasp.org/cheatsheets/Unvalidated_Redirects_and_Forwards_Cheat_Sheet.html)
- [OWASP SSRF prevention](https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html)
- [OWASP prompt injection prevention](https://cheatsheetseries.owasp.org/cheatsheets/LLM_Prompt_Injection_Prevention_Cheat_Sheet.html)
- [OWASP logging](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)

This assessment is a design input. A final security review must check the implementation and runtime.
