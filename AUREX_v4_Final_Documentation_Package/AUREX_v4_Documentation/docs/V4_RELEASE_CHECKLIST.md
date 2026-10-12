# AUREX V4 Release Checklist

**Release:** V4.0.0 — Final pre-development specification  
**Release intent:** Freeze the product direction and document boundaries before implementation begins. This release is not a software deployment or security audit.

## Product decision
- [x] The actual challenge—not company building—is the central goal.
- [x] Four markets are committed as sequential milestones.
- [x] Shared interfaces are designed for integration, but market accounting remains separate.
- [x] AI monitoring is advisory/supporting, not the product's core financial engine.
- [x] Cross-chain coordination is a supporting extension, mock-first and route-gated.
- [x] Copyright recognition, tokenomics, DAO/governance, and broad ecosystem work are excluded.
- [x] No provider, chain, address, metric, or performance result is invented.

## Before coding starts
- [ ] Confirm the exact EVM testnet and token used for the prototype.
- [ ] Confirm the team member responsible for contracts, frontend, integration/security, and optional monitoring.
- [ ] Freeze the active milestone and agree its exit criteria.
- [ ] Define M1 credit formula, policy version, loan duration/fees, default handling, and history verification.
- [ ] Set up Foundry, formatting/linting, unit tests, fuzz tests, and invariant tests.
- [ ] Decide which RPC/explorer configuration is available; keep secrets out of source control.
- [ ] Make a clean initial commit with this V4 documentation.

## Before each milestone is declared complete
- [ ] Run the relevant tests and preserve actual output.
- [ ] Review all financial invariants and adverse paths.
- [ ] Verify events and read-model/UI reconciliation.
- [ ] Run regression tests for all earlier milestones.
- [ ] Update implemented/mock/planned/blocked status.
- [ ] Record deployment chain and contract addresses only from actual deployments.
- [ ] Update the demo script to show one valid path and one rejected invalid path.

## Conditional work
- [ ] Cross-chain live provider only after exact route and deployment configuration are verified.
- [ ] ML model only after features, dataset provenance, baseline and evaluation are documented.
- [ ] Production deployment, audits, real lending, and real funds are not part of V4.

## Release note
V4 is the final agreed blueprint to begin development. It is intentionally adaptable: if a test, integration, or security review exposes a blocker, pause the affected milestone, document the issue, and adjust the plan without pretending the gate passed.
