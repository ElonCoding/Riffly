# Riffly --- Proposed Master Roadmap

> This roadmap is provisional until Milestone 0 audits the repository.
> Anti-gravity must revise ordering, split/merge milestones, and record
> dependencies based on actual code. No milestone is authorized merely
> by appearing here.

## Milestone 0 --- Repository Audit & Planning

**Goal:** Understand the existing project without modifying application
code. **Deliverables:** project audit, architecture map, existing
feature inventory, technical debt, database strategy, dependency/risk
map, detailed milestone plan. **Gate:** User approves audit and proposed
roadmap.

## Milestone 1 --- Engineering Foundation

**Goal:** Establish stable development conventions and infrastructure
based on audit findings. Possible scope: configuration validation,
logging, error handling, shutdown lifecycle, scripts, lint/type checks,
CI, test baseline, environment example, deployment documentation.
**Gate:** All agreed foundation acceptance criteria pass; no
music/command regressions.

## Milestone 2 --- Supabase + Prisma Database Foundation

**Goal:** Establish durable and maintainable database integration.
Possible scope: Supabase PostgreSQL project configuration, Prisma
schema, migration workflow, centralized client, connection strategy,
seed scripts, database documentation, test database strategy. **Gate:**
schema validates, client generates, migrations are verified in
development, core database tests pass, secrets are not exposed.

## Milestone 3 --- Core Domain & Persistence Patterns

**Goal:** Establish reusable patterns for guild configuration,
user/guild records, repositories/services, transactions, validation, and
persistence conventions. **Gate:** agreed core models and operations
tested and documented.

## Milestone 4 --- Command & Interaction Framework

**Goal:** Standardize command discovery/registration, execution,
subcommands, autocomplete, buttons, select menus, modals, errors,
cooldowns, and permissions. **Gate:** representative commands work and
existing commands pass regression checks.

## Milestone 5 --- Permission & Authorization System

**Goal:** Centralize owner, extra-owner, administrator, moderator,
custom-role, and guild-specific authorization where required. **Gate:**
authorization tests cover allow/deny paths and privilege boundaries.

## Milestone 6 --- Moderation

Ban, unban, kick, timeout, warn, mute if supported, softban/tempban,
purge, slowmode, lock/unlock, role moderation, cases, history, and safe
persistence. **Gate:** permissions, edge cases, audit logging, and tests
pass.

## Milestone 7 --- Logging & Audit Trails

Configurable message, member, voice, moderation, channel, role, and
guild event logging. **Gate:** event coverage, privacy, and
configuration behavior verified.

## Milestone 8 --- Tickets

Panels, categories, open/close/reopen, claim, member management,
rename/transfer, transcripts, logging, and persistent state. **Gate:**
permission safety and restart persistence verified.

## Milestone 9 --- Verification & Onboarding

Verification flows, roles, welcome/goodbye, embeds, autoroles,
onboarding, configurable variables. **Gate:** configuration, interaction
security, and persistence verified.

## Milestone 10 --- Voice Channel Management

Join-to-create, temporary channels, ownership, limits, rename,
lock/hide, permit/deny, move, transfer ownership, cleanup. **Gate:**
lifecycle and permission behavior verified.

## Milestone 11 --- Music Reliability & Enhancements

Preserve and improve Lavalink, player lifecycle, queue, search,
playlists/favorites, filters, controls, recoverability where feasible,
diagnostics, and error handling. **Gate:** playback, voice lifecycle,
and regression tests pass; deployment configuration documented.

## Milestone 12 --- XP & Leveling

Message/voice XP, progression, rank, leaderboard, rewards,
configuration, abuse prevention. **Gate:** persistence, concurrency, and
anti-abuse tests pass.

## Milestone 13 --- Automod & Server Security

Spam/link/caps/mention/word rules, exclusions, anti-raid/anti-nuke,
whitelist, thresholds, lockdown, security logs. **Gate:** safe defaults,
permission checks, and false-positive controls validated.

## Milestone 14 --- Community Engagement

Giveaways, polls, invites, suggestions, reports, starboard, AFK,
autoresponses, counting, and scheduled lifecycle handling. **Gate:**
persistent jobs and restart behavior verified.

## Milestone 15 --- Utilities & Entertainment

Reminders, timers, translation, dictionary, Wikipedia, GitHub, weather,
crypto information, games, trivia, and other approved utilities.
**Gate:** external integrations use appropriate APIs, timeouts, rate
limits, and graceful failures.

## Milestone 16 --- Economy

Balances, currency, rewards, inventory, shop, transactions,
leaderboards, and anti-exploit protections. **Gate:** atomicity,
idempotency, concurrency, and abuse tests pass.

## Milestone 17 --- AI Features

AI assistant, server assistance, moderation assistance, automations,
privacy controls, usage limits, observability, provider abstraction.
**Gate:** user consent, security, data handling, cost controls, and
failure handling reviewed.

## Milestone 18 --- Web Dashboard

Discord OAuth2, guild selection, dashboard authorization, configuration,
moderation/tickets, analytics, and integrations. Use a secure
server-side backend. Never expose Supabase service-role credentials or
privileged database access to browser code. **Gate:** auth,
authorization, security, API, and deployment checks pass.

## Milestone 19 --- Production Readiness

Security review, performance/load checks, database optimization,
monitoring, alerting, backup/restore verification, deployment runbooks,
documentation, release checklist. **Gate:** production-readiness
checklist signed off by user.

## Milestone tracking rules

-   Statuses: `NOT STARTED`, `IN PROGRESS`, `BLOCKED`,
    `REVIEW REQUIRED`, `COMPLETED`.
-   Every milestone must have scope, dependencies, tasks, acceptance
    criteria, test plan, risks, and Definition of Done.
-   Milestone ordering is not fixed until audit.
-   Only one milestone may be active at a time.
-   Completion requires user approval to proceed.
