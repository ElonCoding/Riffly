# Riffly --- Mandatory Loop Engineering

## Definition

Loop Engineering means the agent repeatedly executes a disciplined
engineering cycle until the task meets all acceptance criteria. Writing
code is not equivalent to completing a task.

## Required loop

1.  **Understand:** Restate task, inspect relevant code and context.
2.  **Specify:** Define scope, assumptions, acceptance criteria, edge
    cases, and Definition of Done.
3.  **Plan:** Break work into small tasks; identify files, dependencies,
    risks, and test strategy.
4.  **Implement:** Make the smallest coherent change within scope.
5.  **Verify:** Run the relevant checks and tests; capture actual
    outputs.
6.  **Diagnose:** For each failure, identify root cause rather than
    masking symptoms.
7.  **Fix:** Apply a targeted correction.
8.  **Retest:** Rerun failed checks and relevant regression tests.
9.  **Review:** Inspect diff, security, data integrity, unintended
    behavior, and requirement coverage.
10. **Document:** Update task status, implementation log, docs, and
    milestone artifacts.
11. **Close:** Mark complete only when every acceptance criterion
    passes.

Repeat steps 4--8 as necessary. Do not impose an arbitrary iteration
limit.

## Test integrity

Never: - remove or weaken a test to make a task pass without explicit
approval; - silence compiler/linter errors instead of resolving them; -
claim a test passed if it was not run; - treat mocked behavior as
production verification; - ignore a failed or flaky test without
documenting it; - claim external integration works when credentials or
services were unavailable.

If a test is impossible to run, mark it **NOT VERIFIED**, explain why,
and determine whether that blocks completion.

## Blocker protocol

Stop and request input when: - requirements are materially ambiguous; -
credentials or access are unavailable; - a decision is destructive or
irreversible; - production data could be affected; - scope must
expand; - the only proposed fix risks breaking established behavior.

Continue safe independent work when possible, but do not falsely
complete the blocked task.

## Regression discipline

Before changing existing behavior: - identify affected paths; - inspect
current tests; - add/update tests for the intended change; - preserve
unrelated behavior; - run relevant regression tests after changes.

Music, Lavalink, voice connections, command registration, and deployment
are high-sensitivity areas.

## Evidence-based completion report

For each task, report: - Task ID and scope - Acceptance criteria, each
`PASS`, `FAIL`, or `NOT VERIFIED` - Files changed - Commands/checks
actually executed - Test results and relevant evidence - Bugs/root
causes/fixes - Database migration impact - Remaining risks or
limitations - Final status

## Task status definitions

-   `NOT STARTED`: no work yet.
-   `IN PROGRESS`: implementation or verification underway.
-   `BLOCKED`: progress requires an external dependency or user
    decision.
-   `REVIEW REQUIRED`: implementation appears ready; awaiting
    review/approval.
-   `COMPLETED`: all criteria verified and documented.

## Milestone gate

A milestone is not complete if any required task is incomplete, any
critical acceptance criterion fails, or a required verification is not
performed.

After the completion report, stop. Do not start the next milestone until
the user explicitly approves it.
