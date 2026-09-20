/**
 * Makes the CURRENT live prompts the new defaults. Rewrites shared/defaults.ts from the database so that
 * every "Reset to default" button in Settings targets what is stored right now. Ideas are left untouched.
 *
 *   npm run db:snapshot-defaults
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pool } from "./db.js";
import { CAROUSEL_RULES, DEFAULT_PROMPTS } from "../shared/defaults.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const target = path.join(here, "..", "shared", "defaults.ts");

const live = (await pool.query("SELECT key, label, body FROM post_prompts")).rows as { key: string; label: string; body: string }[];
await pool.end();

const byKey = new Map(live.map((p) => [p.key, p]));
const missing = DEFAULT_PROMPTS.filter((p) => !byKey.has(p.key)).map((p) => p.key);
if (missing.length) throw new Error(`Not in the database: ${missing.join(", ")}. Run npm run db:seed first.`);

const js = (v: string) => JSON.stringify(v);
const stamp = new Date().toISOString().slice(0, 10);
const rows = DEFAULT_PROMPTS.map((p) => {
  const l = byKey.get(p.key)!;
  return `  { key: ${js(p.key)}, label: ${js(l.label)}, body: ${js(l.body)} },`;
}).join("\n");

const out = `// Seed data and "Reset to default" targets. Snapshot of the live database taken on ${stamp}.
// To make the current live prompts the new defaults again, run: npm run db:snapshot-defaults
//
// Placeholders in the two image templates (filled by shared/render.ts):
//   {{hero}} {{layout}} {{headline}} {{cyan}} {{supporting}}   single slide and carousel
//   {{n}} {{topic}} {{#cta}}...{{/cta}} {{^cta}}...{{/cta}}     carousel only (cta is true on slide 4)

import type { PromptKey } from "./types.js";

export const DEFAULT_PROMPTS: { key: PromptKey; label: string; body: string }[] = [
${rows}
];

/** The colleague's carousel generator rules, kept for reference and for the writing brief. Not used by the app. */
export const CAROUSEL_RULES = ${js(CAROUSEL_RULES)};
`;
fs.writeFileSync(target, out);
console.log(`Wrote ${path.relative(process.cwd(), target)} from the live database (${live.length} prompts).`);
