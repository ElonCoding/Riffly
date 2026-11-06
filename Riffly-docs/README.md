# Discord Music Bot Platform — Project Documentation

This repository is the source of truth for building the project with Antigravity, Claude, Codex, or another coding agent.

## Current product direction

Build a modular Discord bot in TypeScript. Start with reliable music playback, then add additional modules only after the music MVP passes its acceptance tests.

## Read these files in order

1. `AGENTS.md` — non-negotiable instructions for coding agents.
2. `PRD.md` — product goals, scope, personas, and requirements.
3. `ARCHITECTURE.md` — system boundaries and data flow.
4. `TRD.md` — chosen technologies and technical implementation requirements.
5. `MUSIC_PIPELINE.md` — provider resolution and audio playback pipeline.
6. `SECURITY.md` — secrets, URL safety, permissions, and abuse prevention.
7. `TEST_PLAN.md` — test strategy and release gates.
8. `ROADMAP.md` — phased implementation order.
9. `DECISIONS.md` — confirmed decisions, open questions, and assumptions.
10. `TASKS.md` — small implementation tasks for an AI coding agent.
11. `RUNBOOK.md` — local setup, troubleshooting, and operations.

## Naming clarification

“RDA” is ambiguous in software documentation. This package includes `REQUIREMENTS_TRACEABILITY.md` and `DECISIONS.md` instead of guessing whether RDA means requirements/design/architecture. If your organization uses RDA to mean a specific artifact, rename or add that artifact after defining the acronym.

## Important truth

These documents are a constrained project specification, not proof that every provider permits audio streaming. Provider access, plugin status, licences, terms, and API behavior must be checked against current official documentation before implementation. Never invent credentials, endpoints, package APIs, or provider capabilities.
