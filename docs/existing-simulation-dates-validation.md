# Existing simulation dates: validation results

Validated locally on October 1, 2026. No commit, push, deployment, production
migration application, production preview preparation or production timestamp
operation was performed.

## Exact commands and results

| Command | Result |
| --- | --- |
| `npx tsc --noEmit` | Exit 0; no TypeScript errors. Final rerun also passed. |
| `node --env-file=.env.local --test tests/*.test.mjs` | Exit 0; 220 tests, 220 passed, 0 failed, 0 cancelled, 0 skipped, 0 todo. Includes 12 new service/action/UI tests. |
| `npm run lint` | Exit 0; 0 errors, 2 pre-existing unused `_form` warnings in `src/app/admin/(protected)/comment-actions.ts`, lines 75 and 82. Final rerun has the same result. |
| `npm run build` | Exit 0; Next.js 16.3.5 compiled, completed TypeScript checks and generated all 6 static pages. |
| `node scripts/test-new-simulation-sql.mjs` | Exit 0; all 22 logged validation checkpoints passed, detailed below. |
| `git diff --check` | Exit 0; no whitespace errors. Git reports LF/CRLF conversion notices for edited tracked files. |

The SQL runner creates and stops a disposable PostgreSQL 18 database on local
loopback, using the existing cached PostgreSQL/pg tooling. No new package dependency
was added. Supabase Auth/Storage fixtures simulate the database environment; these
tests do not claim to validate hosted Supabase deployment. The complete existing
test suite includes its existing read-only integration checks.

An initial database test run exposed a UUID/text cast error in the new fixture
insert, which was corrected. The final full SQL run passed. An automatic approval
review usage-limit error temporarily blocked final lint/TypeScript reruns; both
were retried successfully after the user requested continuation.

## SQL/security and regression checkpoints

1. Existing `schema_security.sql` passed.
2. Existing `reviewed_work_security.sql` passed.
3. Existing `comment_simulation_security.sql` passed.
4. Existing `new_simulation_security.sql` passed before the new migration.
5. The same future-workflow SQL suite passed after the new migration.
6. Existing future-workflow two-session test observed advisory-lock waiting,
   one exact 18-comment insertion and one duplicate skip.
7. Existing future-workflow injected insertion failure rolled back comments,
   ledger and preview consumption.
8. Existing future-workflow changed/expired previews and replay after cleanup
   were rejected.

The new existing-date harness passed these 14 checkpoints:

1. Anonymous/non-admin access rejected; direct access to private preview storage,
   private helper and comment timestamp updates rejected.
2. Complete 79-comment preview, six correct UTC dates, unique ascending times,
   varied fourth-day placement and exact times, with no source data changes.
3. Each valid count 18–24 successfully prepared and applied its six-day distribution.
4. Explicit confirmation, administrator ownership and expiry enforced.
5. Exactly 79 planned timestamp updates; all other comment fields, genuine comment,
   four batches, entries, articles and categories identical; consumed preview rejected.
6. Changed content, timestamp, ledger membership, batch identity or deleted comment
   invalidated the preview without persisting changes.
7. Ledger/comment article ownership mismatch rejected preparation and confirmation.
8. A new genuine comment colliding with a planned timestamp rejected confirmation.
9. Two real sessions: advisory wait observed; first confirmation committed, the
   competing stale preview and consumed-preview replay were rejected.
10. Failure injected on the fifth UPDATE rolled back earlier updates and preview
    consumption; retry succeeded after removing the injected failure.
11. A trigger that changed content caused the runtime preservation assertion to
    reject and roll back the operation.
12. Counts 0, 17 and 25 skipped unchanged; a valid draft article's existing batch
    was included; all ledger records were preserved.
13. Existing cleanup removed only 121 ledger comments (79 eligible plus 42
    incompatible fixture comments), preserving the genuine comment exactly.
14. Empty ledger preparation/confirmation was safe.

The four-article fixture uses the user-verified counts 19, 18, 18 and 24. It does
not contain production comment IDs or content. No exact production timestamp
preview was generated during this implementation.

## Changed files

Modified:

- `src/components/admin/CommentSimulationTools.tsx` — mounts the separate tool.
- `scripts/test-new-simulation-sql.mjs` — applies migrations in order and runs
  the new database checks plus future-workflow regression.

Added:

- `src/components/admin/ExistingSimulationDates.tsx`
- `src/app/admin/(protected)/simulation-date-actions.ts`
- `src/lib/journal/existing-simulation-dates.ts`
- `supabase/migrations/20261001000200_existing_simulation_dates.sql`
- `scripts/test-existing-simulation-dates.mjs`
- `tests/existing-simulation-dates.test.mjs`
- `docs/existing-simulation-dates.md`
- `docs/existing-simulation-dates-validation.md`

The pre-existing untracked `supabase/scripts/preview-simulation-timestamps.sql`
was left untouched and is not used by the feature. No existing future-publication
component, service, action, scheduler, migration or dataset was modified.

## Pending production steps

Stop for separate approval. The new migration is pending production application.
After separately authorized migration/deployment, an administrator must generate
and review the complete live preview, then explicitly confirm it. Implementation
approval does not authorize any of those production actions.
