# AUREX V4 — Four-Milestone Roadmap

**Release:** V4.0.0  
**Planning rule:** Four committed market milestones, delivered sequentially. Dates are not fixed; exit gates control progression.

## Milestone 1 — Credit-history-aware lending

**Goal:** Prove one useful financial mechanism fully onchain.

Deliver:
- Test token and single EVM testnet deployment.
- `CreditHistoryRegistry`, `CreditPolicy`, and `LendingPool`.
- Verified repayment history, versioned deterministic credit limits, borrow/repay state transitions, local exposure and liquidity bounds.
- Wallet UI, policy preview, transaction history and explorer links.
- Foundry unit, fuzz and invariant tests.
- Basic deterministic monitoring rules.
- Cross-chain coordinator/adapter interfaces and mock tests only if they do not endanger the lending exit gate.

Exit gate:
- Successful borrow and full/partial repayment flows reconcile.
- Over-limit, insufficient-liquidity, forged-history and unauthorized-config attempts are rejected.
- No loan state is created when a transaction reverts.
- UI reflects contract state rather than becoming an authority.

## Milestone 2 — Fully onchain order book

**Goal:** Add transparent trading with contract-enforced matching and settlement.

Deliver:
- `OrderBook` order lifecycle, funded escrow, deterministic price-time priority, cancellation, partial fills and atomic settlement.
- Clear price/quantity precision and fee rules.
- UI order entry, order status, trade history and transaction links.
- Matching, cancellation, replay, rounding, escrow and accounting tests.

Exit gate:
- Both sides settle atomically.
- Filled quantity cannot be cancelled or filled twice.
- Escrow and user balances reconcile across partial/full fills.
- No centralized backend matcher is authoritative.

## Milestone 3 — Perpetual futures

**Goal:** Add a derivatives market with explicit, testable risk mechanics.

Deliver:
- `PerpEngine` positions, collateral/margin, cumulative funding index, PnL and liquidation transitions.
- A selected oracle integration only after its feed, decimals, freshness, testnet deployment and failure semantics are verified.
- Defined leverage, fee, funding-rate and liquidation parameters.
- Tests for stale prices, price jumps, funding boundaries, liquidation, rounding and bad debt.

Exit gate:
- Funding is calculated from a documented cumulative index; no claim that code runs automatically every block.
- Risk-increasing actions reject invalid oracle data and insufficient margin.
- Liquidation and bad-debt behavior are explicit and tested.

## Milestone 4 — Onchain market making

**Goal:** Add liquidity provision with hard onchain bounds and integrate the four markets in the UI.

Deliver:
- `MarketMakerVault` or equivalent inventory/capital ledger.
- Onchain validation for quote bounds, maximum inventory, maximum notional, allocated capital, minimum spread and quote freshness/nonce.
- Order-book integration and fill/inventory accounting.
- AI/rule monitoring as advisory only.
- Regression tests across all previously completed markets.

Exit gate:
- A quote or trade that breaches any limit is rejected.
- Inventory and capital reconcile after fills/cancellations.
- Previous market acceptance suites still pass.

## Cross-cutting supporting work

### Cross-chain coordination
Keep a provider-neutral interface and test the reservation state machine with a mock adapter. Live cross-chain is a conditional extension, not a prerequisite for the first market. Enable a provider only after exact route support and configuration are verified and end-to-end tests pass.

### AI monitoring
Begin with deterministic event-based rules. Add an ML anomaly model only if there is time for data preparation and honest evaluation. Monitoring must not control eligibility, funds, reservations, policy, or liquidation.

### Integration policy
- Every milestone builds on the same repository, UI shell, event conventions and testing standards.
- Each market has a distinct contract state machine and accounting ledger.
- Shared interfaces do not imply atomic portfolio-wide risk enforcement.
- No new feature enters scope unless it advances a market, a security invariant, or a stated acceptance criterion.
- If a gate fails, delay and fix it. Do not silently lower the acceptance bar.

## Suggested work split

- **Contract owner:** market contracts, roles, events, Foundry tests.
- **Frontend owner:** wallet/network checks, market UI, contract reads/writes, explorer links.
- **Integration/review owner:** architecture compliance, threat model, deployment scripts, regression tests and demo script.
- **AI/cross-chain contributor (if capacity allows):** advisory monitoring and mock adapter without blocking core market work.

One person may cover multiple roles. Ownership must be explicit to prevent conflicting contract interfaces.
