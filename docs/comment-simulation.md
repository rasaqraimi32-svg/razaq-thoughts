> The new-publication preview workflow supersedes the immediate seed workflow below. See [new-comment-simulation.md](new-comment-simulation.md) for current preparation, timing, migration and validation instructions. The remainder documents the original implementation.

# Comment simulation

This implementation is local and has not been deployed. The migration has only been applied to disposable local test databases. No production comments were inserted, approved, changed or deleted.

## Source material and generation

A paginated, read-only Supabase export on 2026-09-30 found four published articles. Their complete title, excerpt, category and content were read to prepare 25 unique candidate comments for each article (100 total). See src/lib/journal/comment-simulation-dataset.json and tests/fixtures/simulation-articles.json.

There is no external AI API, paid service, generation dependency, generic shared comment pool, or randomly reassigned cross-article content. The dataset is authored specifically for the current articles. For example, the ethnobotany comments discuss harvesting, participant observation, language and benefit sharing; the land pedagogy comments discuss Kwezens, maple trees, aki and Nanabush; the narrative comments discuss Charm, Genesis, consumption and technical solutions; the authority comments discuss scientizing, Elders, consultation and decision-making power.

At runtime, every published article is discovered using ID-based pagination, including when Supabase caps a response below the requested page size. The operation retrieves full article content, not merely titles. Before seeding, it reads the selected article again and checks a SHA-256 fingerprint of title, excerpt, category and stored content against its own dataset. The database also checks updated_at under a row lock to reject edits between retrieval and insertion.

Each count is independently sampled using node:crypto randomInt(15,26). All eight engagement types have an anchor comment included in every selection; remaining comments and order are randomized within that article's own 25 candidates. Counts can coincide by chance. Given names come from 150 names grouped to produce roughly half Nigerian/other African names and half international names. No name repeats within an article. These groupings guide variety; they do not establish a fictional person's nationality. The database generates unique simulation.<batch UUID>.<ordinal>@example.com addresses and sets status=approved.

New or edited articles fail explicitly until their own freshly prepared dataset and fingerprint are added. This is intentional: without an AI service, an automatic paraphrase or quotation template would not reliably provide substantive engagement with arbitrary new writing. Refresh the read-only export with node --env-file=.env.local scripts/read-simulation-articles.mjs, read the changed articles, then author and review their dedicated comment sets. Do not update a fingerprint without reviewing the comments against the new content.

## Starting the simulation

After a separately approved deployment and migration, sign in through the existing administrator login. Open Admin → Comments → Simulation Tools → Seed Simulated Comments. Confirm the warning that 15–25 fictional comments per published article will appear publicly. No deployment or migration approval is implied by this document.

The browser invokes an authorized Server Action for each discovered article sequentially, so a large operation does not require one long-running server request. Keep the page open. The panel reports found, processed, seeded, skipped and failed articles, each seeded count, total inserted comments and total errors. One failed article does not stop later articles. If a response is interrupted, the outcome may be unknown; reload and retry. The ledger prevents a second insertion when the first request committed.

There is one privately provisioned administrator in the existing schema. Concurrent tabs or requests are handled even though the schema does not permit multiple administrator profiles.

## Ledger and duplicate protection

The migration adds journal_private.comment_simulation_batches and journal_private.comment_simulation_entries. A batch is unique per article. Each entry records the exact comment ID inserted by the simulation, with cascading foreign keys. No existing comments column or public RLS policy changes.

Three narrowly scoped functions check journal_private.is_admin() themselves, in addition to requireAdmin() in each Server Action. They follow the existing guarded SECURITY DEFINER RPC pattern, use an empty search_path, qualify tables, and expose execution only to authenticated callers. This controlled operation needs owner privileges to insert approved rows and write the inaccessible ledger; it grants no general approved-comment insertion privilege to visitors or authenticated users and uses no service-role key.

Seeding and cleanup share a transaction-level advisory lock. The seed function checks the unique article batch inside that lock, validates 15–25 distinct comments and single names, inserts approved comments and records their IDs in one transaction. A competing request waits, then returns skipped. Failure rolls back the article's entire batch. Manual moderation/deletion of simulated comments does not erase the article batch, so rerunning does not refill or duplicate a previously seeded article. Explicit cleanup resets batches and permits reseeding.

## Cleanup

Select Remove Simulated Comments to load an exact count and a token derived from the batch and comment IDs. Select Confirm removal and accept the second confirmation. The database acquires the same lock, rechecks the token and deletes only comments whose IDs exist in the private ledger. A stale preview fails and must be refreshed. An example.com email, matching name, or similar content is never sufficient for deletion.

Cleanup includes simulation comments that have subsequently been moderated, but preserves all genuine comments regardless of their approved/pending/rejected status. It reports removed, remaining and errors. It also clears batch records. No article or category is updated.

## Validation

Run npx tsc --noEmit, node --env-file=.env.local --test tests/*.test.mjs, npm run lint, and npm run build. The environment file enables the existing read-only live database integration checks; without it those tests are skipped.

SQL suites are supabase/tests/schema_security.sql, reviewed_work_security.sql and comment_simulation_security.sql. They must run only on an empty disposable database with all migrations applied. Each suite rolls its fixtures back.

For the Windows local runner, install isolated test tools under ignored node_modules, without changing application dependencies:

    npm install --prefix node_modules/.cache/simulation-postgres --no-save --package-lock=false --ignore-scripts @embedded-postgres/windows-x64@18.4.0-beta.17 pg@8.16.3
    node scripts/test-comment-simulation-sql.mjs

The runner initializes a disposable PostgreSQL instance on 127.0.0.1:55439, applies minimal Supabase Auth/Storage compatibility fixtures plus all application migrations, runs the three SQL suites, exercises two genuinely separate connections with an observed advisory-lock wait, seeds the actual article payloads, cleans them up and stops the server in finally. It never connects to production. Override SIMULATION_TEST_PORT if the port is occupied. PostgreSQL binaries/client paths can be overridden through SIMULATION_POSTGRES_BIN and SIMULATION_PG_MODULE. Test data stays in ignored node_modules/.cache; the server is stopped after testing.

This validates PostgreSQL privileges, functions, transactions and policies. The compatibility fixtures are not a complete hosted Supabase Auth/Storage stack. Local SQL results and randomized per-article counts are recorded in comment-simulation-sql-results.json; these are test counts, not production insertions.

## Considerations

These are fictional discussions and should be presented as a demonstration when shown to others. The existing public comment component is unchanged, so it renders them in the same way as approved comments. The existing moderation page still displays its first 100 records. The simulation inventory and cleanup do not depend on that limit.

The operation needs the migration before its controls can work. It fails closed if the functions are missing. No credentials or administrator passwords have been added. No application dependency, production configuration, article content, category, public submission workflow, URL, SEO, upload flow or rich-text editor was changed.
