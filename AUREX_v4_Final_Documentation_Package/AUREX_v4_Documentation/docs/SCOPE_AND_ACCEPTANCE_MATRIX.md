# AUREX V4 — Scope and Acceptance Matrix

## Scope rule

The exact challenge is a functional onchain financial prototype. The four directions are committed as four sequential milestones. AI monitoring and cross-chain coordination are supporting models, not the central product and not blockers to proving a single-chain market. Company-building, tokenomics, governance, copyright recognition, and broad ecosystem features are excluded.

| Capability | M1: Lending | M2: Order book | M3: Perpetuals | M4: Market making |
|---|---|---|---|---|
| Core financial contracts | Required | Extend product with separate module | Separate engine | Vault/quote controls |
| Onchain financial state | Loan/debt/history | Orders/fills/escrow | Positions/margin/funding | Inventory/capital/quotes |
| Deterministic contract enforcement | Credit limits and accounting | Price-time match and atomic settlement | Margin, funding, liquidation | Quote and inventory bounds |
| Wallet UI and transaction trace | Required | Add order/trade UI | Add position/funding UI | Add liquidity/quote UI |
| Unit and adversarial tests | Required | Required | Required | Required |
| Read-only indexer/dashboard | Basic | Extend | Extend | Extend |
| AI monitoring | Rules baseline, advisory | Add order anomaly signals if time | Add margin/funding signals if time | Add quote/inventory signals if time |
| ML anomaly model | Optional; only after dataset/evaluation | Optional | Optional | Optional |
| Cross-chain | Interfaces/mock only unless proven non-blocking | Optional | Optional | Optional |
| Live cross-chain route | Not required | Not required | Not required | Only if justified and fully verified |
| Production/mainnet | Out of scope | Out of scope | Out of scope | Out of scope |

## Completion labels

- **Implemented:** deployed or locally executable code exists, relevant tests were run, and results are reported.
- **Simulated/mock:** behavior is represented by a mock adapter, fixture, stub, or scripted flow; the UI and demo must say so.
- **Planned:** documentation or interfaces exist but no working implementation is evidenced.
- **Blocked:** implementation is incomplete or an acceptance gate failed.

Documentation alone never qualifies a feature as implemented.

## Milestone exit criteria

### M1 — Lending
- [ ] Borrow and repayment transaction paths work on the chosen test environment.
- [ ] Credit formula and policy version are explicit and deterministic.
- [ ] Borrow caps, liquidity, and exposure are enforced by contracts.
- [ ] History cannot be self-attested by the borrower.
- [ ] Partial/full repayment accounting is tested.
- [ ] Revert paths leave no unintended state.
- [ ] UI values reconcile to contract state.

### M2 — Order book
- [ ] Funded order placement and cancellation work.
- [ ] Matching priority is deterministic.
- [ ] Partial fills and remaining quantity are correct.
- [ ] Settlement is atomic.
- [ ] Escrow and user balances reconcile.
- [ ] Duplicate-fill and unauthorized-cancel paths fail.

### M3 — Perpetuals
- [ ] Position open/adjust/close paths work.
- [ ] Funding index and payment math are documented and tested.
- [ ] PnL and rounding rules are deterministic.
- [ ] Stale/invalid oracle inputs block risk increases.
- [ ] Liquidation incentives, bad debt and pause behavior are defined and tested.

### M4 — Market making
- [ ] Quote authorization and freshness checks work.
- [ ] Inventory, capital, notional, and spread limits are enforced.
- [ ] Fills/cancellations reconcile inventory and PnL.
- [ ] Breaching quotes are rejected.
- [ ] Regression suites for M1–M3 still pass.

## Demo integrity checklist
- [ ] Show the real transaction and explorer state for each implemented market.
- [ ] Demonstrate at least one rejected invalid action for each implemented market.
- [ ] Distinguish implemented, simulated, planned, and blocked features.
- [ ] No invented addresses, performance numbers, AI accuracy, or cross-chain support claims.
- [ ] The demo can be run from a documented clean setup.
