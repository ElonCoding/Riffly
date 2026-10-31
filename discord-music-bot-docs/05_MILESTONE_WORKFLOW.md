# Riffly --- Milestone Workflow & Approval Gates

## Before each milestone

Anti-gravity must present: - Milestone name and objective - Why it is
next (dependencies) - In-scope work - Explicit out-of-scope work -
Existing files/modules to inspect - Proposed changes - Database impact -
Risks and mitigations - Subtasks - Acceptance criteria - Test and
verification plan - Definition of Done - Questions requiring user input

Do not start implementation until the user approves the milestone,
unless the user has explicitly authorized that exact milestone in the
current instruction.

## During a milestone

-   Keep scope bounded.
-   Work through one subtask at a time.
-   Use Loop Engineering.
-   Maintain a task checklist and iteration notes.
-   Update project state after meaningful progress.
-   Do not silently add features.
-   Ask before destructive, high-risk, or scope-expanding changes.

## At milestone completion

Deliver a completion report containing: 1. Summary 2. Subtasks and
statuses 3. Acceptance criteria (`PASS` / `FAIL` / `NOT VERIFIED`) 4.
Files created/modified 5. Database/schema/migration impact 6. Commands
and tests actually run 7. Test results 8. Regression results 9.
Remaining bugs, risks, and limitations 10. Documentation updated 11.
Final milestone status 12. Request for approval to proceed

Then stop. Wait for explicit approval.

## Resuming after interruption

First read: - `ROADMAP.md` - `MILESTONES.md` - `TASKS.md` -
`docs/IMPLEMENTATION_LOG.md` - the active milestone specification -
relevant architecture/database/testing docs

Determine the last verified state from files and evidence. Do not trust
conversational memory alone. Do not restart completed work
unnecessarily. Revalidate if evidence is stale or code has changed.
