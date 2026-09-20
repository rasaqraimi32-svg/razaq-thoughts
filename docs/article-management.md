# Article management implementation status

The administrator dashboard, article CRUD forms, category CRUD forms, validation, server authorization, and database query layer are implemented. Authentication is reused without changes. No comment UI or moderation implementation was added.

## Required deployment step

Apply supabase/migrations/20260920000200_restrict_category_deletion.sql in the Supabase SQL Editor. The migration changes the existing article/category foreign key from SET NULL to RESTRICT, so a referenced category cannot be deleted even during concurrent writes. It preserves data, grants and RLS policies. Remote application has not yet been confirmed.

## Public transition

Public pages still use the original mock data. The database-backed public queries are implemented; the page/component integration is prepared but is intentionally not active until the required database workflow checks pass. No mock articles were inserted and src/lib/mock-data.ts was not modified or deleted.

## Server behavior

- Every mutation re-verifies the Auth identity and profiles.role through the existing authenticated server client. No service-role key is used and RLS remains enforced.
- Article create/update validates required text, status, category, reading time, URL-safe slug and optional HTTPS cover image URL. Category existence is checked before writing.
- Generated slugs retry with numeric suffixes when the unique index rejects a collision. Manually edited duplicate slugs return an error.
- Editing updates by article UUID and the original updated_at value. Stale edits are rejected; update never falls back to insert.
- The existing database trigger maintains updated_at and the first published_at. Switching a published article back to draft preserves its historical publication date.
- Deletions require confirmation. The article form warns that associated comments are also deleted by the existing cascade.
- Category deletion checks article usage and handles the RESTRICT foreign-key error. Apply the migration before using it.
- Public query helpers explicitly filter status = published, including when the caller is the administrator.

## Validation so far

- npm run lint: passed.
- npx tsc --noEmit --incremental false: passed.
- node --test tests/admin-auth.test.mjs tests/article-management.test.mjs: 50 passed (includes 23 existing authorization tests). Database behavior in these tests uses an in-memory test double; this is not remote SQL verification.
- Read-only remote checks via node --env-file=.env.local --test tests/public-database.integration.test.mjs could not complete successfully because the execution environment denies network access (EACCES). Do not count these as passed.
- supabase/tests/schema_security.sql was updated for RESTRICT semantics but not executed. Run it only on a fresh disposable Supabase database after both migrations.
- Live administrator CRUD, publication, category management and public visibility remain to be verified using the signed-in browser before activating the prepared public integration.

## Files created in this step

- src/app/admin/(protected)/article-actions.ts
- src/app/admin/(protected)/articles/new/page.tsx
- src/app/admin/(protected)/articles/page.tsx
- src/app/admin/(protected)/articles/[id]/edit/page.tsx
- src/app/admin/(protected)/categories/page.tsx
- src/app/admin/(protected)/loading.tsx
- src/app/admin/(protected)/not-found.tsx
- src/components/admin/ArticleForm.tsx
- src/components/admin/CategoryForm.tsx
- src/components/admin/ContentEditor.tsx
- src/components/admin/DeleteForm.tsx
- src/components/admin/FormFeedback.tsx
- src/lib/journal/mutations.ts
- src/lib/journal/public-queries.ts
- src/lib/journal/queries.ts
- src/lib/journal/types.ts
- src/lib/journal/validation.ts
- supabase/migrations/20260920000200_restrict_category_deletion.sql
- tests/article-management.test.mjs
- tests/public-database.integration.test.mjs
- docs/article-management.md

## Files modified in this step

- src/app/admin/(protected)/layout.tsx
- src/app/admin/(protected)/page.tsx
- src/app/admin/admin.module.css
- supabase/README.md
- supabase/tests/schema_security.sql
