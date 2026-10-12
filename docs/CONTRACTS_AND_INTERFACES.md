# Contracts and Interface Boundaries

**Version:** 4.0.0

## 1. Contract inventory

| Contract | Responsibility | Must not do |
|---|---|---|
| `AccessManager` | Role management | Give AI key admin rights |
| `PauseController` | Pause risk-increasing functions | Needlessly block safe repayment |
| `CreditHistoryRegistry` | Authorized repayment/default records | Trust borrower self-attestation |
| `CreditPolicy` | Deterministic versioned eligibility | Allow AI to override limits |
| `CreditCoordinator` | Canonical global capacity/reservations | Release active exposure without authenticated closure |
| `LendingPool` | Token custody and loan lifecycle | Exceed policy/liquidity/solvency limits |
| `MessageAdapter` | Provider-specific send/receive | Trust caller-supplied source claims |
| `MessageReceiver` | Source/domain/nonce/type validation | Process a message twice |
| `RiskAttestationRegistry` | Advisory report metadata | Transfer funds or change credit rules |
| `OracleRouter` | Normalize/validate prices if needed | Return arbitrary fallback on error |
| `OrderBook` (later) | Orders/matching/settlement | Hide centralized matcher while claiming fully onchain |
| `PerpEngine` (later) | Position/margin/funding/liquidation | Use AI score as sole liquidation authority |
| `MarketMaker` (later) | Quotes and inventory | Exceed capital/risk caps |

## 2. Interface principles
Use explicit units and asset IDs; stable custom errors; events for material transitions; no circular dependencies; no direct writes to another module's storage; reserve exposure before disbursement; release only after authenticated closure; AI signer has report-only permission.

## 3. Illustrative interfaces
```solidity
interface ICreditPolicy {
    function eligibleCredit(bytes32 borrowerKey, bytes32 marketId)
        external view returns (uint256 amount, uint32 policyVersion);
}

interface ICreditCoordinator {
    function requestReservation(
        bytes32 borrowerKey,
        uint256 destinationChainId,
        address destination,
        bytes32 marketId,
        uint256 amount,
        uint64 expiresAt
    ) external returns (bytes32 reservationId);

    function isReservationConfirmed(bytes32 reservationId)
        external view returns (bool);
}

interface IRiskAttestationRegistry {
    function registerReport(
        bytes32 reportId,
        bytes32 modelVersion,
        uint256 sourceChainId,
        uint256 fromBlock,
        uint256 toBlock,
        uint8 riskLevel,
        bytes32 reportHash,
        bytes calldata signature
    ) external;
}
```
Illustrative only: final ABI must define signature scheme, domain separation, roles, and state transitions. Provider-authenticated source metadata must come from the messaging adapter context.

## 4. Atomicity warning
Transactions across independent EVM chains are not atomic. Use state machines, reservations, and reconciliation. Do not describe cross-chain settlement as globally atomic.

## 5. AI boundary
Do not implement `setCreditLimitFromAI`, `executeLiquidationFromAI`, or similar unrestricted methods. Any future AI influence must be separately approved, bounded, deterministic, pausable, and tested. It is not MVP.


---
