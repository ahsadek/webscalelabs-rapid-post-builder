/**
 * Idea pipeline CLI. One JSON file per idea under content/ideas/.
 *
 *   npm run ideas:validate            check every file (errors block import, warnings are advice)
 *   npm run ideas:render -- <file>    print the rendered prompts for one file, using the default templates
 *   npm run ideas:import              insert every valid file whose title is not in the database yet
 *   npm run ideas:import -- --api https://host   same, but through POST /api/ideas/bulk instead of the database
 *   npm run ideas:import -- --update  also replace the content of ideas that already exist (status is kept)
 *   npm run ideas:export              write every idea in the database to content/ideas/ (the database is the source of truth)
 */
import fs from "node:fs";
import path from "node:path";
import { DEFAULT_PROMPTS } from "../shared/defaults.js";
import { renderCaption, renderCarousel, renderSingle } from "../shared/render.js";
import type { IdeaInput, PromptMap } from "../shared/types.js";
import { normalizeIdea, validateIdea } from "../shared/validate.js";

const [cmd, ...args] = process.argv.slice(2);
const IDEAS_DIR = path.resolve("content", "ideas");
const prompts = Object.fromEntries(DEFAULT_PROMPTS.map((p) => [p.key, p.body])) as PromptMap;

const slugify = (t: string) => t.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

function files(): string[] {
  if (!fs.existsSync(IDEAS_DIR)) return [];
  return fs
    .readdirSync(IDEAS_DIR)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .map((f) => path.join(IDEAS_DIR, f));
}

function validateAll(): { ok: boolean; ideas: IdeaInput[] } {
  let errors = 0;
  let warnings = 0;
  const ideas: IdeaInput[] = [];
  const titles = new Map<string, string>();
  const headlines = new Map<string, string>();
  for (const f of files()) {
    const name = path.basename(f);
    let raw: unknown;
    try {
      raw = JSON.parse(fs.readFileSync(f, "utf8"));
    } catch (e) {
      console.log(`✗ ${name}: not valid JSON (${(e as Error).message})`);
      errors++;
      continue;
    }
    const r = validateIdea(raw);
    const idea = raw as IdeaInput;
    if (typeof idea?.title === "string") {
      const t = idea.title.trim().toLowerCase();
      if (titles.has(t)) r.errors.push(`title duplicates ${titles.get(t)}`);
      titles.set(t, name);
    }
    if (Array.isArray(idea?.single?.headline)) {
      const h = idea.single.headline.join(" ").toLowerCase();
      if (headlines.has(h)) r.errors.push(`single headline duplicates ${headlines.get(h)}`);
      headlines.set(h, name);
    }
    errors += r.errors.length;
    warnings += r.warnings.length;
    const mark = r.errors.length ? "✗" : r.warnings.length ? "!" : "✓";
    console.log(`${mark} ${name}`);
    for (const e of r.errors) console.log(`    error: ${e}`);
    for (const w of r.warnings) console.log(`    warn:  ${w}`);
    if (!r.errors.length) ideas.push(normalizeIdea(idea));
  }
  console.log(`\n${files().length} file(s), ${errors} error(s), ${warnings} warning(s).`);
  return { ok: errors === 0, ideas };
}

async function main() {
  if (cmd === "validate") {
    process.exit(validateAll().ok ? 0 : 1);
  }

  if (cmd === "render") {
    const f = args[0];
    if (!f) throw new Error("Usage: ideas render <file.json>");
    const idea = JSON.parse(fs.readFileSync(f, "utf8")) as IdeaInput;
    const r = validateIdea(idea);
    if (r.errors.length) throw new Error("Invalid idea:\n" + r.errors.join("\n"));
    const only = args[1]; // single | carousel | caption
    if (!only || only === "single") console.log("===== SINGLE SLIDE =====\n\n" + renderSingle(idea, prompts) + "\n");
    if (!only || only === "carousel")
      renderCarousel(idea, prompts).forEach((p, i) => console.log(`===== CAROUSEL SLIDE ${i + 1} =====\n\n${p}\n`));
    if (only === "caption") console.log(renderCaption(idea, "captionMain", "carousel", prompts));
    return;
  }

  if (cmd === "import") {
    const { ok, ideas } = validateAll();
    if (!ok) {
      console.log("Fix the errors above, then import again. Nothing was written.");
      process.exit(1);
    }
    const apiIdx = args.indexOf("--api");
    if (apiIdx >= 0) {
      const base = args[apiIdx + 1]?.replace(/\/$/, "");
      if (!base) throw new Error("--api needs a URL");
      const res = await fetch(`${base}/api/ideas/bulk`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(ideas),
      });
      const json = (await res.json()) as { inserted?: unknown[]; rejected?: { title: string; reason: string }[]; error?: string };
      if (json.error) throw new Error(json.error);
      console.log(`Inserted ${json.inserted?.length ?? 0}.`);
      for (const r of json.rejected ?? []) console.log(`  skipped "${r.title}": ${r.reason}`);
      return;
    }
    const { importIdeas } = await import("../server/seed.js");
    const { pool } = await import("../server/db.js");
    const update = args.includes("--update");
    const r = await importIdeas(ideas, { update });
    await pool.end();
    console.log(`Inserted ${r.inserted.length}, updated ${r.updated.length}, already present ${r.skipped.length}.`);
    if (!update) for (const t of r.skipped) console.log(`  already present: ${t}`);
    return;
  }

  if (cmd === "export") {
    const { pool } = await import("../server/db.js");
    const { rows } = await pool.query(`SELECT title, pillar, format, service, single, carousel FROM post_ideas ORDER BY id`);
    await pool.end();
    fs.mkdirSync(IDEAS_DIR, { recursive: true });
    // Keep existing file names where a file already holds the same title.
    const byTitle = new Map<string, string>();
    for (const f of files()) {
      try {
        byTitle.set(String(JSON.parse(fs.readFileSync(f, "utf8")).title).toLowerCase(), f);
      } catch {
        /* unreadable file: a fresh name is used */
      }
    }
    for (const r of rows) {
      const file = byTitle.get(r.title.toLowerCase()) ?? path.join(IDEAS_DIR, slugify(r.title) + ".json");
      const idea = { title: r.title, pillar: r.pillar, format: r.format, service: r.service ?? undefined, single: r.single, carousel: r.carousel };
      fs.writeFileSync(file, JSON.stringify(idea, null, 2) + "\n");
    }
    console.log(`Exported ${rows.length} idea(s) to ${path.relative(process.cwd(), IDEAS_DIR)}.`);
    return;
  }

  console.log("Usage: ideas validate | render <file> [single|carousel|caption] | import [--update] [--api URL] | export");
  process.exit(1);
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
