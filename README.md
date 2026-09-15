# WebScaleLabs · Rapid Post Builder

A small React + Express app that replaces the static `index.html` post builder. Same workflow, same prompts,
same stamping step. The difference is that the idea bank, the statuses, the format prompts and the shared
prompts now live in a Neon Postgres database, so the whole team sees the same thing.

## Run it

```bash
cd app
npm install
npm run db:seed     # creates the tables and loads the 5 formats, 4 shared prompts and 28 ideas (safe to re-run)
npm run dev         # API on http://localhost:3210, UI on http://localhost:5173
```

The server reads `DATABASE_URL` from `app/.env` first, then from the repo-root `.env`.

Production style:

```bash
npm run build       # typecheck + Vite build into app/dist
npm start           # one Node process serves the API and the built UI on port 3210
```

Set `PORT` to change the API port. The Vite dev proxy follows it.

## Deploying to Vercel

The repo is Vercel-ready: `vercel.json` builds the UI into `dist/` and routes every `/api/*` request to
`api/index.ts`, which runs the same Express app as a serverless function.

1. Import the repository in Vercel (root directory = this folder).
2. In the project settings, add the environment variable `DATABASE_URL` with the Neon connection string.
   Without it the API returns an error and the UI shows "Could not load the idea bank".
3. Deploy. Tables must already exist: run `npm run db:seed` once from your machine against the same database.

## What lives where

| Thing | Where | Why |
| --- | --- | --- |
| Formats (name, eyebrow, colour, layout prompt, "we have a master") | table `formats` | Adding a sixth format is a row, not a deploy. Editable in Settings. |
| Ideas (title, gist, in-image copy, status) | table `ideas` | The queue. Add, edit, delete and set status from the Prompts view. |
| Shared prompts (brand block, caption rules, slide copy, content slide, platform caption) | table `prompts` | Editable in Settings, with "Reset to default". The brand block goes into every image prompt, so edits to it are a team decision. |
| Stamp logo | browser `localStorage`, default is the white wordmark from `public/logo-white.png` | Per-browser convenience, not team data. |

**Not sure which prompt to edit?** Settings opens with "Ask an AI where to change something". Type the change
or question, copy the generated prompt into ChatGPT, and it answers with the exact editor to open and the exact
text to replace. The prompt is built by `src/advisor.ts` from the live database, so it never goes stale.

`shared/defaults.ts` holds the seed data and the "Reset to default" targets. When the team has settled on
edited prompts and wants them to become the new baseline, run `npm run db:snapshot-defaults`: it rewrites that
file from the live database (prompts and formats only, ideas untouched) so every Reset button targets the current text. It was generated verbatim
from the original `index.html` and should stay that way unless the team decides to change a prompt.

## Layout

```
app/
  server/     Express API (index.ts), pg pool (db.ts), schema.sql, migrate.ts, seed.ts
  shared/     defaults.ts: brand block + default prompts/formats/ideas
  src/        React UI
    prompts.ts      prompt assembly and copy checks, ported unchanged from index.html
    views/          Sidebar, IdeaDetail, IdeaForm, StampView, SettingsView
  public/     logo-white.png (default stamp logo), favicon.png
```

## API

| Method | Path | Body |
| --- | --- | --- |
| GET | `/api/bootstrap` | – (formats, ideas, prompts, defaults) |
| POST | `/api/ideas` | `{ formatId, title, gist, copy }` |
| PATCH | `/api/ideas/:id` | any of `formatId, title, gist, copy, status` |
| DELETE | `/api/ideas/:id` | – |
| POST | `/api/formats` | `{ name, eyebrow, color, prompt }` |
| PATCH | `/api/formats/:id` | any of `name, eyebrow, color, prompt, hasMaster` |
| DELETE | `/api/formats/:id` | – (refused while ideas still use it) |
| PUT | `/api/prompts/:key` | `{ body }` |
