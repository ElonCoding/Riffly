# Test Plan and Acceptance Criteria

**Version:** 4.0.0

## 1. Test layers
Unit, fuzz, invariant, integration, cross-chain adapter, AI pipeline, frontend, static analysis (e.g. Slither), and manual threat-model review.

## 2. Lending acceptance matrix

| Test | Expected |
|---|---|
| Valid loan | Succeeds and emits `LoanCreated` |
| Exceeds loan/borrower cap | Reverts |
| Insufficient liquidity | Reverts |
| Borrowing paused | Reverts |
| Full repayment | Closes loan and emits event |
| Unauthorized attestation | Reverts |
| Duplicate repayment | Reverts/idempotent |
| Default before deadline | Reverts |
| Valid overdue/default | Applies documented state |
| Stale required oracle | Risk-increasing call reverts |
| Reentrancy attempt | No duplicate drawdown/accounting corruption |

## 3. Cross-chain acceptance matrix

| Test | Expected |
|---|---|
| Correct confirmation | May proceed after local checks |
| Wrong source chain/contract/destination | Reject |
| Duplicate message/nonce | No second state change |
| Reservation consumed twice | Reject |
| Amount/borrower mismatch | Reject |
| Unconfirmed reservation | No disbursement |
| Expired unconsumed reservation | Reject/expire |
| Consumed reservation timeout | Capacity remains encumbered |
| Delayed release | Capacity remains unavailable |
| Concurrent reservations exceed cap | Excess request rejected |
| Coordinator unavailable | Fail closed |
| Invalid provider message | Reject and emit event |

## 4. AI acceptance matrix
Valid authorized report accepted once; invalid signature rejected; unauthorized signer rejected; duplicate ID rejected; wrong domain rejected; model outage leaves contract rules unchanged; missing data says insufficient data; model version is visible; AI key cannot call admin functions; alert includes evidence refs; synthetic metrics are labelled synthetic.

## 5. Future market gates
- **Order book:** deterministic matching priority; cancelled orders cannot fill; funds not double-used; local atomic settlement; no hidden centralized matcher if claiming fully onchain.
- **Perps:** margin/PnL/funding tests; liquidation thresholds; stale-oracle and shock tests; exposure limits.
- **Market maker:** quote/inventory/capital bounds; strategy cannot spend unallocated funds; paused market rejects new risk.

## 6. CI
`forge fmt --check`, `forge build`, `forge test -vvv`, fuzz/invariants, Slither, frontend lint/typecheck/tests, AI schema/model tests. Record commit hash, compiler/dependency versions, and actual results. Never claim a test passed if it was not run.


---
