# The Insight Journal

A public article and discussion website built with Next.js 16.3.5, React 19, TypeScript and Tailwind CSS 4.

## Run locally

Use the existing installed dependencies:

```sh
npm run dev
```

Open http://localhost:3000.

## Validation

```sh
npm run lint
npx tsc --noEmit --incremental false
```

On a clean checkout without generated Next.js route types, run `npx next typegen` before the TypeScript check. An optional production check is `npm run build`.

## Public routes

- `/` — homepage, featured article, latest reading, categories and mission
- `/articles` — all eight sample articles
- `/articles/[slug]` — complete article, sharing, related reading and discussion placeholder
- `/about` — mission and editorial approach
- `/contact` — contact form preview
- Unknown pages and article slugs display the custom 404 page.

Example article: `/articles/the-art-of-paying-attention`.

## Organization

- `src/app`: routes, metadata, global layout and responsive styles
- `src/components`: navigation, article cards and artwork, metadata, category UI, sharing and form components
- `src/lib/mock-data.ts`: typed local article dataset, categories and date formatting
- `public/journal-icon.svg` and `src/app/favicon.ico`: publication icons

## Preview scope

All writing and publication dates are demonstration content. Article reading times are calculated from the local bodies. Search, filtering and pagination are visibly disabled previews; all eight articles remain accessible. Comments are a placeholder. The contact form validates its fields locally and explicitly reports that messages are not sent or stored.

The mobile menu and copy-link/email sharing controls are implemented. Fonts use local system serif and sans-serif stacks; illustrations are inline SVG. No remote font or image requests are required.

There is no database, authentication, administration dashboard or comment backend.
