# New-publication simulation workflow

## Scope and production boundary

This feature applies only to articles without a record in journal_private.comment_simulation_batches. Existing batches are never treated as stale or eligible for regeneration, even when the article has changed. Existing comments, timestamps, statuses, names, emails, article IDs and ledger rows are not modified by discovery, preparation or confirmation.

The superseded retimestamping preview is not used. No scheduled simulation or automatic publication hook is installed. The administrator starts each run and confirms each article after review. Cleanup remains a separate, explicit destructive operation with its original preview/confirmation protections; it is never called by the new workflow.

## Preparing article-specific content

Open Admin → Comments → Simulation Tools → Seed New Published Articles. The application paginates through all published articles and compares their IDs against the private batch ledger. Existing batches show Already simulated and have no preparation controls.

For an unseeded article, expand Read article and prepare its dataset. The panel shows its title, excerpt, category, full readable content, publication time, and a JSON template bound to a SHA-256 fingerprint of title, excerpt, category and original stored content. Read the article and author 25 distinct candidate comments engaging its actual arguments and examples. Paste those strings into comments and set eight distinct engagementAnchors indexes (0–24): agreement, disagreement, question, observation, reflection, clarification, connection and alternative.

The fingerprint is supplied by the application; keep it unchanged. If the article changes, inspect again and review/reprepare the comments rather than merely copying the new fingerprint. A matching fingerprint establishes which source was used; semantic relevance is an editorial responsibility verified by the administrator's review, not something a hash can prove.

No shared generic comment pool, external AI API, paid generation service or new application dependency is used. The original four datasets remain unchanged. Prepared source-specific datasets can be reused for an unseeded article only when their source fingerprint still matches.

Example structure (the comments array must contain 25 actual, distinct comments, not placeholders):

    {
      "fingerprint": "copy the supplied article fingerprint",
      "comments": ["An individually written response to this article..."],
      "engagementAnchors": {
        "agreement": 0, "disagreement": 1, "question": 2, "observation": 3,
        "reflection": 4, "clarification": 5, "connection": 6, "alternative": 7
      }
    }

## Selection and exact UTC scheduling

Preparing a preview independently samples a count from 15 through 25 using node:crypto. It includes all eight engagement anchors and randomly selects additional candidates from that article's own dataset. The existing pool of 150 given names supplies approximately half Nigerian/other African names and half international names, with all five name groups represented and no repeated name per article.

The day count is fixed by the chosen comment count:

| Comments | Consecutive UTC days |
| --- | --- |
| 15–16 | 4 |
| 17 | 5 |
| 18–24 | 6 |
| 25 | 7 |

The first day is the UTC calendar date of published_at. Each day receives three comments; count minus three times days distinct days are randomly selected to receive a fourth. Thus every selected day has exactly three or four comments and the sum equals the selected count.

Within each day the planner prefers 07:00–22:00 UTC, clipped to the exact publication timestamp and the server time captured when preparing. If publication occurs late at night or the current day has only a narrow elapsed interval, it uses the remaining valid part of that UTC day. The interval is split into three or four disjoint windows, with one random millisecond selected in each. This gives varied times without duplicates. PostgreSQL publication timestamps with microseconds are rounded upward to the next representable millisecond when necessary, never backward.

Missing/future publication times, insufficient calendar days, or insufficient milliseconds on a boundary day fail before a preview is stored or any comment is inserted. There is no partial batch and no future schedule. A re-preparation is a new random draw and must be reviewed again. Existing previews are never silently adjusted.

The database independently verifies publication bounds, current time, count, consecutive day range, three/four-per-day distribution, single names, distinct names/content and distinct times. At confirmation it also rejects a timestamp collision with any existing comment; the administrator must prepare and review a new preview in that rare case. It does not alter timestamps to resolve a collision.

## Full preview and confirmation

Prepare detailed preview displays every selected comment, its assigned name, and its exact UTC date/time including milliseconds. The administrator can scroll through the entire selected batch. Editing the dataset discards the displayed preview; a new preparation is required. Nothing is inserted into comments during preview.

The database stores the selected comments and schedule in a new private table, journal_private.comment_simulation_previews, scoped to the authenticated administrator and bound to a database-derived source fingerprint. Previews expire after 24 hours. Confirmation sends only the stored preview UUID and explicit confirmation, never a replacement payload. The database reads that immutable stored payload, checks source freshness and publication state, and inserts those exact values.

Emails are generated at insertion as simulation.<batch UUID>.<ordinal>@example.com, and status is always approved. Article IDs come from the stored preview, not from a replacement client payload. Preview metadata marks consumption in the same transaction. Replays skip an existing batch; consumed previews cannot recreate one after explicit cleanup.

The page reports published articles, already simulated articles, newly seeded articles, skipped/not-yet-eligible articles, failures and total comments created. Each article has its own preview and confirmation, so failure of one does not prevent preparation of another. Interrupted confirmation can have an unknown outcome; inspect again before retrying. The ledger protects against duplicates.

## Database migration and security

New migration: supabase/migrations/20261001000100_new_simulation_previews.sql.

It creates the inaccessible preview table, private source/schedule validation helpers, and two authenticated RPCs: prepare_new_comment_simulation and confirm_new_comment_simulation. Every RPC independently verifies the existing journal_private.is_admin() predicate. Every Server Action also calls requireAdmin(). Existing public comments columns and existing RLS policies/grants remain unchanged; the preview table has RLS enabled and no direct API grants. No service-role credential is introduced.

The existing advisory transaction lock (193576483, 3001) and unique per-article batch key are preserved. Confirmation rechecks for an existing batch inside the lock before any insertion, then locks the source article/category and rejects changes since preview. Batch, comment and ledger insertion plus preview consumption are one atomic transaction.

The former seed_comment_simulation entry point becomes a guarded compatibility function: existing batches return skipped, while unseeded requests require the new preview workflow. This prevents an old client from inserting a new batch with the former immediate timestamps. Cleanup and the original snapshot RPC are unchanged. The old Seed Simulated Comments button is renamed/replaced by Seed New Published Articles.

This migration contains no retroactive UPDATE of comments or existing ledger rows. Preview metadata updates happen only when a new preview is consumed. No migration has been applied to production during this task. The migration has been exercised only in disposable local PostgreSQL tests.

## Validation and later production steps

Run npx tsc --noEmit, node --env-file=.env.local --test tests/*.test.mjs, npm run lint, npm run build and node scripts/test-new-simulation-sql.mjs. The existing node scripts/test-comment-simulation-sql.mjs command forwards to the new SQL runner.

The isolated PostgreSQL runner first executes the three historical security suites before the new migration, then applies the new migration and runs new_simulation_security.sql and real two-session confirmation/rollback checks. Auth and Storage are minimal compatibility fixtures, not the hosted Supabase services. It stops its local server and never connects to production. Existing application tests include their read-only live integration checks when .env.local is supplied.

After explicit approval, production still needs the new migration and application deployment. Applying the migration does not seed anything. Then the administrator can inspect new articles, prepare their dedicated datasets, wait for sufficient elapsed days, review all comments/times, and confirm individual batches. The four existing production batches must remain untouched.

Unconfirmed previews expire but remain private metadata; no automatic data-retention cleanup was added. The original read-only retimestamping preview remains an untracked artifact from the superseded task and is outside this feature.
