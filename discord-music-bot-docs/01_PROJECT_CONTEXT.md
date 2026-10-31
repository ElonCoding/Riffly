# Riffly --- Project Context

## Product

**Riffly** is an existing Discord bot evolving toward an all-in-one
Discord community platform.

Repository: https://github.com/ElonCoding/Riffly

The product vision may include: - Music playback and queue/player
management - Moderation and moderation cases - Logging and audit
trails - Tickets - Verification and onboarding - Voice channel
management / VoiceMaster - XP, ranks, and leveling - Automod and server
security - Community tools: giveaways, polls, suggestions, reports,
starboard, AFK, invite tracking - Utilities and entertainment - Economy
features - AI-assisted features and automation - A web dashboard

This list is a **vision inventory, not permission to implement
everything now**. Features must be audited against the repository,
prioritized, scoped into milestones, and approved sequentially.

## Existing system

The project has previously been described as using: - TypeScript -
Node.js - Discord.js v14 - Lavalink v4 - Existing slash commands and
interaction handlers - Music player and queue - Docker / deployment
configuration - Render deployment considerations - Vitest

These are leads to verify, not unquestionable facts. Inspect package
files and implementation to establish the actual versions and status.

## Preservation requirement

Before changing code, identify current behavior and create regression
checks where feasible. Music and voice features are particularly
important. Do not remove or replace a functioning subsystem merely
because a new design is more fashionable.

## Product and engineering principles

-   Modular architecture, but avoid overengineering.
-   Strong TypeScript types and clear boundaries.
-   Consistent command and interaction patterns.
-   Centralized error handling, logging, configuration, and permissions.
-   Durable storage for features that must survive restarts.
-   Secure handling of Discord tokens, database URLs, API keys, and
    OAuth secrets.
-   Observable behavior: useful logs, health checks, and diagnostics.
-   Functional implementations rather than fake success responses.
-   Accessible, understandable user-facing command help.
-   Testable changes with clear acceptance criteria.

## Command-scale constraint

Discord application commands have platform limits. Audit current
registrations and plan a scalable command UX using subcommands, groups,
buttons, select menus, modals, and context menus where appropriate. Do
not blindly register one top-level command for every feature.

## User's execution preference

The user will assign a specific task or milestone to Anti-gravity and
allow time for it to work. Anti-gravity must: - stay focused on the
assigned scope; - keep iterating until the acceptance criteria are
satisfied; - not jump to future milestones; - report blockers
honestly; - preserve durable progress in project documents; - request
approval at milestone boundaries.
