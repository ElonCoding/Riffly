# AI Monitoring and Risk Intelligence Specification

**Version:** 4.0.0 | **Mode:** Shadow/advisory first

## 1. Purpose
Detect anomalies in lending, reservations, oracle status, cross-chain message flow, and later market activity. Provide evidence-linked alerts for human/authorized review. AI is not a financial authority.

## 2. Authority boundary
AI may detect, classify, forecast where validated data exists, summarize evidence, and recommend investigation. AI may not transfer funds, mint credit, create/release reservations, change credit limits or collateral factors, execute trades/liquidations, or grant roles. Model outage must not disable deterministic contract safety.

## 3. Model strategy
MVP: deterministic rules plus an anomaly model in shadow mode. Candidate: Isolation Forest for unsupervised anomaly exploration; LightGBM/XGBoost only if meaningful labeled data and validation exist. A language model may summarize structured evidence, but free-form output must never become numeric credit authority.

Do not claim predictive accuracy from synthetic data. If no representative labeled dataset exists, the model remains advisory and evaluation is scenario-based.

## 4. Data pipeline
1. Ingest canonical chain events and relevant state.
2. Validate chain ID, contract address, event signature, block range, and canonicality.
3. Normalize units/decimals.
4. Build versioned features.
5. Run deterministic rules and model.
6. Produce structured report with evidence references.
7. Sign using authorized monitor key/quorum.
8. Register report hash/metadata onchain.
9. Display advisory alert with provenance.
10. Preserve audit logs and correction/revocation history.

## 5. Candidate features
Repayment timeliness; loan age/amount; outstanding exposure; rapid borrow/repay cycles; failed borrowing attempts; utilization spikes; stale/invalid oracle events; cross-chain message latency, duplicates, and invalid source attempts; reservation age; future perp margin/funding anomalies; future market-maker inventory/quote deviations.

Use public protocol state or explicitly authorized data. Avoid unnecessary personal or sensitive data.

## 6. Risk report schema
- `reportId`: unique identifier/hash.
- `modelId`, `modelVersion`, `ruleSetVersion`.
- `chainId`, contract addresses.
- `fromBlock`, `toBlock` or event window.
- `createdAt`, `expiresAt`.
- `riskLevel`: informational/warning/critical.
- optional `score` with scale/calibration notes.
- stable `reasonCodes`.
- `evidenceRefs` such as tx hash/event ID.
- `mode`: shadow/advisory/deprecated.
- signature/attestation reference.

Store detailed feature vectors offchain; onchain store report hash and essential metadata only.

## 7. RiskAttestationRegistry
- Accept only authorized signer/quorum.
- Reject duplicate report IDs/nonces.
- Bind report to protocol and chain domain.
- Store report hash, model version, source window, risk level, timestamp as needed.
- Emit registration event.
- Support authorized superseding/revocation.
- Expose no function that directly changes credit policy or transfers funds.

The AI key must not also be an admin, pauser, treasury, or upgrade key.

## 8. Evaluation and lifecycle
Report precision/recall when labels exist, false positives/negatives, detection delay, calibration if probabilistic, drift, scenario performance, and comparison to rules baseline. Version datasets, features, model artifacts, and reports. Run new models in shadow mode before advisory release; support rollback to rules-only.

## 9. Failure behavior
Invalid signature: reject. Duplicate report: reject/idempotent. Missing data: “insufficient data,” not “low risk.” Inference outage: deterministic contracts continue. Drift: disable model alerting or retain advisory-only mode. Compromised signer: revoke via governed procedure. False positive: reviewable alert, no automatic fund freeze in MVP.

## 10. Acceptance criteria
Every alert shows model/rule version and evidence window; unauthorized signer rejected; replay rejected; AI cannot call privileged functions; disabling AI does not change credit eligibility; scenario tests cover normal/anomalous/missing/delayed/outage cases; synthetic metrics are labelled synthetic.


---


## V4 positioning

AI monitoring is a supporting model, not the financial product's core mechanism. Implement deterministic event-based rules first. An ML model is optional and must not block a market milestone. If a model is used, document dataset provenance, features, baseline, evaluation, limitations, and whether data is synthetic. AI has no authority to approve credit, move assets, change policy, consume/release cross-chain reservations, or liquidate positions.
