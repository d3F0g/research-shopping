# Live research capability probe

The orchestrator verified only that `OPENAI_API_KEY` was present. It did not print or change the credential. A Sol subagent made one request to the fixed OpenAI Responses endpoint, with at most 200 output tokens and one web-search tool call. No retry occurred.

The requested model was `gpt-5.4-mini`. The result was HTTP 429, no response ID, zero citations, and a sanitized `provider_error` code. The result does not distinguish a rate limit from a billing or quota limit. It does not establish working live research access.

The current model documentation supports Responses, web search, and structured outputs. Technical support does not establish this credential's usable access. See [model documentation](https://developers.openai.com/api/docs/models/gpt-5.4-mini.md), [structured outputs](https://developers.openai.com/api/docs/guides/structured-outputs), and [web search](https://developers.openai.com/api/docs/guides/tools-web-search).

No full response, headers, credential, or raw provider error was retained in the report. Live research remains an external capability gap. Fixtures cannot be presented as the result of this failed live request.
