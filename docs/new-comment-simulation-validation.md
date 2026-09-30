# New-publication simulation — implementation and validation

## Scope

Implemented locally on main. No commit, push, deployment, production migration application or production mutation was performed. All production integration requests were the existing read-only test queries. New SQL was applied only to disposable local PostgreSQL databases, whose servers were stopped after testing.

Existing four article-specific datasets are unchanged. Existing production batches/comments were not read through privileged credentials or mutated. The old retimestamping preview is superseded and was not executed or edited.

## A. Files changed

Modified (6):

- docs/comment-simulation.md — points to the new workflow while retaining original documentation.
- scripts/test-comment-simulation-sql.mjs — compatibility entry point for the expanded SQL runner.
- src/app/admin/(protected)/simulation-actions.ts — authenticated inspection, preparation and confirmation actions.
- src/components/admin/CommentSimulationTools.tsx — new seed workflow, preserved independent cleanup.
- src/lib/journal/comment-simulation-generator.ts — reuses name allocation/shuffling and accepts publication metadata.
- src/lib/journal/comment-simulation.ts — retrieves published_at.

Created (10):

- docs/new-comment-simulation.md
- docs/new-comment-simulation-validation.md
- scripts/test-new-simulation-concurrency.mjs
- scripts/test-new-simulation-sql.mjs
- src/components/admin/NewSimulationWorkflow.tsx
- src/lib/journal/new-comment-simulation.ts
- src/lib/journal/simulation-plan.ts
- supabase/migrations/20261001000100_new_simulation_previews.sql
- supabase/tests/new_simulation_security.sql
- tests/new-comment-simulation.test.mjs

Pre-existing untracked file outside this change: supabase/scripts/preview-simulation-timestamps.sql. It remains unused and is not part of the new feature.

## B. New migration

20261001000100_new_simulation_previews.sql adds a private, RLS-enabled preview table with no direct API grants, private source/schedule helpers, and authenticated prepare/confirm RPCs. It retires unpreviewed new insertion through the old RPC while retaining its already-seeded skip behavior. Existing comment table columns, policies, grants, batch/entry tables, and cleanup function are unchanged. There is no retroactive comment UPDATE or retimestamping statement.

## C. Exact timestamp algorithm

Independently sample 15–25 comments. Use 4 UTC days for 15–16, 5 for 17, 6 for 18–24, and 7 for 25, beginning on the publication date. Assign three per day and randomly choose count minus three times days distinct days for a fourth.

Prefer 07:00–22:00 UTC, clipped by publication and captured current time; use the remaining valid daily interval for late publications/short elapsed days. Select one random millisecond in each of three/four disjoint daily windows. Round sub-millisecond publication precision upward. Stop before preview persistence when insufficient days or time exist. Do not create a partial batch or future timestamps. PostgreSQL repeats the validation and rejects collisions with existing timestamps at confirmation instead of changing the preview.

## D. Article-specific preparation

An administrator reads the displayed title, excerpt, category and complete readable article, then authors/pastes 25 distinct candidate comments in the article's JSON template, marking eight engagement anchors. The fingerprint binds that dataset to the source. No generic cross-article pool or external generation API is involved. Editorial relevance requires human preparation/review; a fingerprint proves source identity, not semantic quality.

The app selects 15–25 candidates including every engagement type, assigns distinct one-part names from the existing 150-name pool with approximately half African-group names, and creates the UTC schedule. Existing static datasets are reused only for matching unseeded sources; already-seeded articles bypass preparation entirely.

## E. Admin preview

Admin → Comments → Simulation Tools → Seed New Published Articles → read source/prepare dataset → Prepare detailed preview → review every selected name, full comment, exact UTC date/time → Confirm this exact batch.

The exact selected payload is stored privately for 24 hours. Confirmation sends only its ID plus explicit confirmation; it cannot replace or regenerate preview content. Database source fingerprint, publication status, author identity, validity and unused/expiry state are rechecked. New emails use example.com and statuses are approved. Preview consumption and the complete insertion commit together.

## F. Existing-batch protection

The ledger is authoritative. Existing article IDs return Already simulated before generation; database operations check again inside the original advisory transaction lock. The unique article batch key remains. No existing batch/comment updates occur. The original cleanup mechanism is preserved but never invoked by preparation/seeding. Explicit cleanup cannot make a consumed preview reusable.

## G. Exact final results

| Check | Result |
| --- | --- |
| npx tsc --noEmit | Exit 0; no diagnostics |
| node --env-file=.env.local --test tests/*.test.mjs | 208 passed, 0 failed, 0 skipped, 0 cancelled |
| New workflow tests | 26 passed, included in the complete suite |
| Original simulation tests | 15 passed, included in the complete suite |
| Existing read-only live Supabase integration checks | 5 passed, included in the complete suite |
| npm run lint | Exit 0; 0 errors; only 2 pre-existing unused _form warnings in unchanged comment-actions.ts lines 75 and 82 |
| npm run build | Exit 0; optimized production compilation and TypeScript passed; 6 static pages generated |
| schema_security.sql | Passed under the historical contract before the new migration |
| reviewed_work_security.sql | Passed under the historical contract before the new migration |
| comment_simulation_security.sql | Passed under the historical contract before the new migration |
| new_simulation_security.sql | Passed after applying the new migration to the disposable database |
| Real two-session confirmation | Advisory-lock wait observed; one seeded, one skipped; exactly 18 rows identical to stored preview |
| Injected mid-batch insertion failure | All attempted comments, batch/ledger insertion and preview consumption rolled back |
| Changed and expired preview checks | Rejected without inserting comments |
| Replay after explicit cleanup | Consumed preview rejected |
| Existing comments, timestamps, ledger records, articles and categories | Preservation assertions passed during new preparation/confirmation |
| Cleanup safety | Removed only ledger comments; genuine rows unchanged |
| git diff --check | Exit 0; no whitespace errors |

During development, a generator refactor type error, a test regex escaping error, a PL/pgSQL alias ambiguity and test-only SQL delimiter escaping were found and corrected. All reported results above are final successful runs.

SQL checks used real PostgreSQL 18.4 with minimal Supabase Auth/Storage compatibility fixtures, not a hosted Supabase environment. UI completeness was verified through React server rendering; no production administrator click-through or seed was performed.

## H. Remaining production steps

Await explicit approval before any commit, push, migration application or deployment. Production will then require the new migration and the application update. Neither step automatically inserts comments. An administrator must prepare each new article's dataset, wait for enough elapsed time, review its full preview and explicitly confirm. Existing batches should remain Already simulated.

Unconfirmed/consumed previews remain private metadata; expiry prevents their use, but no automatic metadata-retention deletion was added. See new-comment-simulation.md for detailed operation and reproduction commands.
