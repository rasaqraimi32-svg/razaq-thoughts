# Front-page image setup and verification

## Apply the new migration

The local app now uses the existing authenticated Supabase client for image uploads. No service-role credential, new environment variable, or article column is required.

Before testing uploads, apply ONLY `supabase/migrations/20260927000100_article_cover_storage.sql` in the existing project's Supabase SQL Editor, or use the normal reviewed migration workflow. Do not rerun the initial schema or reset the database. The migration creates/configures the dedicated article-covers bucket and three narrowly scoped Storage policies. Existing article, comment, profile and category policies are unchanged.

This migration has not been applied remotely from this workspace: the configured publishable key cannot execute DDL. Application tests do not prove remote Storage policies are installed.

## Asset visibility and security

Cover images are public assets: anyone with their URL can view them, including covers associated with drafts or archived articles. Public bucket downloads bypass SELECT RLS; article drafts themselves remain protected by the existing article policies. Do not upload confidential images. Public access does not permit upload, listing, replacement or deletion. Those operations require the profile-backed administrator. See [Supabase public bucket behavior](https://supabase.com/docs/guides/storage/buckets/fundamentals).

Fresh UUID names under article-covers/uploads prevent collisions and cached replacements. Replacements never upsert. Only the administrator can insert or list objects; the delete policy additionally checks that no article references the image. No Storage UPDATE policy is needed. Check the project's existing Storage policies for any unrelated broad policies that could also grant access: PostgreSQL permissive policies combine with OR.

The existing cover_image_url holds a stable public URL, not a signed URL. The Storage path can be recovered only when it matches this project's exact URL, bucket and UUID path format. External legacy cover URLs are preserved, never deleted.

## Limits and processing

The client, server and bucket enforce a 3 MiB file limit. The server checks extension, detected format and supplied MIME, decodes all pixels, rejects corrupt or animated files and inputs above 24 megapixels, and re-encodes the same format without cropping/resizing. Orientation is corrected and metadata removed; output must also fit 3 MiB. Sharp was already installed through Next.js and is now declared as a direct dependency. See [Sharp input validation](https://sharp.pixelplumbing.com/api-constructor/).

The server-action request limit is 4 MiB to allow article text and multipart overhead. Browser upload feedback is indeterminate (validation/upload/save), not a fabricated progress percentage.

## Cleanup and recovery

After saving a replacement/removal, the old managed file is deleted only after checking references across all article statuses. An upload followed by a failed article save is also cleaned up. Cleanup retries transient errors three times; errors are shown, not silently ignored. Article deletion also attempts cleanup.

Storage and Postgres are separate services, so an interrupted process or sustained outage cannot be made atomic. Admin Articles > Image maintenance > Clean up unused images retries unreferenced files older than 24 hours. That grace period protects in-flight uploads. Recently uploaded and referenced images are always retained; scans fail closed on errors. Run this after a reported cleanup failure or interrupted upload. No scheduler or production deployment has been created. Cleanup supports up to 10,000 stored images per scan; larger collections need a maintenance job.

## Local review checklist after migration

1. Open Admin > New Article. Select a JPG/PNG/WebP and check preview/filename. Save a draft, reopen it, and confirm its current image.
2. Publish the temporary test article and verify the actual image on the homepage, featured section and catalogue, without cropping. Confirm the individual reading page still has no cover.
3. Replace the image; verify the record uses the new URL and the previous unreferenced object is gone from Storage. Remove it and check the neutral public placeholder.
4. Try invalid, oversized and corrupt files. Confirm clear errors and unchanged article data.
5. Confirm anonymous and ordinary authenticated clients cannot insert/update/delete/list objects. Verify public image downloads succeed. Use a disposable local Supabase instance for write/security fixtures, never production article data.
6. Simulate a save failure after upload in the test suite; check that the new object is removed and the original retained. Simulate cleanup failure and retry through Image maintenance.

Automated checks: TypeScript, Node test suite (including real Sharp decoding and mocked Storage lifecycle), ESLint, production build. Existing live integration tests are read-only and cover article RLS; they do not validate the new remote bucket.
