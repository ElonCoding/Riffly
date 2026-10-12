# Cross-Chain Credit and Exposure Coordination

**Version:** 4.0.0 | **Status:** Design; target chains/provider TBD

## 1. Goal and distinction
AUREX must distinguish:
- **Portable credit history:** a destination verifies a source-chain credential/history record.
- **Global exposure enforcement:** destination borrowing requires a capacity reservation in a canonical coordinator.

Portable history alone does not reveal all outstanding debt and cannot enforce a global limit.

## 2. Recommended prototype model
Use a designated home-chain `CreditCoordinator` as canonical authority for credit capacity and cross-chain reservations. Destination chains may disburse only against a valid confirmed reservation. This is a prototype tradeoff with a home-chain availability/trust dependency, not a claim of trustless cross-chain consensus.

Invariant: `global outstanding exposure + active reserved exposure <= global credit capacity`.

## 3. Reservation state machine
`None -> Requested -> Confirmed -> Consumed -> ReleasePending -> Released`
Alternative terminal states: `Rejected`, `Expired`, `Cancelled` only if no destination obligation can remain active.

- A reservation has unique ID, borrower key, destination chain/contract, amount/denomination, expiry, nonce, and status.
- A reservation is consumed at most once.
- A consumed reservation does not expire into free capacity automatically.
- If release is delayed, capacity remains encumbered.
- If coordinator/message confirmation is unavailable, new cross-chain borrowing fails closed.

## 4. Flow
1. User requests cross-chain credit.
2. Home coordinator checks cap, outstanding exposure, active reservations, policy version, and nonce.
3. Coordinator reserves capacity and emits event.
4. Authenticated message delivers confirmation.
5. Destination validates provider-authenticated source, reservation ID, amount, borrower, destination, expiry, and nonce.
6. Destination marks reservation consumed and disburses only after local policy/liquidity/solvency checks.
7. On repayment/closure, destination sends authenticated release request.
8. Home coordinator validates closure and releases capacity.
9. Delays leave capacity encumbered until reconciliation.

## 5. Message envelope
Protocol version; source/destination chain IDs; source/destination contracts; message type; canonical borrower key; reservation ID; amount and denomination; nonce; expiry; source loan/event reference; payload hash.

Use provider-authenticated source metadata, not self-reported payload fields. Domain-separate signatures and IDs by protocol, chain, and contract.

## 6. Provider selection
Use a provider-neutral adapter first. Select a live provider only after official documentation verifies the exact source/destination route, deployments, fees, finality assumptions, and testnet availability. Chainlink CCIP and LayerZero are candidates to evaluate, not selected or assumed available. Never invent addresses.

## 7. Failure policy

| Failure | Required behavior |
|---|---|
| Confirmation delayed | No disbursement |
| Duplicate message | Idempotent/no second state change |
| Wrong source chain/contract | Reject |
| Replay nonce | Reject |
| Coordinator unavailable | Block new cross-chain borrowing |
| Release delayed | Keep capacity encumbered |
| Destination paused | Preserve reservation until reconciled |
| Expiry before consumption | Expire only if no active destination obligation |
| Consumed reservation timeout | Do not auto-release |
| Provider outage | Stop new cross-chain credit |
| Local/global state disagreement | Freeze affected new exposure and reconcile |

## 8. Acceptance tests
Wrong source/destination rejected; amount/borrower mismatch rejected; duplicate confirmation harmless; reservation cannot be consumed twice; expired unconsumed reservation rejected; consumed reservation remains encumbered; delayed release does not free capacity; concurrent requests cannot exceed cap; coordinator outage fails closed; a reservation cannot be used on two chains.

## 9. Scope gate
If no live route is deployed and tested, use a mock adapter only for demonstration and label it simulated. Do not claim globally enforced credit limits.


---


## V4 positioning

Cross-chain is a supporting extension, not the core challenge and not a blocker to proving the first single-chain market. Start with the provider-neutral interface and mock tests. A live route is enabled only after the exact chain pair, provider support, deployed addresses, source authentication, failure semantics, and end-to-end tests are verified. The UI and demo must clearly label mock behavior as simulated.
