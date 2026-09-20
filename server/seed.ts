import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pool } from "./db.js";
import { migrate } from "./migrate.js";
import { DEFAULT_PROMPTS } from "../shared/defaults.js";
import type { IdeaInput } from "../shared/types.js";
import { normalizeIdea, validateIdea } from "../shared/validate.js";

const here = path.dirname(fileURLToPath(import.meta.url));
export const IDEAS_DIR = path.join(here, "..", "content", "ideas");

/** Reads every content/ideas/*.json file (one idea per file), validated. Throws on the first invalid file. */
export function loadIdeaFiles(): { file: string; idea: IdeaInput }[] {
  if (!fs.existsSync(IDEAS_DIR)) return [];
  const out: { file: string; idea: IdeaInput }[] = [];
  for (const file of fs.readdirSync(IDEAS_DIR).filter((f) => f.endsWith(".json")).sort()) {
    const raw = JSON.parse(fs.readFileSync(path.join(IDEAS_DIR, file), "utf8"));
    const report = validateIdea(raw);
    if (report.errors.length) throw new Error(`${file}:\n  ${report.errors.join("\n  ")}`);
    out.push({ file, idea: normalizeIdea(raw as IdeaInput) });
  }
  return out;
}

/** Inserts ideas that are not in the table yet (matched by title). Returns how many went in. */
export async function importIdeas(ideas: IdeaInput[]): Promise<{ inserted: string[]; skipped: string[] }> {
  const inserted: string[] = [];
  const skipped: string[] = [];
  for (const idea of ideas) {
    const { rowCount } = await pool.query(
      `INSERT INTO post_ideas (title, pillar, service, single, carousel)
       VALUES ($1, $2, $3, $4, $5) ON CONFLICT (title) DO NOTHING`,
      [idea.title, idea.pillar, idea.service, idea.single, JSON.stringify(idea.carousel)],
    );
    (rowCount ? inserted : skipped).push(idea.title);
  }
  return { inserted, skipped };
}

/**
 * Idempotent seed: creates the tables, inserts the shared prompts that are missing (never overwrites an
 * edited one) and imports every idea file under content/ideas that is not in the bank yet.
 */
export async function seed() {
  await migrate();
  for (const p of DEFAULT_PROMPTS) {
    await pool.query(`INSERT INTO post_prompts (key, label, body) VALUES ($1, $2, $3) ON CONFLICT (key) DO NOTHING`, [
      p.key,
      p.label,
      p.body,
    ]);
  }
  return importIdeas(loadIdeaFiles().map((f) => f.idea));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  seed()
    .then(async (r) => {
      const { rows } = await pool.query(
        `SELECT (SELECT count(*) FROM post_ideas) AS ideas, (SELECT count(*) FROM post_prompts) AS prompts`,
      );
      console.log(`Seeded. ${r.inserted.length} idea(s) imported, ${r.skipped.length} already present.`, rows[0]);
      await pool.end();
    })
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}
