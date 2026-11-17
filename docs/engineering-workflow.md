# Engineering workflow

The orchestrator owns scope, contracts, GitHub issues, and final verification. An application owner implements in an isolated worktree. QA and security reviewers inspect a named commit independently. A new code change invalidates the affected review verdict until rechecked.

Project custom agents live in `.codex/agents/`. The three TOML definitions select implementation, QA, and security roles. `.codex/config.toml` allows three child threads. The current host can impose a lower limit. Reload the project to discover new roles. Custom agent instructions inherit the parent's permissions and do not create a separate sandbox. See the [official subagent configuration](https://learn.chatgpt.com/docs/agent-configuration/subagents).

The installed pstack role settings in `~/.codex/pstack-models.md` guide this run. Explicit host-supported model choices and bounded briefs are recorded in the run ledger. If a configured model is unavailable, record the fallback before using inheritance. The initial architecture candidates used Astra and Luna. Sol assessed security capabilities. Astra cross-judged the designs. The application owner uses Luna.

## Loop

1. Plan a checkable behavior and name its data shape.
2. Delegate to an owner with exact worktree, branch, paths, and success evidence.
3. Implement the smallest complete behavior and commit verified units.
4. Test core behavior, HTTP boundaries, and actual browser journeys.
5. Independently review the candidate commit.
6. Create issues for reproducible defects and capability gaps.
7. Resolve defects in scope and reverify the changed behavior.
8. Open a tested pull request for human review.

The repository is private. Issues are assigned to its owner because ephemeral Codex workers have no durable GitHub identity. Issue bodies and the run ledger record worker responsibility. No automatic merge or deployment is armed. Credentials stay outside source control.

## Initial tracking

- [Milestone #1](https://github.com/d3F0g/research-shopping/issues/1) covers the functioning vertical slice.
- [Live integration #2](https://github.com/d3F0g/research-shopping/issues/2) covers research and merchant providers.
- [Durable personalization #3](https://github.com/d3F0g/research-shopping/issues/3) covers authentication and PostgreSQL.
- [Coverage #4](https://github.com/d3F0g/research-shopping/issues/4) covers more categories and semantic evaluations.

Git operations in this run use the authenticated GitHub CLI helper per command because the host's default helper could not access the new private repository. No global credential configuration changed.
