# Product Requirements Document (PRD)

**Version:** 4.0.0 | **Release:** Hackathon testnet prototype

## 1. Product vision and USP hypothesis
AUREX combines verifiable credit history, canonical cross-chain exposure reservations, and AI-assisted monitoring under deterministic onchain enforcement. This is a hypothesis to validate against prior art, not a claim that the components are individually unprecedented.

The key differentiator to demonstrate: credit eligibility is enforced by contracts; cross-chain capacity is reserved before destination disbursement; AI alerts are traceable but cannot bypass financial rules.

## 2. Users
- Borrower: wants transparent eligibility, borrowing, repayment, and history.
- Lender: wants pool/liquidity/exposure visibility and bounded risk.
- Trader: wants order/perp execution under explicit rules (later modules).
- Treasury/business: wants scheduled capital and settlement (future adapter).
- Risk operator: wants anomaly alerts without handing model control of funds.
- Developer/judge: wants verifiable transactions, interfaces, and tests.

## 3. Release scope
### R0 Foundation — Must
Chain manifest, roles, pause controls, event conventions, shared identifiers, safe token accounting, tests. No cross-chain borrowing enabled yet.

### R1 Lending MVP — Must
LendingPool; CreditHistoryRegistry; deterministic versioned CreditPolicy; loan create/repay/overdue/default; local exposure; UI for eligibility, history, balances, and tx hashes.

### R2 Cross-chain prototype — Target if feasible
Canonical home-chain CreditCoordinator; reservation IDs/lifecycle; message adapter; source/destination verification; replay protection; timeout/expiry; fail-closed behavior. Live provider only after official route/address verification. Global-credit claims only after end-to-end tests pass.

### R3 AI monitoring — Must be specified, shadow mode for prototype
Event pipeline; deterministic rules; offchain model; signed structured report; RiskAttestationRegistry; evidence-linked dashboard; no AI mutation of credit policy or asset movement.

### R4 Other markets — Defined interfaces, phased implementation
OrderBook, PerpEngine, MarketMaker each have separate state/risk checks. Do not imply implementation from interface presence.

## 4. P0 features
Correct-chain UI; onchain credit enforcement; verified repayments; bounded policy; exposure/liquidity accounting; pause that preserves safe repayment; AI report provenance; cross-chain state machine and mock tests; explorer-verifiable events; unit/fuzz/invariant tests.

## 5. P1 features
Second-chain credential verification; live messaging; risk dashboard; model evaluation; read-only UI for future markets.

## 6. Non-goals
AI running inside EVM; AI directly setting credit limits or liquidating; production underwriting; automatic cross-chain atomicity; claiming global limits from two separate deployments; all four production markets in one hackathon release.

## 7. Main user journey
Connect wallet → verify chain → inspect policy/history → preview loan terms → submit borrow → contract validates policy, liquidity, exposure, collateral, and price data if required → loan is disbursed → repay → registry accepts verifiable repayment → policy recomputes eligibility → AI monitor may issue an advisory report.

## 8. Success criteria

| Metric | Prototype target |
|---|---|
| Loan lifecycle | Happy-path integration test passes |
| Over-limit borrow | Rejected in all defined test cases |
| Forged/self-attested repayment | Rejected |
| Duplicate cross-chain message | No duplicate state/capacity |
| Stale required oracle | Risk-increasing call reverts |
| AI authority | No path from model signer to fund transfer/policy mutation |
| Report provenance | Model version, report ID, source block range visible |
| Test quality | Unit/fuzz/invariant suite passes; no unresolved critical finding |
| Scope transparency | UI labels live, simulated, and planned features accurately |

These are targets, not completed test results.

## 9. Market scope
- **Lending:** debt, repayment, credit checks, local exposure.
- **Order book:** deterministic order matching/cancel/settlement; no hidden centralized matcher if described as fully onchain.
- **Perps:** margin, funding, PnL, liquidation; “every-block funding” requires economic/gas/manipulation analysis.
- **Market maker:** quotes/inventory within onchain limits; strategy may be offchain, but enforcement is onchain.

## 10. Decisions to finalize
Chains, messaging provider, tokens/oracles, credit formula, attestation model, AI dataset/target/thresholds, and which non-lending modules are live versus simulated.


---

## V4 scope alignment

This specification serves the organizer's actual challenge: a functional onchain financial mechanism with contract-enforced rules and transparent settlement. AUREX is not a company-launch or broad ecosystem plan. The four market directions are sequential committed milestones: (1) credit-history-aware lending, (2) fully onchain order book, (3) perpetual futures, and (4) onchain market making. Cross-chain coordination and AI monitoring are supporting models, not prerequisites for the first market or authorities over financial state. Copyright recognition, tokenomics, DAO/governance, and unrelated ecosystem features are out of scope.
