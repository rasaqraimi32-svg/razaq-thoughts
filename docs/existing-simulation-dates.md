# Existing simulation date redistribution

This separate administrator tool changes only `comments.created_at` for IDs in
`journal_private.comment_simulation_entries`. It includes every existing batch,
including batches whose articles are no longer published. It does not generate,
insert, delete or rewrite comments, or change the future-publication workflow.

## Production boundary

Implementation and local testing are authorized. Production migration application,
production preview preparation, timestamp confirmation, commit, push and deployment
are **not** authorized by that approval. No production data was modified during
implementation. The migration remains pending:

`supabase/migrations/20261001000200_existing_simulation_dates.sql`

This migration only creates private preview storage and guarded functions. It does
not execute a timestamp update. Apply only after separate approval, following the
existing migrations. Deploying code does not automatically apply this migration.

The user verified these production counts; local fixtures reproduce the counts,
not the production comment identities or content:

| Article | Count | Planned daily totals |
| --- | ---: | --- |
| Perhaps Sustainability Needs a Different Story | 19 | Five days of 3; one randomly chosen day of 4 |
| What Do We Miss When We Study Plants Without Studying People? | 18 | Six days of 3 |
| What If the Land Is Also a Teacher? | 18 | Six days of 3 |
| Whose Knowledge, Whose Terms? | 24 | Six days of 4 |

Total: 79. The tool always re-reads the private ledger; these counts are not hardcoded.

## Administrator flow

Admin → Comments → Simulation Tools → Randomize Existing Simulation Dates →
Preview existing simulation dates.

Preparation does not update comments. It stores an administrator-bound preview in
the private schema, valid for 24 hours. The UI renders every eligible article's
count, all six daily totals, and every comment's existing ID, name, full content,
current UTC timestamp (including database microseconds), and exact planned UTC
timestamp. No comments are hidden behind pagination. Incompatible counts are
clearly marked as skipped; a preview with no eligible comments cannot be confirmed
through the UI. Emails remain private and are not sent in preview responses.

After reviewing the full dataset, the administrator chooses **Confirm these exact
timestamps**, then confirms the browser dialog. Confirmation sends only the stored
preview UUID and explicit confirmation. It does not accept client-supplied dates or
regenerate timestamps. Cancel discards the displayed preview without comment updates.
If the connection fails during confirmation, the UI reports the uncertain outcome
and clears the preview; prepare again rather than assuming the transaction failed.

## Timestamp algorithm

1. Count ledger-linked comments separately for every existing simulation batch.
2. Skip counts outside 18–24 without modifying that article's comments or ledger.
3. Use six UTC dates: September 25 through September 30, 2026.
4. Assign three comments to each date. Randomly choose `count - 18` distinct dates
   to receive the fourth comment.
5. Split each day's 07:00–22:00 UTC interval into three or four equal, disjoint slots.
   Choose a random millisecond inside each slot. These slots provide varied morning,
   afternoon and evening times. Retry any collision with an already planned timestamp
   or any current comment timestamp, including genuine comments.
6. Read comments in ascending existing `created_at`, then UUID order for ties.
   Assign the ascending planned timestamps to that exact order.

All plans use PostgreSQL's UTC timezone and database-side randomness; no external
generation service or dependency is used. This fixed historical date operation is
independent of the future-publication scheduler and its publication-date boundaries.

## Transaction and preservation

Both RPCs require `journal_private.is_admin()` and use the existing transaction
advisory lock `(193576483, 3001)`. Server actions independently call `requireAdmin()`.
The private preview table has RLS enabled and no direct anonymous/authenticated
grants. Public execution is revoked; authenticated execution still requires admin
authorization inside the functions. Existing comment column grants and policies
are unchanged. Security-definer functions have an empty search path.

Confirmation locks its preview, requires the same administrator and an unused,
unexpired preview, and compares the full current simulation snapshot to its stored
source. This includes all batch fields, entry fields, full simulated comment rows,
and article titles. Changed timestamps, content, membership, batches, missing IDs
or ownership invalidate the preview. It independently checks counts, UTC dates,
daily distribution, ordering and timestamp uniqueness before writing.

The single RPC transaction takes short table locks against concurrent writes to
comments, articles, categories and ledger tables; ordinary reads remain possible.
This also prevents moderation or article deletion from changing the validation
baseline mid-operation. The advisory lock serializes this operation with existing
seeding and cleanup. Competing previews prepared against the same source cannot
both apply: after the first commits, the second is stale.

The UPDATE joins comment ID and article ownership through the ledger, and assigns
only `created_at`. Each update must affect exactly one row. Before committing,
full comparisons verify the exact expected simulated rows and unchanged ledger,
genuine rows, articles and categories. Any mismatch or database error rolls back
all updates, including preview consumption. Successful confirmation consumes the
preview atomically. Existing cleanup continues to use the original ledger.

## Local validation

See `existing-simulation-dates-validation.md` for commands and results. Database
tests run against disposable local PostgreSQL with Auth/Storage compatibility
fixtures; they do not execute the production operation.
