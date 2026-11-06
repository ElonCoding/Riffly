# Riffly --- Supabase + Prisma Database Standards

## Intended architecture

-   **Supabase:** managed PostgreSQL infrastructure and relevant
    platform services.
-   **PostgreSQL:** relational database and durable source of truth for
    structured Riffly data.
-   **Prisma:** schema definition, generated TypeScript client,
    migrations, and typed database access.
-   **Riffly application:** server-side database access through a
    centralized module/service boundary.

Validate the architecture against the existing code and deployment
environment during Milestone 0. Do not assume every Supabase feature is
needed.

## Source of truth

-   `prisma/schema.prisma` defines the intended schema.
-   `prisma/migrations/` contains version-controlled migration history.
-   Migration changes must be reviewed and tested before deployment.
-   Do not modify production schema manually outside the approved
    migration workflow.
-   Do not create duplicate schema definitions or disconnected data
    stores without a documented reason.

## Required practices

1.  Centralized Prisma Client initialization; avoid creating multiple
    uncontrolled clients.
2.  Environment variables validated at startup.
3.  `.env.example` contains names and safe placeholders only, never
    secrets.
4.  Explicit relations, primary keys, unique constraints, indexes, and
    deletion behavior.
5.  Use transactions for multi-step operations requiring atomicity.
6.  Design idempotency and concurrency handling for event-driven Discord
    features.
7.  Use pagination for potentially large collections.
8.  Avoid N+1 queries and unbounded queries.
9.  Handle connection pooling appropriately for the actual
    runtime/deployment.
10. Keep database access out of presentation/command code where
    practical; use services/repositories consistent with the audited
    architecture.
11. Validate inputs before database writes.
12. Log operational errors without leaking credentials, tokens, or
    sensitive user data.
13. Maintain seed scripts only for safe development/test data.
14. Maintain backups and document restore expectations; verify recovery
    before production readiness.
15. Consider privacy, data minimization, retention, and user/server
    deletion requirements.

## Migration workflow

For every schema change: 1. Inspect current schema and related
application code. 2. Propose model/relationship changes and migration
impact. 3. Update `schema.prisma`. 4. Run Prisma schema validation. 5.
Generate Prisma Client. 6. Create a named migration using the project's
supported workflow. 7. Review the generated SQL for destructive or
surprising changes. 8. Apply to a development/test database. 9. Run
migration and application integration tests. 10. Verify existing data
compatibility and rollback/recovery strategy. 11. Update
`docs/DATABASE_SCHEMA.md` and `docs/DATABASE_MIGRATIONS.md`. 12. Report
exactly what was verified.

Never run a destructive migration against production without explicit
user approval and a recovery plan.

## Supabase security

-   Never expose `service_role` credentials in client-side code.
-   Use least-privilege credentials and secure secret management.
-   If dashboard/browser access is introduced, design and test Row Level
    Security and authorization carefully.
-   Discord bot privileged access must remain server-side.
-   Do not assume RLS alone replaces application authorization.
-   Keep local, test, staging, and production environments separated.

## Suggested deliverables (adapt after audit)

-   `prisma/schema.prisma`
-   `prisma/migrations/`
-   `prisma/seed.ts` (if appropriate)
-   centralized database client module
-   database service/repository conventions
-   `.env.example`
-   `docs/DATABASE_SCHEMA.md`
-   `docs/DATABASE_MIGRATIONS.md`
-   `docs/DATABASE_SETUP.md`
-   tests for persistence, relations, transactions, and failure cases

## Completion criteria

Database work is complete only when schema validation, client
generation, migration checks, appropriate database tests, security
review, and documentation are verified. If a live Supabase project or
credentials are unavailable, clearly distinguish local validation from
live integration verification.
