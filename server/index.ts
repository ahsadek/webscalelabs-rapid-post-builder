import express, { type Request, type Response, type NextFunction } from "express";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { pool, query } from "./db.ts";
import { DEFAULT_FORMATS, DEFAULT_PROMPTS } from "../shared/defaults.ts";

const PROMPT_ORDER = new Map(DEFAULT_PROMPTS.map((p, i) => [p.key, i]));

const here = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.json({ limit: "1mb" }));

const STATUSES = ["Unused", "Drafted", "Posted"] as const;
type Status = (typeof STATUSES)[number];

const FORMAT_COLS = "id, name, eyebrow, color, prompt, has_master AS \"hasMaster\", sort_order AS \"sortOrder\"";
const IDEA_COLS =
  "id, format_id AS \"formatId\", title, gist, copy, status, created_at AS \"createdAt\", updated_at AS \"updatedAt\"";

class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}
const bad = (msg: string) => new HttpError(400, msg);
const str = (v: unknown, name: string, { allowEmpty = false } = {}): string => {
  if (typeof v !== "string") throw bad(`${name} must be a string`);
  const t = v.trim();
  if (!allowEmpty && !t) throw bad(`${name} is required`);
  return t;
};
const wrap =
  (fn: (req: Request, res: Response) => Promise<void>) => (req: Request, res: Response, next: NextFunction) =>
    fn(req, res).catch(next);

/* ---------- read everything the UI needs in one call ---------- */
app.get(
  "/api/bootstrap",
  wrap(async (_req, res) => {
    const [formats, ideas, prompts] = await Promise.all([
      query(`SELECT ${FORMAT_COLS} FROM formats ORDER BY sort_order, id`),
      query(`SELECT ${IDEA_COLS} FROM ideas ORDER BY id`),
      query(`SELECT key, label, body FROM prompts`),
    ]);
    const orderedPrompts = [...prompts.rows].sort(
      (a, b) => (PROMPT_ORDER.get(a.key) ?? 99) - (PROMPT_ORDER.get(b.key) ?? 99),
    );
    res.json({
      formats: formats.rows,
      ideas: ideas.rows,
      prompts: orderedPrompts,
      defaults: {
        prompts: Object.fromEntries(DEFAULT_PROMPTS.map((p) => [p.key, p.body])),
        formats: Object.fromEntries(DEFAULT_FORMATS.map((f) => [f.name, f.prompt])),
      },
    });
  }),
);

/* ---------- ideas ---------- */
app.post(
  "/api/ideas",
  wrap(async (req, res) => {
    const formatId = Number(req.body.formatId);
    if (!Number.isInteger(formatId)) throw bad("formatId is required");
    const title = str(req.body.title, "title");
    const gist = str(req.body.gist, "gist");
    const copy = str(req.body.copy, "copy");
    const { rows } = await query(
      `INSERT INTO ideas (format_id, title, gist, copy) VALUES ($1, $2, $3, $4) RETURNING ${IDEA_COLS}`,
      [formatId, title, gist, copy],
    );
    res.status(201).json(rows[0]);
  }),
);

app.patch(
  "/api/ideas/:id",
  wrap(async (req, res) => {
    const id = Number(req.params.id);
    const sets: string[] = [];
    const vals: unknown[] = [];
    const add = (col: string, v: unknown) => {
      vals.push(v);
      sets.push(`${col} = $${vals.length}`);
    };
    if (req.body.formatId !== undefined) {
      const f = Number(req.body.formatId);
      if (!Number.isInteger(f)) throw bad("formatId must be a number");
      add("format_id", f);
    }
    if (req.body.title !== undefined) add("title", str(req.body.title, "title"));
    if (req.body.gist !== undefined) add("gist", str(req.body.gist, "gist"));
    if (req.body.copy !== undefined) add("copy", str(req.body.copy, "copy"));
    if (req.body.status !== undefined) {
      if (!STATUSES.includes(req.body.status as Status)) throw bad("status must be Unused, Drafted or Posted");
      add("status", req.body.status);
    }
    if (!sets.length) throw bad("Nothing to update");
    vals.push(id);
    const { rows } = await query(
      `UPDATE ideas SET ${sets.join(", ")}, updated_at = now() WHERE id = $${vals.length} RETURNING ${IDEA_COLS}`,
      vals,
    );
    if (!rows[0]) throw new HttpError(404, "Idea not found");
    res.json(rows[0]);
  }),
);

app.delete(
  "/api/ideas/:id",
  wrap(async (req, res) => {
    const { rowCount } = await query(`DELETE FROM ideas WHERE id = $1`, [Number(req.params.id)]);
    if (!rowCount) throw new HttpError(404, "Idea not found");
    res.status(204).end();
  }),
);

/* ---------- formats ---------- */
app.post(
  "/api/formats",
  wrap(async (req, res) => {
    const name = str(req.body.name, "name");
    const eyebrow = str(req.body.eyebrow, "eyebrow").toUpperCase();
    const color = str(req.body.color, "color");
    const prompt = str(req.body.prompt, "prompt");
    if (!/^#[0-9a-f]{6}$/i.test(color)) throw bad("color must be a hex value like #009AB8");
    const { rows } = await query(
      `INSERT INTO formats (name, eyebrow, color, prompt, sort_order)
       VALUES ($1, $2, $3, $4, (SELECT coalesce(max(sort_order), 0) + 1 FROM formats))
       RETURNING ${FORMAT_COLS}`,
      [name, eyebrow, color, prompt],
    );
    res.status(201).json(rows[0]);
  }),
);

app.patch(
  "/api/formats/:id",
  wrap(async (req, res) => {
    const id = Number(req.params.id);
    const sets: string[] = [];
    const vals: unknown[] = [];
    const add = (col: string, v: unknown) => {
      vals.push(v);
      sets.push(`${col} = $${vals.length}`);
    };
    if (req.body.name !== undefined) add("name", str(req.body.name, "name"));
    if (req.body.eyebrow !== undefined) add("eyebrow", str(req.body.eyebrow, "eyebrow").toUpperCase());
    if (req.body.color !== undefined) {
      const c = str(req.body.color, "color");
      if (!/^#[0-9a-f]{6}$/i.test(c)) throw bad("color must be a hex value like #009AB8");
      add("color", c);
    }
    if (req.body.prompt !== undefined) add("prompt", str(req.body.prompt, "prompt"));
    if (req.body.hasMaster !== undefined) add("has_master", Boolean(req.body.hasMaster));
    if (!sets.length) throw bad("Nothing to update");
    vals.push(id);
    const { rows } = await query(
      `UPDATE formats SET ${sets.join(", ")}, updated_at = now() WHERE id = $${vals.length} RETURNING ${FORMAT_COLS}`,
      vals,
    );
    if (!rows[0]) throw new HttpError(404, "Format not found");
    res.json(rows[0]);
  }),
);

app.delete(
  "/api/formats/:id",
  wrap(async (req, res) => {
    const id = Number(req.params.id);
    const { rows } = await query(`SELECT count(*)::int AS n FROM ideas WHERE format_id = $1`, [id]);
    if (rows[0].n > 0) throw new HttpError(409, `This format still has ${rows[0].n} idea(s). Move or delete them first.`);
    const { rowCount } = await query(`DELETE FROM formats WHERE id = $1`, [id]);
    if (!rowCount) throw new HttpError(404, "Format not found");
    res.status(204).end();
  }),
);

/* ---------- shared prompts ---------- */
app.put(
  "/api/prompts/:key",
  wrap(async (req, res) => {
    const key = req.params.key;
    if (!DEFAULT_PROMPTS.some((p) => p.key === key)) throw new HttpError(404, "Unknown prompt");
    const body = str(req.body.body, "body");
    const { rows } = await query(
      `UPDATE prompts SET body = $1, updated_at = now() WHERE key = $2 RETURNING key, label, body`,
      [body, key],
    );
    res.json(rows[0]);
  }),
);

/* ---------- static build in production ---------- */
const dist = path.join(here, "..", "dist");
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.get(/^(?!\/api).*/, (_req, res) => res.sendFile(path.join(dist, "index.html")));
}

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.message });
    return;
  }
  const e = err as { code?: string; message?: string };
  if (e.code === "23505") {
    res.status(409).json({ error: "A row with that name already exists." });
    return;
  }
  if (e.code === "23503") {
    res.status(400).json({ error: "That format does not exist." });
    return;
  }
  console.error(err);
  res.status(500).json({ error: e.message || "Server error" });
});

const port = Number(process.env.PORT) || 3210;
app.listen(port, () => console.log(`API listening on http://localhost:${port}`));

process.on("SIGTERM", () => pool.end().then(() => process.exit(0)));
