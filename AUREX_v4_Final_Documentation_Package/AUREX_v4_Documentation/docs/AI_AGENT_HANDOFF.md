# AUREX V4 — Team and Coding-Agent Handoff

## First read
1. `README.md`
2. `docs/ARCHITECTURE.md`
3. `docs/ROADMAP.md`
4. `docs/SCOPE_AND_ACCEPTANCE_MATRIX.md`
5. The active market's PRD/SRS/contract interface/security docs

## Mission
Build the actual hackathon solution: transparent onchain financial markets whose core financial rules, accounting, and settlement are enforced by smart contracts. Deliver the four markets sequentially: lending, order book, perpetual futures, and market making.

Do not turn this into a company launch, generic DeFi ecosystem, AI-first product, tokenomics exercise, governance system, or copyright-recognition service.

## Mandatory implementation rules
- Work only on the active milestone unless the integration owner approves otherwise.
- Preserve previous milestone behavior and run regression tests.
- Keep each market's state machine and accounting explicit.
- Never trust frontend-calculated eligibility or balances for contract authorization.
- Keep AI advisory; it cannot authorize credit, transfer funds, alter policy, consume/release reservations, or liquidate.
- Treat cross-chain as a supporting extension. A mock adapter must be labelled simulated. Never claim a live route without route-specific integration tests.
- Do not add an oracle dependency to a market that does not need price data.
- Do not claim funding executes automatically every block; document the accumulator and update trigger.
- Do not store unnecessary personal data onchain.
- Never invent chain IDs, addresses, transaction hashes, test outputs, or model metrics.
- Do not deploy to mainnet or use real funds for the hackathon prototype.
- If requirements conflict or a financial formula is underspecified, document the decision and ask the integration owner rather than silently inventing a risky rule.

## Required report after every task
1. Files changed and why.
2. Exact commands/tests run and actual results.
3. Implemented vs simulated vs planned status.
4. Contract addresses and chain IDs only if produced by a real deployment.
5. Security assumptions and known failure cases.
6. Remaining blockers, ordered by severity.
7. Any interface changes affecting other milestones.
8. A brief demo instruction for the delivered work.

## Definition of done
A feature is done only when its acceptance criteria are met, relevant tests have actually run, contract state and UI are reconciled, and its status is reported accurately. A document or interface alone is not a working feature.
