# AUREX Storage, Event, and Indexing Schema

**Version:** 4.0.0 | **Status:** Logical schema; finalize types and units in implementation

## 1. Rules
Contract state is authoritative. Every amount has a token/denomination and base units. Credit eligibility is an amount, not an ambiguous score. Events are not trusted cross-chain without authenticated source/finality. Indexer is a cache, not authority.

## 2. Logical entities

### MarketConfig
`marketId: bytes32`; `marketType: enum`; `chainId: uint256`; `asset: address`; optional `collateralAsset`; `enabled: bool`; `maxExposure: uint256`; `policyVersion: uint32`; `configHash: bytes32`.

### Loan
`loanId: uint256`; `marketId: bytes32`; `borrower: address`; `principalInitial: uint256`; `principalOutstanding: uint256`; `collateralAmount: uint256`; `createdAt/dueAt: uint64`; `status: enum`; `policyVersion: uint32`; optional `reservationId: bytes32`; optional `interestOrFeeAccrued: uint256`.

### BorrowerStats
`verifiedRepaymentCount: uint64`; `verifiedRepaidValue: uint256`; `outstandingExposure: uint256`; `defaultCount: uint64`; `lastUpdateAt: uint64`; `policyVersionLastEvaluated: uint32`.

### CreditReservation
`reservationId: bytes32`; `borrowerKey: bytes32`; `homeChainId`; `destinationChainId`; `destinationContract`; `marketId`; `amount`; `denomination`; `createdAt`; `expiresAt`; `nonce`; `status`; `destinationLoanRef`.

### ProcessedMessage
`messageId`; `sourceChainId`; `sourceSender`; `nonce`; `payloadHash`; `processed`; `processedAt`.

### RiskReport
`reportId`; `modelId`; `modelVersion`; `ruleSetVersion`; `sourceChainId`; `fromBlock`; `toBlock`; `createdAt`; `riskLevel`; `reportHash`; `signerSetId`; `revokedOrSuperseded`.

## 3. Statuses
Loan: `None`, `Active`, `Repaid`, `Overdue`, `Defaulted`, `Recovered`, optional `Liquidated`. Define legal transitions and prevent reopening closed loans without a separate correction process.

Reservation: `None`, `Requested`, `Confirmed`, `Consumed`, `ReleasePending`, `Released`, `Rejected`, `Expired`, `Cancelled`. Consumed reservations do not release simply because a timer expires.

## 4. AI report JSON example
```json
{
  "schemaVersion": "1",
  "reportId": "bytes32",
  "modelId": "aurex-risk-monitor",
  "modelVersion": "0.1.0",
  "ruleSetVersion": 1,
  "sourceChainId": 0,
  "fromBlock": 0,
  "toBlock": 0,
  "createdAt": 0,
  "riskLevel": "warning",
  "score": null,
  "reasonCodes": ["DUPLICATE_MESSAGE_ATTEMPT"],
  "evidenceRefs": ["chainId:txHash:logIndex"],
  "mode": "shadow",
  "expiresAt": 0,
  "signature": "..."
}
```
Values are placeholders, not deployment data.

## 5. Events
`MarketConfigured`; `LoanCreated`; `RepaymentRecorded`; `LoanStatusChanged`; `CreditPolicyUpdated`; `CreditReservationCreated`; `CreditReservationConfirmed`; `CreditReservationConsumed`; `CreditReservationReleaseRequested`; `CreditReservationReleased`; `CrossChainMessageProcessed`; `CrossChainMessageRejected`; `RiskReportRegistered`; `RiskReportRevoked`; `PauseStateChanged`; role grant/revoke events.

Include stable IDs, relevant actors, amounts, policy versions, and status transitions. Do not emit large feature vectors.

## 6. Optional indexer schema
- `loans`: unique (`chain_id`, `contract_address`, `loan_id`).
- `repayment_events`: unique (`chain_id`, `tx_hash`, `log_index`).
- `reservations`: unique (`home_chain_id`, `coordinator_address`, `reservation_id`).
- `cross_chain_messages`: unique (`provider`, `message_id`).
- `risk_reports`: unique (`report_id`).

Indexer handles reorgs/reprocessing. It must not authorize borrowing.

## 7. Cross-chain extension
Portable credentials may include source chain/contract, borrower key/commitment, loan/event IDs, outcome, block/finality info, issuer, schema version, expiry/revocation. Global exposure additionally needs a canonical borrower key, reservation ID, denomination, destination, status, expiry, nonce, and failure/reconciliation rules.


---
