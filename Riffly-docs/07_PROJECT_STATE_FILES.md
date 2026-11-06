# Riffly --- Persistent Project State Instructions

Anti-gravity must create and maintain these repository files. Adapt
names only if equivalent files already exist; avoid duplicates.

## `MILESTONES.md`

A concise table of all milestones: \| ID \| Name \| Status \|
Dependencies \| Approval \| \|---\|---\|---\|---\|---\|

Only one milestone may be `IN PROGRESS` at a time.

## `TASKS.md`

Track tasks for the active milestone: \| ID \| Task \| Status \|
Acceptance criteria \| Evidence/notes \| \|---\|---\|---\|---\|---\|

Keep tasks small and verifiable.

## `docs/IMPLEMENTATION_LOG.md`

Append dated entries containing: - milestone/task ID; - changes made; -
files affected; - iteration number; - tests executed and actual
results; - issues and resolutions; - decisions and approvals; - current
verified state.

Do not rewrite history to conceal failures. Correct mistakes with a new
entry.

## `ROADMAP.md`

Maintain planned milestones, dependencies, scope changes, and status.
Mark the roadmap as provisional until the audit is approved.

## `CHANGELOG.md`

Record meaningful user-visible changes. Do not dump every internal edit.

## State consistency

When updating status, ensure the task file, milestone file, roadmap, and
implementation log agree. If they disagree, investigate and reconcile
instead of choosing one arbitrarily.

## Session recovery

At the beginning of a resumed session: 1. Read state files. 2. Identify
the active milestone and task. 3. Review the last implementation log
entry and evidence. 4. Inspect the current git diff/status. 5. Re-run
stale or uncertain verification. 6. Continue only within the approved
scope.
