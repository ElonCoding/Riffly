# Requirements Traceability Matrix

| Requirement ID | Requirement | Design reference | Verification |
|---|---|---|---|
| R-001 | Bot connects and responds to health command | ARCHITECTURE, TRD | Integration test |
| R-002 | Accept query or recognized URL | MUSIC_PIPELINE | Classifier unit tests |
| R-003 | Reject unsupported or unsafe URLs | SECURITY, MUSIC_PIPELINE | Security tests |
| R-004 | Separate metadata from playback eligibility | MUSIC_PIPELINE | Resolver unit tests |
| R-005 | Play a permitted test asset in Discord voice | ARCHITECTURE | End-to-end manual test |
| R-006 | Maintain isolated queue per guild | ARCHITECTURE, TRD | Unit/integration tests |
| R-007 | Advance queue once per track end | TRD | Idempotency test |
| R-008 | Handle source and node errors | TRD, TEST_PLAN | Failure injection tests |
| R-009 | Keep secrets out of code/logs | SECURITY | Secret scan and log test |
| R-010 | Build is reproducible | TRD, RUNBOOK | Clean setup/build test |
