import path from "node:path";
import { fileURLToPath } from "node:url";
import { pool } from "./db.ts";
import { migrate } from "./migrate.ts";
import { DEFAULT_FORMATS, DEFAULT_IDEAS, DEFAULT_PROMPTS } from "../shared/defaults.ts";

/**
 * Idempotent seed. Inserts the five formats, the four shared prompts and the 28 ideas
 * only when they are missing, so it is safe to run again after the team has added rows.
 */
export async function seed() {
  await migrate();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    for (const [i, f] of DEFAULT_FORMATS.entries()) {
      await client.query(
        `INSERT INTO formats (name, eyebrow, color, prompt, sort_order)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (name) DO NOTHING`,
        [f.name, f.eyebrow, f.color, f.prompt, i + 1],
      );
    }

    for (const p of DEFAULT_PROMPTS) {
      await client.query(
        `INSERT INTO prompts (key, label, body) VALUES ($1, $2, $3) ON CONFLICT (key) DO NOTHING`,
        [p.key, p.label, p.body],
      );
    }

    const { rows: formats } = await client.query<{ id: number; name: string }>("SELECT id, name FROM formats");
    const idByName = new Map(formats.map((f) => [f.name, f.id]));

    const { rows: existing } = await client.query<{ n: string }>("SELECT count(*)::text AS n FROM ideas");
    if (existing[0].n === "0") {
      for (const idea of DEFAULT_IDEAS) {
        const formatId = idByName.get(idea.format);
        if (!formatId) throw new Error(`Unknown format in defaults: ${idea.format}`);
        await client.query(
          `INSERT INTO ideas (format_id, title, gist, copy) VALUES ($1, $2, $3, $4)`,
          [formatId, idea.title, idea.gist, idea.copy],
        );
      }
    }

    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  seed()
    .then(async () => {
      const { rows } = await pool.query(
        `SELECT (SELECT count(*) FROM formats) AS formats,
                (SELECT count(*) FROM ideas) AS ideas,
                (SELECT count(*) FROM prompts) AS prompts`,
      );
      console.log("Seeded.", rows[0]);
      await pool.end();
    })
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}
