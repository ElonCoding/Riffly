# Technical Requirements Document (TRD)

**Version:** 4.0.0

## 1. Recommended stack
Solidity 0.8.x, Foundry, pinned OpenZeppelin; Next.js/TypeScript; ethers.js; direct RPC/log parsing first; Python/FastAPI for AI inference; pandas/Polars for features; scikit-learn baseline and LightGBM/XGBoost only if data supports evaluation; provider-neutral cross-chain adapter; Chainlink/Pyth oracle adapter only if price-dependent lending requires it.

## 2. Architecture
```text
Frontend (untrusted presentation)
  -> LendingPool / OrderBook / PerpEngine / MarketMaker
  -> CreditPolicy + CreditHistoryRegistry
  -> CreditCoordinator + CreditReservation
  -> MessageAdapter + MessageReceiver
  -> RiskAttestationRegistry
  -> optional OracleRouter
Contract events -> indexer/features -> AI inference -> signed RiskReport -> registry/dashboard
```

## 3. Contract responsibilities
- `CreditHistoryRegistry`: authorized repayment/default records.
- `CreditPolicy`: deterministic versioned eligibility; no custody.
- `CreditCoordinator`: canonical global capacity and reservations.
- `CreditReservation`: unique reservation lifecycle.
- `LendingPool`: custody and loan accounting.
- `MessageAdapter/Receiver`: provider-specific send/receive, source authentication, replay checks.
- `RiskAttestationRegistry`: stores/verifies advisory report metadata; no financial authority.
- `OracleRouter`: normalized, freshness-checked prices if needed.
- `AccessManager/PauseController`: roles and emergency pause.
- `OrderBook`, `PerpEngine`, `MarketMaker`: later, independent state and risk.

## 4. Canonical cross-chain model
Use a designated home-chain CreditCoordinator as source of truth. Destination disbursement requires a confirmed unique reservation. Invariant: `global outstanding exposure + active reservations <= global credit capacity`. If coordinator/messaging state is unavailable, new cross-chain borrowing fails closed. Release messages delayed? Capacity remains encumbered. This prototype has a home-chain availability/trust dependency and is not a trustless cross-chain consensus system.

## 5. Message envelope
Protocol version; source/destination chain IDs; source/destination contracts; message type; canonical borrower key; reservation ID; amount/denomination; nonce; expiry; source event reference; payload hash. Validate provider-authenticated metadata, not caller-supplied source claims.

## 6. AI pipeline
Canonical events/state → validate source/block range → versioned features → deterministic rules + model → structured report → authorized signature/quorum → onchain report registry → advisory dashboard. AI does not call financial functions.

## 7. Model recommendation
Rules baseline + anomaly detector in shadow mode. Use supervised LightGBM/XGBoost only with meaningful labeled data and validation. LLM may summarize evidence, never set numeric credit eligibility. Synthetic data does not establish production predictive accuracy.

Candidate features: repayment timing, loan age/amount, outstanding exposure, rapid cycling, failed borrow attempts, utilization spikes, oracle staleness, duplicate/late cross-chain messages, and future perp/MM anomalies.

## 8. Accounting and safety
Use SafeERC20 for approved standard ERC-20s; document decimals and rounding; reject unsupported rebasing/fee-on-transfer tokens unless adapters exist; separate available cash, outstanding principal, collateral, reservations, and encumbered exposure; apply checks-effects-interactions and reentrancy protection where appropriate.

## 9. Observability and deployment
Events for loan lifecycle, policy config, reservations, message processing, report registration, and roles. Deployment manifest records chain ID, verified addresses, compiler/dependencies, commit hash, and tx hashes. Scripts assert chain ID and fail on missing required addresses.

## 10. Release gates
Pinned reproducible build; all P0 tests pass; cross-chain mocks cover replay/wrong source/delay/timeout; AI signer has report-only permissions; deployment addresses verified; no claim of production security.


---

## V4 scope alignment

This specification serves the organizer's actual challenge: a functional onchain financial mechanism with contract-enforced rules and transparent settlement. AUREX is not a company-launch or broad ecosystem plan. The four market directions are sequential committed milestones: (1) credit-history-aware lending, (2) fully onchain order book, (3) perpetual futures, and (4) onchain market making. Cross-chain coordination and AI monitoring are supporting models, not prerequisites for the first market or authorities over financial state. Copyright recognition, tokenomics, DAO/governance, and unrelated ecosystem features are out of scope.
