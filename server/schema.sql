-- WebScaleLabs Rapid Post Builder schema (v2: self-contained ideas).
--   post_ideas   : the idea bank. One row per post idea, carrying the single-slide spec and the 4 carousel
--                  slide specs as JSON, plus the team-wide status (Unused or Used).
--   post_prompts : the shared, editable texts: the two image-prompt templates, the three layout options and
--                  the four caption prompts.
-- The v1 tables (formats, ideas, prompts) are left untouched so an older deployment keeps working;
-- drop them once everyone is on v2.

CREATE TABLE IF NOT EXISTS post_ideas (
  id          serial PRIMARY KEY,
  title       text NOT NULL UNIQUE,
  pillar      text NOT NULL,
  service     text,
  single      jsonb NOT NULL,
  carousel    jsonb NOT NULL,
  status      text NOT NULL DEFAULT 'Unused' CHECK (status IN ('Unused', 'Used')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS post_ideas_status_idx ON post_ideas (status);
CREATE INDEX IF NOT EXISTS post_ideas_pillar_idx ON post_ideas (pillar);

CREATE TABLE IF NOT EXISTS post_prompts (
  key         text PRIMARY KEY,
  label       text NOT NULL,
  body        text NOT NULL,
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- Migrations for databases created by earlier versions of this file (each statement is idempotent).
ALTER TABLE post_ideas DROP COLUMN IF EXISTS overrides;
ALTER TABLE post_ideas DROP CONSTRAINT IF EXISTS post_ideas_status_check;
UPDATE post_ideas SET status = 'Used' WHERE status NOT IN ('Unused', 'Used');
ALTER TABLE post_ideas ADD CONSTRAINT post_ideas_status_check CHECK (status IN ('Unused', 'Used'));
