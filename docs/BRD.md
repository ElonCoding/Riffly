# Business Requirements Document (BRD)

**Version:** 4.0.0 | **Status:** Proposed hackathon product

## 1. Summary
AUREX is an onchain capital network starting with credit-history-aware lending and designed to extend to an order book, perpetual futures, and market making. Cross-chain coordination aims to prevent the same credit capacity being used independently on multiple chains. AI monitoring produces evidence-linked alerts but has no financial authority.

## 2. Problem
DeFi credit is often collateral-heavy; onchain history is fragmented; independent deployments can approve debt without shared exposure accounting; monitoring systems may be opaque. AUREX tests whether verifiable repayment history, explicit reservations, and auditable monitoring improve coordination while retaining deterministic limits.

## 3. Objectives
- Demonstrate an end-to-end loan lifecycle on one EVM testnet.
- Record repayment outcomes that borrowers cannot self-attest.
- Enforce hard caps and prevent double allocation.
- Specify a canonical cross-chain reservation model.
- Demonstrate AI monitoring with provenance, signatures, and no privileged financial authority.
- Define scopes/interfaces for all four market directions.
- Produce tests and clear limitations for developer handoff.

## 4. Stakeholders
Borrowers, lenders/liquidity providers, traders, protocol/treasury operators, market makers, risk operators, developers, security reviewers, and hackathon judges.

## 5. Scope
**Product vision:** lending, order book, perps, market making, cross-chain exposure coordination, AI monitoring.

**First implementation:** single-chain lending, repayment registry, bounded credit policy, local exposure ledger, AI shadow mode, cross-chain contracts/interfaces plus mocks. Live second-chain route only after provider/chain verification and integration tests.

**Out of scope:** mainnet real funds, unlimited unsecured lending, AI-driven fund transfers/liquidation, production-grade implementation of all markets at once, or global credit claims without end-to-end coordination.

## 6. Business requirements

| ID | Requirement | Priority | Evidence |
|---|---|---|---|
| BR-01 | Loan lifecycle works on testnet | Must | Integration trace |
| BR-02 | Borrower cannot self-attest repayment | Must | Negative test |
| BR-03 | Credit and pool capacity are bounded | Must | Invariant tests |
| BR-04 | Cross-chain loan requires canonical reservation | Must if cross-chain enabled | Integration tests |
| BR-05 | Replay/delay/spoofed messages fail safely | Must if cross-chain enabled | Adversarial tests |
| BR-06 | AI cannot change policy or transfer funds | Must | Permission audit |
| BR-07 | AI reports include model version and evidence window | Must | Registry/report inspection |
| BR-08 | Market modules retain independent risk checks | Must | Interface/test review |
| BR-09 | Users can inspect rules and transactions | Must | UI walkthrough |
| BR-10 | No unverified addresses or unsupported claims | Must | Manifest review |

## 7. Success criteria
A borrower completes a loan; verified repayment changes eligibility under a documented rule; over-limit borrowing is rejected; duplicate/forged cross-chain messages cannot increase capacity twice in tests; AI produces an explainable alert but cannot act financially; all reports have provenance; live, mocked, and planned features are clearly labelled.

## 8. Risks
Sybil credit farming, defaults, cross-chain message delays, oracle errors, AI false positives/negatives, and over-scoping. History is not a guarantee of repayment. The home-chain coordinator and messaging provider are trust/availability dependencies in the prototype.

## 9. Business decisions required
Credit formula/caps, default loss allocation, supported chains, messaging provider, AI thresholds, attestation authority, and release scope must be approved by the product/risk owner before deployment.


---

## V4 scope alignment

This specification serves the organizer's actual challenge: a functional onchain financial mechanism with contract-enforced rules and transparent settlement. AUREX is not a company-launch or broad ecosystem plan. The four market directions are sequential committed milestones: (1) credit-history-aware lending, (2) fully onchain order book, (3) perpetual futures, and (4) onchain market making. Cross-chain coordination and AI monitoring are supporting models, not prerequisites for the first market or authorities over financial state. Copyright recognition, tokenomics, DAO/governance, and unrelated ecosystem features are out of scope.
