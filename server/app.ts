import express, { type Request, type Response, type NextFunction } from "express";
import { query } from "./db.js";
import { DEFAULT_PROMPTS } from "../shared/defaults.js";
import { STATUSES, type IdeaInput, type Status } from "../shared/types.js";
import { normalizeIdea, validateIdea } from "../shared/validate.js";

const PROMPT_ORDER = new Map(DEFAULT_PROMPTS.map((p, i) => [p.key, i]));

export const app = express();
app.use(express.json({ limit: "20mb" }));

const IDEA_COLS =
  'id, title, pillar, service, single, carousel, status, created_at AS "createdAt", updated_at AS "updatedAt"';

class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}
const bad = (msg: string) => new HttpError(400, msg);
const wrap =
  (fn: (req: Request, res: Response) => Promise<void>) => (req: Request, res: Response, next: NextFunction) =>
    fn(req, res).catch(next);

/** Validates and normalises a full idea body, or throws a 400 listing every problem. */
function parseIdea(body: unknown): IdeaInput {
  const report = validateIdea(body);
  if (report.errors.length) throw bad(report.errors.join("\n"));
  return normalizeIdea(body as IdeaInput);
}

/* ---------- read everything the UI needs in one call ---------- */
app.get(
  "/api/bootstrap",
  wrap(async (_req, res) => {
    const [ideas, prompts] = await Promise.all([
      query(`SELECT ${IDEA_COLS} FROM post_ideas ORDER BY id`),
      query(`SELECT key, label, body FROM post_prompts`),
    ]);
    const orderedPrompts = [...prompts.rows].sort(
      (a, b) => (PROMPT_ORDER.get(a.key) ?? 99) - (PROMPT_ORDER.get(b.key) ?? 99),
    );
    res.json({
      ideas: ideas.rows,
      prompts: orderedPrompts,
      defaults: { prompts: Object.fromEntries(DEFAULT_PROMPTS.map((p) => [p.key, p.body])) },
    });
  }),
);

/* ---------- ideas ---------- */
app.post(
  "/api/ideas",
  wrap(async (req, res) => {
    const idea = parseIdea(req.body);
    const { rows } = await query(
      `INSERT INTO post_ideas (title, pillar, service, single, carousel)
       VALUES ($1, $2, $3, $4, $5) RETURNING ${IDEA_COLS}`,
      [idea.title, idea.pillar, idea.service, idea.single, JSON.stringify(idea.carousel)],
    );
    res.status(201).json(rows[0]);
  }),
);

/**
 * Bulk import for the idea-generation pipeline. Body: an array of ideas. Each is validated; invalid
 * ones and duplicate titles are reported back, the rest are inserted. Nothing is updated.
 */
app.post(
  "/api/ideas/bulk",
  wrap(async (req, res) => {
    if (!Array.isArray(req.body)) throw bad("Body must be an array of ideas");
    const inserted: unknown[] = [];
    const rejected: { index: number; title: string; reason: string }[] = [];
    for (const [index, raw] of (req.body as unknown[]).entries()) {
      const title = typeof (raw as { title?: unknown })?.title === "string" ? (raw as { title: string }).title : `#${index}`;
      const report = validateIdea(raw);
      if (report.errors.length) {
        rejected.push({ index, title, reason: report.errors.join("; ") });
        continue;
      }
      const idea = normalizeIdea(raw as IdeaInput);
      const { rows } = await query(
        `INSERT INTO post_ideas (title, pillar, service, single, carousel)
         VALUES ($1, $2, $3, $4, $5) ON CONFLICT (title) DO NOTHING RETURNING ${IDEA_COLS}`,
        [idea.title, idea.pillar, idea.service, idea.single, JSON.stringify(idea.carousel)],
      );
      if (rows[0]) inserted.push(rows[0]);
      else rejected.push({ index, title, reason: "an idea with this title already exists" });
    }
    res.status(rejected.length && !inserted.length ? 400 : 200).json({ inserted, rejected });
  }),
);

app.patch(
  "/api/ideas/:id",
  wrap(async (req, res) => {
    const id = Number(req.params.id);
    const { rows: existing } = await query(`SELECT ${IDEA_COLS} FROM post_ideas WHERE id = $1`, [id]);
    if (!existing[0]) throw new HttpError(404, "Idea not found");

    const sets: string[] = [];
    const vals: unknown[] = [];
    const add = (col: string, v: unknown) => {
      vals.push(v);
      sets.push(`${col} = $${vals.length}`);
    };

    if (req.body.status !== undefined) {
      if (!STATUSES.includes(req.body.status as Status)) throw bad("status must be Unused or Used");
      add("status", req.body.status);
    }
    const contentKeys = ["title", "pillar", "service", "single", "carousel"] as const;
    if (contentKeys.some((k) => req.body[k] !== undefined)) {
      // Merge onto the stored row and validate the whole idea, so a partial patch can never leave it inconsistent.
      const merged: Record<string, unknown> = { ...existing[0] };
      for (const k of contentKeys) if (req.body[k] !== undefined) merged[k] = req.body[k];
      const idea = parseIdea(merged);
      add("title", idea.title);
      add("pillar", idea.pillar);
      add("service", idea.service);
      add("single", idea.single);
      add("carousel", JSON.stringify(idea.carousel));
    }
    if (!sets.length) throw bad("Nothing to update");
    vals.push(id);
    const { rows } = await query(
      `UPDATE post_ideas SET ${sets.join(", ")}, updated_at = now() WHERE id = $${vals.length} RETURNING ${IDEA_COLS}`,
      vals,
    );
    res.json(rows[0]);
  }),
);

app.delete(
  "/api/ideas/:id",
  wrap(async (req, res) => {
    const { rowCount } = await query(`DELETE FROM post_ideas WHERE id = $1`, [Number(req.params.id)]);
    if (!rowCount) throw new HttpError(404, "Idea not found");
    res.status(204).end();
  }),
);

/* ---------- shared prompts ---------- */
app.put(
  "/api/prompts/:key",
  wrap(async (req, res) => {
    const key = req.params.key;
    if (!DEFAULT_PROMPTS.some((p) => p.key === key)) throw new HttpError(404, "Unknown prompt");
    if (typeof req.body.body !== "string" || !req.body.body.trim()) throw bad("body is required");
    const { rows } = await query(
      `UPDATE post_prompts SET body = $1, updated_at = now() WHERE key = $2 RETURNING key, label, body`,
      [req.body.body, key],
    );
    if (!rows[0]) throw new HttpError(404, "Prompt not seeded; run npm run db:seed");
    res.json(rows[0]);
  }),
);

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.message });
    return;
  }
  const e = err as { code?: string; message?: string };
  if (e.code === "23505") {
    res.status(409).json({ error: "An idea with that title already exists." });
    return;
  }
  if (e.code === "42P01") {
    res.status(500).json({ error: "Tables are missing. Run npm run db:seed against this database." });
    return;
  }
  console.error(err);
  res.status(500).json({ error: e.message || "Server error" });
});

export default app;
