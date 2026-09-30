# Implementation and validation report — 2026-09-30

## Outcome

Implemented locally. No commit, push, deployment, production configuration change or production comment mutation was performed. The production database was accessed only for published-article export and existing read-only integration checks. The new migration was applied only to disposable local PostgreSQL databases. Test servers were stopped.

Four currently published articles were retrieved through paginated Supabase reads. Each has 25 individually authored candidate comments, with an article-specific SHA-256 fingerprint. Runtime selection uses independent random counts of 15–25 and always includes all eight engagement types. No external AI service or new application dependency was introduced.

## Exact final validation results

| Check | Result |
| --- | --- |
| npx tsc --noEmit | Exit 0; no diagnostics |
| node --env-file=.env.local --test tests/*.test.mjs | 182 passed; 0 failed; 0 skipped; 0 cancelled |
| Simulation-specific tests within that suite | 15 passed, including real article content matching, count bounds, all engagement types, unique names, pagination, authorization, failure reporting and public rendering |
| Existing live Supabase integration checks | 5 passed; read-only |
| npm run lint | Exit 0; 0 errors; 2 pre-existing unused _form warnings in unchanged comment-actions.ts at lines 75 and 82 |
| npm run build | Exit 0; optimized production build completed, all 6 static pages generated |
| schema_security.sql | Passed on disposable PostgreSQL 18.4 |
| reviewed_work_security.sql | Passed on disposable PostgreSQL 18.4 |
| comment_simulation_security.sql | Passed on disposable PostgreSQL 18.4 |
| Real concurrent duplicate seeding | Two separate connections; second connection observed waiting on advisory lock; one seeded, one skipped; exactly 15 comments |
| Sequential duplicate seeding | Second call returned skipped and zero new rows |
| Cleanup and genuine-comment preservation | Passed: real approved, pending and rejected fixtures unchanged, including a simulation-looking example.com email; stale/unconfirmed cleanup rejected; repeated cleanup safe |
| Approved public visibility / private emails | Passed SQL assertions and existing public article renderer test |
| Actual-article test cleanup | All 85 simulated comments removed; 0 remaining |
| git diff --check | Exit 0; no whitespace errors |

The first focused test run exposed a VM test-harness Error identity mismatch; the harness now shares Error between test contexts. The first SQL run could not find psql in the binary package; the runner now uses an isolated pg client. The next SQL run exposed PostgreSQL 18's RESTRICT error-code change in an existing assertion; it now accepts either foreign_key_violation or restrict_violation. Final reruns passed.

## Randomized counts from the disposable database run

| Article | Comments |
| --- | ---: |
| What Do We Miss When We Study Plants Without Studying People? | 21 |
| What If the Land Is Also a Teacher? | 21 |
| Perhaps Sustainability Needs a Different Story | 24 |
| Whose Knowledge, Whose Terms? | 19 |
| Total | 85 |

These are local test insertions, not production comments. Future runs independently randomize their counts and can legitimately produce equal counts for some articles.

## Files created

- src/app/admin/(protected)/simulation-actions.ts
- src/components/admin/CommentSimulationTools.tsx
- src/lib/journal/comment-simulation.ts
- src/lib/journal/comment-simulation-generator.ts
- src/lib/journal/comment-simulation-dataset.json
- supabase/migrations/20260930000100_comment_simulation.sql
- supabase/tests/comment_simulation_security.sql
- tests/comment-simulation.test.mjs
- tests/fixtures/simulation-articles.json
- scripts/read-simulation-articles.mjs
- scripts/test-comment-simulation-sql.mjs
- scripts/simulation-test-bootstrap.sql
- docs/comment-simulation.md
- docs/comment-simulation-sql-results.json
- docs/comment-simulation-validation.md

## Files modified

- src/app/admin/(protected)/comments/page.tsx — includes the administrator-only simulation controls.
- supabase/tests/schema_security.sql — accepts both PostgreSQL RESTRICT constraint error variants; still requires category deletion to be rejected.

## Database and security changes

The unapplied production migration creates two private provenance tables and three guarded RPCs (snapshot, seed, remove). Both new tables have RLS enabled with no direct API grants. The existing comments schema, existing RLS policies, authentication, and application table grants are unchanged. Each action reauthorizes using the existing administrator system; each function independently checks the same private administrator predicate. The functions follow the existing guarded SECURITY DEFINER pattern to perform their narrow operation and use no service-role credential.

A per-article primary key plus a shared transaction advisory lock prevents concurrent duplicate insertion. Comments and ledger entries commit atomically. Cleanup is authorized separately, confirms a ledger snapshot token, and deletes by recorded comment ID only. Genuine emails/names/content are never used as deletion criteria.

## Operation and limitations

After separately approved migration/deployment, open Admin → Comments → Simulation Tools. Seed Simulated Comments asks for confirmation and reports individual counts, skips and failures. Remove Simulated Comments first previews the exact count, then requires confirmation. The private ledger provides identity; cleanup removes only its IDs and resets batches so explicit reseeding is possible.

New or edited articles require freshly authored article-specific comments and an updated fingerprint. The operation reports these as failures instead of substituting generic content. All four currently published articles are covered. See comment-simulation.md for detailed operation and test reproduction.

SQL checks used a real isolated PostgreSQL server with minimal Supabase Auth/Storage compatibility fixtures, not a complete hosted Supabase environment. Public display was verified through the existing React server renderer and SQL read permissions, not by inserting comments into the live site. A production administrator click-through was intentionally not performed because the migration and application have not been deployed.
