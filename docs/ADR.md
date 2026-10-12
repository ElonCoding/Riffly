# Architecture Decision Records (ADR)

**Version:** 4.0.0

## ADR-001: Single-chain lending first
**Decision:** First complete market is lending on one EVM testnet.  
**Reason:** Smallest end-to-end financial flow that proves history and policy.  
**Consequence:** Other markets are phased.

## ADR-002: Home-chain coordinator for cross-chain exposure prototype
**Decision:** Canonical CreditCoordinator holds global capacity/reservations.  
**Reason:** Gives one source of truth and testable reserve-before-borrow flow.  
**Tradeoff:** Availability/trust dependency; not trustless global consensus. Fail closed if unavailable.

## ADR-003: Cross-chain is asynchronous
**Decision:** State machine and reservations, not claimed atomicity.  
**Reason:** Independent EVM chains cannot execute one atomic transaction.  
**Consequence:** Delayed messages can lock capacity until reconciliation.

## ADR-004: AI is advisory
**Decision:** Offchain model creates signed reports; no privileged financial role.  
**Reason:** Model outputs can be wrong, unavailable, or manipulated.  
**Consequence:** Model failure cannot disable deterministic lending checks.

## ADR-005: Rules baseline before ML influence
**Decision:** Deterministic alerts plus model in shadow mode.  
**Reason:** Labeled data may be insufficient; synthetic data does not prove real-world accuracy.  
**Consequence:** Model does not change borrowing limits in MVP.

## ADR-006: Provider-neutral messaging/oracle
**Decision:** Interfaces first; provider chosen after exact chain route/feed verification.  
**Reason:** Target networks are not confirmed.  
**Consequence:** No invented addresses or universal-support assumptions.

## ADR-007: Four markets, separate risk engines
**Decision:** Modules share accounting interfaces but retain their own state/risk checks.  
**Reason:** Market risks differ.  
**Consequence:** No shared unrestricted balance.

## ADR-008: No AI-triggered liquidation in MVP
**Decision:** AI alerts prompt review only.  
**Reason:** False positives can cause financial harm.  
**Consequence:** Liquidation remains deterministic and contract-enforced.

## Open ADRs
ADR-009 target/home/destination chains; ADR-010 messaging provider; ADR-011 tokens/oracle; ADR-012 credit formula/loss allocation; ADR-013 borrower key/sybil model; ADR-014 AI data/thresholds/evaluation; ADR-015 next market after lending.


---


## V4 product-scope decision

**Decision:** Implement all four market directions in sequence, with lending first, order book second, perpetuals third, and market making fourth. Shared interfaces are planned up front; each market retains distinct accounting and contract invariants.

**Rationale:** This maps directly to the challenge while controlling integration risk. It avoids either reducing the long-term plan to one market or attempting all markets simultaneously.

**Supporting models:** Cross-chain coordination is mock-first and conditional on verified routes. AI monitoring is advisory; deterministic contract rules remain authoritative. Copyright recognition, tokenomics, governance, and broad ecosystem features are excluded.

**Revisit only if:** the judging rubric or a demonstrated technical blocker materially changes the build priorities. Record any change in a new ADR rather than silently rewriting scope.
