/**
 * Prompt assembly and copy checks, ported unchanged from the original index.html.
 * Only the data source differs: formats and the shared prompts (brand block included)
 * now come from the database.
 */
import type { Format, Idea, PromptKey } from "./types";

export type PromptMap = Record<PromptKey, string>;

export function extract(copy: string, key: string): string {
  const m = new RegExp(key + '\\s*(?:\\([^)]*\\))?:\\s*"([^"]*)"').exec(copy);
  return m ? m[1] : "";
}

/** Line added at the very top of an image prompt when a reference image is attached. */
export const REFERENCE_HEAD =
  "Match the attached reference image's layout, colours, typography and style exactly. Change only the text.\n\n";

export function thumbnailPrompt(idea: Idea, format: Format, prompts: PromptMap, withMaster: boolean): string {
  const fmt = format.prompt
    .replace("[BRAND BLOCK PASTED ABOVE THIS LINE]\n\n", "")
    .replace("[paste the row's In-image copy here]", idea.copy);
  const head = withMaster ? REFERENCE_HEAD : "";
  return head + prompts.brand + "\n\n" + fmt;
}

export function slideCopyPrompt(idea: Idea, prompts: PromptMap): string {
  return prompts.slideCopy
    .replace("[PASTE CAPTION RULES]", prompts.captionRules)
    .replace("[paste the row's In-image copy]", idea.copy)
    .replace("[paste the row's Gist]", idea.gist);
}

export function contentSlidePrompt(
  format: Format,
  prompts: PromptMap,
  header: string,
  body: string,
  isFinal: boolean,
  cta: string,
  withMaster = false,
): string {
  let p = prompts.contentSlide.replace("[BRAND BLOCK PASTED ABOVE THIS LINE]\n\n", "");
  const eyebrow = format.eyebrow || "";
  p = p.replace(
    "the same eyebrow pill as the reference image, same position.",
    `the same eyebrow pill as the reference image, same position, reading "● ${eyebrow}".`,
  );
  const i = p.indexOf("TEXT TO RENDER:");
  if (i > -1) p = p.slice(0, i);
  let txt = 'TEXT TO RENDER:\nHeader: "' + header.trim() + '"\nBody: "' + body.trim() + '"';
  if (isFinal) txt += '\nCTA line, plain Pulse Cyan text on its own line: "' + cta.trim() + '"';
  const note = isFinal
    ? "\nThis is the FINAL SLIDE. Apply the FINAL SLIDE ONLY rule.\n"
    : "\nThis is a content slide, not the final slide. No CTA.\n";
  const head = withMaster ? REFERENCE_HEAD : "";
  return head + prompts.brand + "\n\n" + p + note + "\n" + txt;
}

/* ---------- checks on slide copy ---------- */
export function headerIssues(h: string): string[] {
  const out: string[] = [];
  const w = h.trim().split(/\s+/).filter(Boolean);
  if (!h.trim()) return out;
  if (w.length > 6) out.push(`${w.length} words, max is 6`);
  if (/\?/.test(h)) out.push("no questions in headers");
  if (!/\.$/.test(h.trim())) out.push("end with a full stop");
  if (/^we\b/i.test(h.trim())) out.push("never open with We");
  if (/—|–| - /.test(h)) out.push("no dashes");
  return out;
}

export function bodyIssues(b: string): string[] {
  const out: string[] = [];
  const w = b.trim().split(/\s+/).filter(Boolean);
  if (!b.trim()) return out;
  if (w.length > 25) out.push(`${w.length} words, max is 25`);
  if (/—/.test(b)) out.push("no em dashes");
  if (/\b(may|might|we believe|we think|we feel)\b/i.test(b)) out.push("hedging word");
  if (/\n\s*\n/.test(b.trim())) out.push("one paragraph only");
  return out;
}

export const DEFAULT_CTA = "Get a Free Estimate at webscalelabs.co";
