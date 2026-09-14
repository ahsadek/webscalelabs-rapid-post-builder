/**
 * Makes the CURRENT live prompts and formats the new defaults.
 * Rewrites shared/defaults.ts from the database so that every "Reset to default"
 * button in Settings targets what is stored right now. Ideas are left untouched.
 *
 *   npm run db:snapshot-defaults
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pool } from "./db.js";
import { DEFAULT_IDEAS } from "../shared/defaults.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const target = path.join(here, "..", "shared", "defaults.ts");

const prompts = (await pool.query("SELECT key, label, body FROM prompts")).rows as { key: string; label: string; body: string }[];
const formats = (await pool.query("SELECT name, eyebrow, color, prompt FROM formats ORDER BY sort_order, id")).rows as {
  name: string; eyebrow: string; color: string; prompt: string;
}[];
await pool.end();

const order = ["brand", "captionRules", "slideCopy", "contentSlide", "platformCaption"];
prompts.sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key));
const brand = prompts.find((p) => p.key === "brand");
if (!brand) throw new Error("No brand prompt in the database; run npm run db:seed first.");

const js = (v: string) => JSON.stringify(v);
const stamp = new Date().toISOString().slice(0, 10);

const out = [
  `// Seed data and "Reset to default" targets. Snapshot of the live database taken on ${stamp}.`,
  `// To make the current live prompts the new defaults again, run: npm run db:snapshot-defaults`,
  ``,
  `/** Default text of the brand block. Seeded into the prompts table as key "brand" and editable from Settings like the other shared prompts. */`,
  `export const BRAND_BLOCK = ${js(brand.body)};`,
  ``,
  `export type PromptKey = "brand" | "captionRules" | "slideCopy" | "contentSlide" | "platformCaption";`,
  ``,
  `export const DEFAULT_PROMPTS: { key: PromptKey; label: string; body: string }[] = [`,
  `  { key: "brand", label: ${js(brand.label)}, body: BRAND_BLOCK },`,
  ...prompts.filter((p) => p.key !== "brand").map((p) => `  { key: ${js(p.key)}, label: ${js(p.label)}, body: ${js(p.body)} },`),
  `];`,
  ``,
  `export const DEFAULT_FORMATS: { name: string; eyebrow: string; color: string; prompt: string }[] = [`,
  ...formats.map((f) => `  { name: ${js(f.name)}, eyebrow: ${js(f.eyebrow)}, color: ${js(f.color)}, prompt: ${js(f.prompt)} },`),
  `];`,
  ``,
  `export const DEFAULT_IDEAS: { format: string; title: string; gist: string; copy: string }[] = [`,
  ...DEFAULT_IDEAS.map((i) => `  { format: ${js(i.format)}, title: ${js(i.title)}, gist: ${js(i.gist)}, copy: ${js(i.copy)} },`),
  `];`,
  ``,
].join("\n");

fs.writeFileSync(target, out);
console.log(`Defaults updated from the live database: ${prompts.length} prompts, ${formats.length} formats. Ideas untouched.`);
