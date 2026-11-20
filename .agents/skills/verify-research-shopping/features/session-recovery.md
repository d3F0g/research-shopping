# Sessions and recovery

Guest conversation state lives on the server behind a session cookie. Refresh can retain a guest conversation while the process and session remain alive. That does not prove database durability, cross-device history, or authenticated account isolation.

Build a multi-turn conversation, then use **New chat**. Require empty messages, cleared current preferences and pending question, empty composer, and preserved theme. Use two independent browser contexts. Changes and reset in one must not reveal or alter the other's conversation.

The helper holds a browser `phase: research` request before dispatch, activates **Stop research**, then **New chat**, and releases the held route. Require no new substitute call, no late result, no spinner, and an empty server state. This is a browser stale-response case. It does not prove that cancellation reaches an already active SDK request or response body.

For lifecycle changes, run local-transport API tests for cancellation after dispatch, late completion, duplicate requests, stale prepared identifiers, session reset, and isolation. Inject transport failure and require accepted preferences and the submitted message retained with honest recovery. No automatic retry or fixture fallback is allowed.

Optional authenticated personalization uses separate configuration and storage. Inspect the current account test scripts and use only owned disposable storage explicitly authorized for that run. Do not touch an existing database, migrate it, copy credentials, or infer account acceptance from guest-cookie tests. Record account checks as blocked or untested when dependencies are absent.
