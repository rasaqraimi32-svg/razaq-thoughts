# Journal database migrations

## Scope and current state

The schema is defined in `migrations/20260920000100_create_journal_schema.sql`. It creates four application tables, six categories, indexes, timestamp handling, grants, and Row Level Security policies in one transaction. It does not create an Auth user, seed articles, or change the Next.js application.

The user has confirmed the initial schema and sole administrator profile are deployed and verified. The application uses the URL and publishable key; these cannot execute database DDL. The additional `20260920000200_restrict_category_deletion.sql` migration must be applied before using category deletion. Its application is verified separately from application tests.

The existing Next.js Supabase clients are reused by server-side article and category management. Never add a database password or service-role key to a `NEXT_PUBLIC_` variable.

## Tables and indexes

| Table | Purpose | Indexes |
| --- | --- | --- |
| categories | Public subject list | Primary key; unique name; unique slug |
| articles | Draft, published, and archived writing | Primary key; unique slug; status; category_id; published_at DESC |
| comments | Moderated discussion and private contact email | Primary key; article_id; status; created_at DESC |
| profiles | One administrator linked to auth.users | Primary key; unique role |

The profile role is non-null and restricted to `admin`. The unique role index enforces **at most one** administrator, even for concurrent privileged inserts. The initial state contains no profile and therefore grants no application administrator access.

After the category-protection migration, deleting a category referenced by any article is rejected. Delete only unused categories. Deleting an article deletes its comments. Deleting the administrator's Auth user deletes the profile and removes their application administration powers.

Article updates refresh `updated_at`. Publishing fills `published_at` when it is absent; archiving preserves that historical date. The public visibility rule is exactly `status = 'published'`; publication dates do not implement scheduled publishing.

## Access rules

RLS is enabled on every application table. Table and column grants are explicitly reset instead of relying on Supabase defaults.

- Categories: anyone can read; only the profile-backed admin can insert, update, or delete.
- Articles: anyone can read published articles; only the admin can read drafts/archives or perform writes.
- Comments: anyone can read approved comments on published articles and submit new pending comments to published articles. Only the admin can read all statuses, moderate, or delete.
- Profiles: only the administrator can read their own profile. API clients cannot insert, update, or delete profiles, including the administrator's client. Signup metadata is never used to assign roles.

The 15 policies are:

- `categories_public_read`, `categories_admin_insert`, `categories_admin_update`, `categories_admin_delete`.
- `articles_public_read`, `articles_admin_read`, `articles_admin_insert`, `articles_admin_update`, `articles_admin_delete`.
- `comments_public_read`, `comments_public_insert`, `comments_admin_read`, `comments_admin_update`, `comments_admin_delete`.
- `profiles_admin_read_own`.

`journal_private.is_admin()` checks the signed-in Auth ID against the profile, with a fixed empty search path. The private schema must not be added to the Supabase Data API's exposed schemas. The helper is callable only by the authenticated role and returns only whether the caller is the administrator.

The trusted database owner and Supabase service role retain administrative database access. They are not public application users; no such credential is used or added by this migration.

## Future comment integration

RLS protects rows but does not hide email columns. Both public API roles receive SELECT only on `id, article_id, name, content, status, created_at`. Public comment queries must explicitly select those fields, rather than `select('*')`. Filtering or ordering by private email is also unavailable to those roles.

Submit only `article_id, name, email, content`. Do not send `status`, `id`, or `created_at`; defaults supply them. Do not append `.select()` to a public insert, since the pending record is deliberately not publicly readable.

For full administrator moderation records, call `supabase.rpc('get_admin_comments', { p_limit: 50, p_offset: 0 })` with the administrator's authenticated client. The function checks the profile before returning any data, includes private emails, and limits each page to 100 records. Ordinary authenticated users receive permission denied. Admin moderation uses a status-only update or deletion on the comments table; RLS checks the administrator in either case.

Database checks reject blank required text and invalid statuses. Full field validation, rate limiting, and spam prevention belong to the later comment application layer. This migration adds no comment UI or backend handler.

## Applying reproducibly

When the official Supabase CLI and the project's privileged operator access are available:

1. Confirm the intended project and review its existing schema and migration history. This is an initial application migration: it deliberately fails if these tables or helper names already exist, rather than replacing data or silently accepting a different schema. Reconcile existing remote changes into source-controlled migrations first if needed.
2. Authenticate the CLI and link the intended project using its actual project reference. `config.toml` contains only a local project identifier, not remote credentials.
3. Review and apply:

```sh
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase migration list
supabase db push --dry-run
supabase db push
supabase migration list
supabase db lint --linked
```

The final migration listing must show both `20260920000100` and `20260920000200` applied remotely. When applying manually in the SQL Editor, execute the complete new migration in one run; do not rerun the initial schema migration. Inspect the four tables, their RLS policies and grants, and the six category rows before considering deployment verified. Do not use `db reset` against production. Keep all migrations and any future schema changes in source control; do not substitute undocumented dashboard edits.

Reference: [Supabase migration workflow](https://supabase.com/docs/guides/deployment/database-migrations).

## Provisioning the sole administrator later

No administrator is automatically created. After the intended Auth user exists, a trusted database operator can run the checked-in provisioning script. The Auth UUID must be supplied explicitly; the script neither creates a login nor derives privileges from public signup data.

With a privately configured PostgreSQL connection, run:

```sh
psql -X -v ON_ERROR_STOP=1 -v admin_user_id=YOUR_AUTH_USER_UUID -v admin_display_name="Your display name" -f supabase/scripts/provision-admin.sql
```

The script safely quotes psql variables, verifies user existence through the foreign key, and can be rerun for the same user to update their display name. A different existing administrator causes a unique-constraint failure; the script does not transfer the role. No browser API can run this operation.

## SQL regression validation

`tests/schema_security.sql` exercises anonymous, ordinary authenticated, and administrator access with temporary fixtures inside a rolled-back transaction. It covers profile self-promotion, fabricated role metadata, a second administrator, private email, unpublished articles, comment moderation, timestamps, deletion cascades, and removal of administrator access.

**Run only on a fresh disposable local Supabase database after applying both migrations.** The test refuses to run if article, comment, or profile records already exist. It creates no permanent fixtures and requires only PostgreSQL/PLpgSQL, not extra testing packages.

```sh
psql -X -v ON_ERROR_STOP=1 -f supabase/tests/schema_security.sql
```

Configure psql's connection privately for that local database first (for example through standard PG environment variables). A zero exit status with every assertion completed and the final rollback reached is a pass. These SQL tests have not been executed in the current environment.
