-- WebScale Labs Post Builder schema.
-- Three small tables:
--   formats  : the five locked thumbnail formats (name, eyebrow, colour, layout prompt). Add a row to add a format.
--   ideas    : the idea bank. One row per post, points at a format, carries the team-wide status.
--   prompts  : the shared, editable prompt texts (caption rules, slide copy, content slide, platform caption).
-- The brand block is NOT in the database on purpose: it is frozen and hard-coded in shared/defaults.ts.

CREATE TABLE IF NOT EXISTS formats (
  id          serial PRIMARY KEY,
  name        text NOT NULL UNIQUE,
  eyebrow     text NOT NULL,
  color       text NOT NULL,
  prompt      text NOT NULL,
  has_master  boolean NOT NULL DEFAULT false,
  sort_order  integer NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ideas (
  id          serial PRIMARY KEY,
  format_id   integer NOT NULL REFERENCES formats(id) ON DELETE RESTRICT,
  title       text NOT NULL,
  gist        text NOT NULL,
  copy        text NOT NULL,
  status      text NOT NULL DEFAULT 'Unused' CHECK (status IN ('Unused', 'Drafted', 'Posted')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ideas_format_id_idx ON ideas (format_id);

CREATE TABLE IF NOT EXISTS prompts (
  key         text PRIMARY KEY,
  label       text NOT NULL,
  body        text NOT NULL,
  updated_at  timestamptz NOT NULL DEFAULT now()
);
