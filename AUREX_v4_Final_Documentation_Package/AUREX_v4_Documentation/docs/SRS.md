# Software Requirements Specification (SRS)

**Version:** 4.0.0

## 1. Functional requirements

### Lending
- **FR-L01:** Reject borrowing if market disabled or borrowing paused.
- **FR-L02:** Enforce per-loan, per-borrower, and pool exposure caps.
- **FR-L03:** Check pool liquidity and collateral/solvency rules.
- **FR-L04:** Create unique loan ID and emit complete `LoanCreated`.
- **FR-L05:** Repayment updates principal/status atomically.
- **FR-L06:** Only authorized source can record verified repayment.
- **FR-L07:** Duplicate repayment records are rejected/idempotent.
- **FR-L08:** Credit eligibility is deterministic, versioned, amount-denominated, hard-capped.
- **FR-L09:** Overdue/default transitions are explicit and testable.
- **FR-L10:** Pause blocks new risk-taking but preserves safe repayment.

### Cross-chain
- **FR-X01:** Every cross-chain-backed loan references a unique canonical reservation.
- **FR-X02:** Destination disbursement requires a confirmed, unconsumed reservation.
- **FR-X03:** Receiver authenticates source chain/contract, destination, message type, and provider-verified sender.
- **FR-X04:** Replay/duplicate messages cannot mutate state twice.
- **FR-X05:** Delayed release keeps capacity encumbered.
- **FR-X06:** Timeout cannot release capacity while destination debt may remain active.
- **FR-X07:** Coordinator/message unavailability blocks new cross-chain borrowing.
- **FR-X08:** UI distinguishes portable history from globally enforced exposure.
- **FR-X09:** Global-credit claim remains disabled until end-to-end multi-chain tests pass.

### AI monitoring
- **FR-A01:** Ingest events/state with source chain and block range.
- **FR-A02:** Report includes model/rule version, timestamp, window, risk level, reason codes, and evidence refs.
- **FR-A03:** AI cannot change policy, transfer funds, or execute liquidation.
- **FR-A04:** Report registration requires authorized signer/quorum.
- **FR-A05:** Duplicate report IDs/nonces are rejected.
- **FR-A06:** UI exposes uncertainty and advisory status.
- **FR-A07:** Metrics use held-out labels when available; synthetic metrics are labelled synthetic.
- **FR-A08:** Inference outage does not alter deterministic contract enforcement.

### Market modules
- **FR-M01:** Each module has independent state/risk checks.
- **FR-M02:** Future modules use shared exposure interfaces and cannot bypass reservations.
- **FR-M03:** Order-book fills follow published onchain matching rules or disclose offchain trust.
- **FR-M04:** Perps define margin, funding, PnL, liquidation before activation.
- **FR-M05:** Market maker respects inventory, price, and capital bounds.

## 2. Non-functional requirements
- Security: access control, safe token handling, replay protection, reentrancy defenses, adversarial tests.
- Determinism: financial decisions reproducible from state/config.
- Auditability: material transitions emit stable IDs.
- Fail-closed cross-chain behavior.
- AI separation: model cannot transfer assets or change policy.
- Privacy: avoid unnecessary sensitive data.
- Availability: AI outage does not disable deterministic lending; cross-chain borrowing stops if coordinator unavailable.
- Maintainability: pinned dependencies, versioned policy, documented ABI.
- Usability: show fees, due dates, caps, chain, status, and receipts.
- Configuration: reject wrong chain IDs/missing addresses.

## 3. Error conditions
Unsupported chain; paused/disabled market; insufficient liquidity; credit cap exceeded; missing/unconfirmed/consumed/expired reservation; wrong source; duplicate nonce/report ID; stale oracle; invalid signature; inactive loan; invalid repayment; unauthorized configuration.

## 4. Acceptance criteria
1. Successful borrow/repay.
2. Over-limit borrow rejected.
3. Forged and duplicate repayment rejected.
4. Fuzzed exposure invariant passes.
5. Cross-chain mocks reject wrong source, replay, duplicate, expiry, delayed release.
6. No disbursement before confirmed reservation.
7. Unauthorized AI report rejected.
8. AI signer cannot call admin/financial functions.
9. AI outage does not change eligibility logic.
10. Each future market stays disabled until its tests pass.


---

## V4 scope alignment

This specification serves the organizer's actual challenge: a functional onchain financial mechanism with contract-enforced rules and transparent settlement. AUREX is not a company-launch or broad ecosystem plan. The four market directions are sequential committed milestones: (1) credit-history-aware lending, (2) fully onchain order book, (3) perpetual futures, and (4) onchain market making. Cross-chain coordination and AI monitoring are supporting models, not prerequisites for the first market or authorities over financial state. Copyright recognition, tokenomics, DAO/governance, and unrelated ecosystem features are out of scope.
