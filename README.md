# WebScaleLabs · Rapid Post Builder

A small React + Express app over a Neon Postgres database. It holds a bank of **self-contained post ideas**. Each
idea is ready to post two ways: as a single image, or as a 4-slide carousel. Click an idea, pick one, copy the
image prompt(s) into ChatGPT, generate, stamp the logo, then copy a caption prompt for the profile you are posting on.

## Run it

```bash
cd app
npm install
npm run db:seed     # creates the v2 tables, loads the shared prompts and imports content/ideas/*.json (safe to re-run)
npm run dev         # API on http://localhost:3210, UI on http://localhost:5173
```

The server reads `DATABASE_URL` from `app/.env` first, then from the repo-root `.env`.

Production style:

```bash
npm run build       # typecheck + Vite build into app/dist
npm start           # one Node process serves the API and the built UI on port 3210
```

## Deploying to Vercel

`vercel.json` builds the UI into `dist/` and routes every `/api/*` request to `api/index.ts`, which runs the same
Express app as a serverless function. Add `DATABASE_URL` in the project settings and run `npm run db:seed` once from
your machine against the same database.

## How an idea is built

The team's master prompt document produces, for every post, a long image prompt in which only a handful of things
change: the headline, the cyan word, the supporting line, the 3D hero object and the layout option. Everything else
(background, colours, typography, forbidden list) is the same text every time. So:

- **An idea stores only the changing fields**, for the single-slide post and for each of the 4 carousel slides.
- **The fixed text lives in two templates** (single slide, carousel slide) in Settings. The app renders the exact
  prompt at click time. Editing a template changes every idea in the bank at once.
- **Four caption prompts** (main profiles, Ahmed, Salman, Youssef) are shared and copied from the idea page. The
  post's text is appended under the prompt so the caption can be written even without attaching the image.

The templates were generated verbatim from the master document (see `shared/defaults.ts`). Two sentences were added
and can be removed in Settings if the team prefers: "Render only the text given in TEXT TO RENDER" in both templates,
and on carousel slide 4 the sentence making the CTA URL an exception to the no-URL rule.

## Producing ideas in bulk

Ideas are written as JSON files, one per idea, under `content/ideas/`. `content/BRIEF.md` is the writing brief:
give it to a person or an agent together with a list of topics.

```bash
npm run ideas:validate                                  # every rule the master prompt sets, as errors and warnings
npm run ideas:render -- content/ideas/<file>.json       # print the rendered prompts to read them as the generator would
npm run ideas:import                                    # insert every valid file whose title is not in the bank yet
npm run ideas:import -- --api https://<deployment>      # same, through POST /api/ideas/bulk
```

Titles are unique, so re-importing is safe. Ideas already in the database are never overwritten by a file.

## What lives where

| Thing | Where |
| --- | --- |
| Ideas (title, pillar, service, single spec, carousel spec, status Unused/Used) | table `post_ideas` |
| Shared prompts (2 templates, 3 layout options, 4 caption prompts) | table `post_prompts`, editable in Settings with Reset to default |
| Defaults for Reset | `shared/defaults.ts`; refresh from the live DB with `npm run db:snapshot-defaults` |
| Validation rules | `shared/validate.ts`, used by the API, the form and the CLI |
| Prompt rendering | `shared/render.ts` |
| Stamp logo | browser `localStorage`, default is `public/logo-white.png`; logo goes top right, counter bottom left |

The v1 tables (`formats`, `ideas`, `prompts`) are left in place and unused. Drop them once everyone is on v2.

## API

| Method | Path | Body |
| --- | --- | --- |
| GET | `/api/bootstrap` | – (ideas, prompts, defaults) |
| POST | `/api/ideas` | a full idea (see `shared/types.ts`, `IdeaInput`) |
| POST | `/api/ideas/bulk` | an array of ideas; returns `{ inserted, rejected }` |
| PATCH | `/api/ideas/:id` | any of `title, pillar, service, single, carousel, status` |
| DELETE | `/api/ideas/:id` | – |
| PUT | `/api/prompts/:key` | `{ body }` |
