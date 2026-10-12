# Security Threat Model and Invariants

**Version:** 4.0.0

## 1. Assets
Pool tokens, collateral, credit capacity, reservations, loan/history state, oracle-dependent valuations, AI report integrity/signing keys, admin roles, and future order-book/perp/MM balances.

## 2. Trust boundaries
Contracts enforce deterministic local rules. Home coordinator is canonical for cross-chain reservations. Messaging provider authenticates messages under its own security model. Oracle is external. AI monitor is advisory only. Indexer/RPC is not authority. Admin config is privileged. Frontend is untrusted.

## 3. Threats and controls
- **Forged repayment:** authorized source only; unique loan/event IDs; duplicate rejection.
- **Sybil history:** wallets are not unique humans; conservative bootstrap caps; disclose identity assumptions.
- **Double borrow across chains:** canonical reservation before destination disbursement; fail closed; concurrency tests.
- **Replay/spoof:** verify provider-authenticated source, domain-separate, nonce/message ID, idempotent receiver.
- **Delayed/reordered messages:** state machine; no release on timeout if debt may remain active.
- **AI compromise/hallucination:** report-only key, signatures, version/evidence; no financial role.
- **Oracle failure:** per-chain verified feed; positive/freshness checks; sequencer checks where applicable; no silent fallback.
- **Reentrancy/nonstandard token:** SafeERC20, allowlist, checks-effects-interactions, guard where needed, adversarial tests.
- **Admin compromise:** role separation, parameter bounds, timelock/multisig in later phase, pause and event audit.
- **Market-module bypass:** separate state machines; shared ledger only through explicit interfaces.

## 4. Required invariants
1. Lending outflow <= available lending cash.
2. Borrower cannot exceed local eligible credit after outstanding exposure.
3. Global outstanding exposure + active reservations <= global credit capacity.
4. Reservation consumed at most once.
5. Consumed reservation not released before authenticated closure.
6. Duplicate message cannot mutate state twice.
7. Borrower cannot self-attest repayment.
8. Repayment record cannot be counted twice.
9. AI report cannot transfer assets or change credit policy.
10. Unauthorized account cannot change roles/config/reservations.
11. Pause blocks new borrowing but allows safe repayment.
12. Invalid required oracle data blocks risk-increasing actions.
13. Market modules cannot bypass shared exposure accounting.
14. AI outage does not change contract enforcement.

## 5. Release gates
No live cross-chain credit until tests pass. No AI-influenced lending until separately approved and validated. No mainnet use without independent audit and economic-risk review.


---
