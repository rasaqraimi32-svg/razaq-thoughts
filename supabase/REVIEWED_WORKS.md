# Phase 3: reviewed-work PDFs

## Apply manually before testing uploads

Apply only `supabase/migrations/20260928000100_article_reviewed_works.sql` to the existing Supabase project. Do not rerun earlier schema migrations or reset your database. The Phase 2 cover-image migration remains separate and unchanged.

The migration creates:

- `article_reviewed_works`: id, article_id, title, author_name, pdf_storage_path, pdf_original_filename, created_at, updated_at.
- One reviewed work per article via UNIQUE(article_id), with a cascading FK to articles.
- A private `article-reviewed-pdfs` bucket, restricted to application/pdf and 3 MiB.
- Five table RLS policies: published-only public reads and administrator read/insert/update/delete.
- Storage policies for published-only reads, administrator upload/read and deletion of unreferenced PDFs. Restrictive guards prevent unrelated broad Storage policies from exposing unpublished PDFs or granting unauthorized writes. Overwriting is prohibited: replacements use new paths.
- An administrator-only RPC listing up to 100 unused PDF paths older than 24 hours for recovery cleanup.

No article columns, existing article/comment/auth RLS, cover policies, or environment variables are changed. No service-role key is used. No remote migration was applied by this task.

## Security and file delivery

Every mutation verifies the existing profile-backed administrator. Storage enforces the same authorization independently. Paths are `{article-id}/{random-UUID}.pdf`. The database stores the stable path and a sanitized original filename, never a signed URL.

Public metadata and file access require the parent article to be published. View/Download link to `/articles/{slug}/reviewed-work` (download adds `?download=1`). The handler uses an anonymous Supabase client even for logged-in admins, verifies publication, downloads through Storage RLS and returns application/pdf with inline/attachment Content-Disposition. It preserves original PDF bytes and a safe Unicode download filename. Responses use no-store and nosniff. No expiring bearer link or public bucket is used. Unpublishing denies future reads; it cannot revoke copies readers already downloaded.

Reference: [Supabase Storage access control](https://supabase.com/docs/guides/storage/security/access-control).

## Validation and form workflow

PDFs are limited to 3 MiB. Extension, supplied MIME, PDF header/version and EOF signature are checked both during browser preflight and in the authorized server mutation. Validation does not re-encode the PDF. This is format/signature validation, not malware scanning or complete PDF conformance analysis. Only distribute works you have the right or permission to make available.

The existing article editor and image upload stay in place. The optional Work Under Review fieldset clearly labels the original title, original author and PDF, with filename, selected file size, replacement/removal controls and progress messages.

Article+cover and PDF are sent in separate requests under the existing 4 MiB server-action body limit. Creation saves the article first, then uploads under its returned ID and inserts the reviewed-work row. Invalid files are rejected before the article request when detectable in the browser; server validation remains authoritative.

If the article saves but the PDF step fails, the form reports the saved article and links to its edit page. The old form is disabled to prevent a duplicate create or stale resubmission. Reopen that saved article to retry. Existing reviewed works use updated_at checks to reject concurrent overwrites.

## Replacement, removal and recovery

Replacement uploads new bytes, conditionally updates the row, then deletes the old unreferenced file. Failed saves clean up the new upload where safe. Removal deletes the bibliographic reference first, immediately ending public read access, then deletes bytes. Article deletion cascades the bibliographic row and attempts Storage cleanup while retaining the existing cover cleanup.

Database and Storage are separate services; a process interruption or persistent outage can leave an unreferenced private object. Cleanup errors are surfaced. Admin Articles > PDF maintenance > Clean up unused PDFs retries objects older than 24 hours; referenced and recent files are preserved. Each request processes up to 100 candidates; repeat if instructed. No scheduler was created.

Before the migration is installed (or if attachment reads fail), the PDF form section is disabled with a clear message. Articles and front-page images can still be saved. The optional public section is omitted on missing attachments or attachment-service failure, so article content, sharing and comments remain available.

## Verification

Application checks for this phase: TypeScript; complete Node test suite; production build; ESLint. PDF tests exercise signature/type/size validation, create/retrieve/replace/remove, stale versions, unauthorized callers, cleanup failures, partial saves, published vs draft/archived access, original bytes and filenames, and public rendering. Existing cover-image, authentication, comments, SEO and sitemap tests remain intact.

`supabase/tests/reviewed_work_security.sql` is a rolled-back SQL policy regression for a fresh disposable local Supabase database only. It checks anonymous/non-admin/admin permissions, one-work uniqueness, unpublished access, overwrite prevention, unreferenced deletion and cascade behavior, including a temporary broad permissive Storage policy. Run with `psql -X -v ON_ERROR_STOP=1 -f supabase/tests/reviewed_work_security.sql` after all migrations. It was not executed here because this workspace has no psql, Supabase CLI or disposable database. Mocked application tests are not a substitute for that policy verification.

After manual migration, test locally: attach to a draft; confirm its public PDF route is denied; publish and use View/Download; replace and confirm old bytes removed; remove and confirm no empty section; unpublish and confirm direct Storage/public-route reads are denied. Check desktop/mobile presentation and filename behavior using an actual permitted PDF. Do not test destructive fixtures against production data.

## Phase 3 file inventory

New:
- supabase/migrations/20260928000100_article_reviewed_works.sql
- supabase/tests/reviewed_work_security.sql
- supabase/REVIEWED_WORKS.md
- src/lib/journal/reviewed-work.ts
- src/lib/journal/reviewed-work-queries.ts
- src/lib/journal/reviewed-work-mutations.ts
- src/lib/journal/reviewed-work-storage.ts
- src/lib/journal/reviewed-work-submit.ts
- src/lib/journal/reviewed-work-download.ts
- src/app/admin/(protected)/reviewed-work-actions.ts
- src/app/articles/[slug]/reviewed-work/route.ts
- src/components/ReviewedWork.tsx
- src/components/admin/ReviewedWorkFields.tsx
- src/components/admin/PdfCleanupForm.tsx
- tests/reviewed-works.test.mjs

Updated:
- src/components/admin/ArticleForm.tsx
- src/app/admin/(protected)/article-actions.ts
- src/app/admin/(protected)/articles/page.tsx
- src/app/admin/(protected)/articles/new/page.tsx
- src/app/admin/(protected)/articles/[id]/edit/page.tsx
- src/app/articles/[slug]/page.tsx
- src/app/admin/admin.module.css
- src/app/globals.css (reviewed-work styles only)
- tests/article-management.test.mjs (deletion mock follows new wrapper; existing assertions retained)
- tests/public-articles.test.mjs

Earlier uncommitted Phase 1/2 changes remain in the working tree and are not part of this inventory.
