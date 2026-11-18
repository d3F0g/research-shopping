# Approved redesign shipping

The user approved the UI in PR #33 and authorized native auto-merge/merge after CI, independent QA/security and repository policies pass. The approval is recorded at https://github.com/d3F0g/research-shopping/pull/33#issuecomment-6965291720. The approved application head is3d40bcdca9e1201ff0ee9cf456b550677da99195. This final update changes policy/documentation only.

## Shipping checklist

- [ ] Resolve the forge, then verify each PR independently before it lands.
- [ ] Land only the contiguous verified run rooted at the bottom.
- [ ] Re-check that the verdicts still describe the code.
- [ ] Land bottom-up, one PR at a time.
- [ ] Leave the stack alone while it lands.
- [ ] Stop at the ceiling.

The run contains only PR #33, targeting main151fa506f58f4171add9f5efd684da809ee3248f. Native GitHub operations are the forge; Origin is unavailable. Fresh independent QA and security delta reviews must name the new head. Existing runtime evidence is167 unit/API tests,43 browser journeys and actual desktop/mobile checks on identical application source. Fresh automatic CI must pass before enabling native auto-merge because main currently has no enforced branch rules. No policy, access or required-review safeguard will be weakened.

After GitHub confirms merged state, fetch and fast-forward the original local main checkout. Preserve its existing package-lock peer metadata and untracked skill files. Keep the ignored private environment file untouched. Verify final main CI on its actual merge commit. Routine future PRs merge autonomously after all gates; only production deployments, sensitive operations and explicitly designated design-review milestones require approval.
