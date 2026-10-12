# Deployment and Operations Runbook

**Version:** 4.0.0

## 1. Environments
Separate local Foundry, home-chain testnet, destination testnet, and future production configs. Do not reuse keys/addresses without verification.

## 2. Deployment manifest
Record chain name/ID, explorer, RPC env variable, token addresses/decimals, oracle/feed config if used, messaging provider/router/remote chain IDs, contract addresses and tx hashes, compiler/dependency versions, commit hash. Verify each address from official docs and the relevant explorer.

## 3. Deployment order
1. AccessManager/PauseController.
2. CreditHistoryRegistry.
3. CreditPolicy with conservative caps.
4. Home-chain CreditCoordinator.
5. LendingPool.
6. Configure roles and authorized registry/pool.
7. RiskAttestationRegistry and report-only monitor signer.
8. Message adapter/receiver only after route verification.
9. Approved assets and optional oracle feeds.
10. Verify roles/caps/pause/config.
11. Smoke test and end-to-end testnet run.
12. Publish manifest and transaction links.

If route is unverified, use mock adapter only in test environments and label it simulated.

## 4. Secrets
Keep `.env` out of version control. Separate deployer, monitor signer, and admin keys. AI key must not be admin/pauser/treasury/upgrade authority. Never expose secrets in frontend variables.

## 5. Monitor
Failed borrow attempts, utilization/debt, overdue/defaults, oracle freshness, message age/duplicates, active/release-pending reservations, AI uptime/invalid reports/drift, privileged role changes.

## 6. Incident response
- Contract exploit: pause risk-increasing operations; preserve safe repayment; publish affected contracts and status.
- Cross-chain inconsistency: stop new reservations; keep uncertain capacity encumbered; reconcile coordinator, destination state, and provider messages; no manual release without reviewed authorization.
- AI compromise: revoke monitor signer, switch to rules-only mode, mark suspect reports, do not automatically pause financial contracts merely because model service is down.

## 7. Go-live
This specification authorizes testnet prototype only. Mainnet requires independent audit, cross-chain provider review, oracle review, economic-risk validation, operations/incident plan, and legal review where applicable.


---
