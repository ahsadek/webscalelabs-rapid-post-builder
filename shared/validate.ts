/**
 * Checks a post idea against the master prompt's rules. Used by the API (on write), the UI form
 * (live) and the ideas CLI (before import). Errors block a save; warnings are advisory.
 */
import { CAROUSEL_CTA, LAYOUTS, PILLARS, type IdeaInput, type SingleSpec, type SlideSpec } from "./types.js";

export interface Report {
  errors: string[];
  warnings: string[];
}

const BANNED_PHRASES = [
  "we believe", "we think", "we feel", "world-class", "cutting-edge", "passionate", "innovative", "synergy", "leverage",
];

const words = (s: string) => s.trim().split(/\s+/).filter(Boolean);
const isStr = (v: unknown): v is string => typeof v === "string";

function checkText(where: string, s: unknown, r: Report, { required = true } = {}): s is string {
  if (!isStr(s) || !s.trim()) {
    if (required) r.errors.push(`${where}: missing`);
    return false;
  }
  if (/—|–/.test(s)) r.errors.push(`${where}: contains a dash (em or en dashes are banned everywhere)`);
  for (const b of BANNED_PHRASES) if (s.toLowerCase().includes(b)) r.warnings.push(`${where}: uses the banned phrase "${b}"`);
  return true;
}

function checkHeadline(where: string, headline: unknown, cyan: unknown, r: Report) {
  if (!Array.isArray(headline) || !headline.every(isStr)) {
    r.errors.push(`${where}.headline: must be an array of strings`);
    return;
  }
  const lines = headline.map((l) => l.trim());
  if (lines.some((l) => !l)) r.errors.push(`${where}.headline: empty line`);
  if (lines.length < 2 || lines.length > 3) r.errors.push(`${where}.headline: must be 2 or 3 lines, got ${lines.length}`);
  const full = lines.join(" ");
  if (!/\.$/.test(full)) r.errors.push(`${where}.headline: must end with a full stop`);
  if (lines.slice(0, -1).some((l) => /\.$/.test(l))) r.warnings.push(`${where}.headline: a line before the last ends with a full stop`);
  if (full !== full.toUpperCase()) r.errors.push(`${where}.headline: must be ALL CAPS`);
  if (/—|–/.test(full)) r.errors.push(`${where}.headline: contains a dash`);
  if (/\?/.test(full)) r.warnings.push(`${where}.headline: contains a question mark`);
  const w = words(full.replace(/[.,!]/g, ""));
  if (w.length > 12) r.warnings.push(`${where}.headline: ${w.length} words is long for 2-3 lines at this size`);

  if (!isStr(cyan) || !cyan.trim()) {
    r.errors.push(`${where}.cyan: missing`);
    return;
  }
  const c = cyan.trim();
  if (c !== c.toUpperCase()) r.errors.push(`${where}.cyan: must be ALL CAPS, exactly as it appears in the headline`);
  if (words(c).length !== 1) r.errors.push(`${where}.cyan: must be exactly one word`);
  const re = new RegExp(`(^|[^A-Z0-9'])${c.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^A-Z0-9']|$)`);
  if (!re.test(full)) r.errors.push(`${where}.cyan: "${c}" does not appear as a whole word in the headline`);
}

function checkSupporting(where: string, s: unknown, r: Report) {
  if (!checkText(where, s, r)) return;
  const n = words(s).length;
  if (n > 14) r.errors.push(`${where}: ${n} words, the maximum is 14`);
  else if (n > 12) r.warnings.push(`${where}: ${n} words, aim for 8 to 12`);
  else if (n < 8) r.warnings.push(`${where}: ${n} words, aim for 8 to 12`);
  if (/^[a-z]/.test(s.trim())) r.warnings.push(`${where}: should be sentence case (capital first letter)`);
  if (s.trim() !== s.trim().replace(/\s+/g, " ")) r.warnings.push(`${where}: has double spaces or line breaks`);
  if (/\b(we|our)\b/i.test(s) && /^we\b/i.test(s.trim())) r.warnings.push(`${where}: opens with "We"`);
  if (/\d+\s?%|\d+x\b/i.test(s)) r.warnings.push(`${where}: contains a figure; make sure it is not an unsupported performance claim`);
}

function checkHero(where: string, s: unknown, r: Report) {
  if (!checkText(where, s, r)) return;
  const n = words(s).length;
  if (n < 40) r.warnings.push(`${where}: ${n} words; the hero description should be concrete and detailed (aim for 60 to 140)`);
  if (n > 220) r.warnings.push(`${where}: ${n} words; keep it to one recognisable scene`);
  if (/\b(google|meta|facebook|instagram|linkedin|shopify|hubspot|salesforce|wordpress)\b/i.test(s))
    r.warnings.push(`${where}: names a third-party brand; interfaces must be generic and unbranded`);
}

export function checkSingle(single: unknown, r: Report, where = "single") {
  if (!single || typeof single !== "object") {
    r.errors.push(`${where}: missing`);
    return;
  }
  const s = single as Partial<SingleSpec>;
  checkHeadline(where, s.headline, s.cyan, r);
  checkSupporting(`${where}.supporting`, s.supporting, r);
  checkHero(`${where}.hero`, s.hero, r);
  if (!LAYOUTS.includes(s.layout as never)) r.errors.push(`${where}.layout: must be A, B or C`);
}

export function checkCarousel(carousel: unknown, r: Report, where = "carousel") {
  if (!Array.isArray(carousel) || carousel.length !== 4) {
    r.errors.push(`${where}: must be exactly 4 slides`);
    return;
  }
  const heroes: string[] = [];
  carousel.forEach((raw, i) => {
    const w = `${where}[${i + 1}]`;
    if (!raw || typeof raw !== "object") {
      r.errors.push(`${w}: missing`);
      return;
    }
    const s = raw as Partial<SlideSpec>;
    if (checkText(`${w}.topic`, s.topic, r)) {
      if (/\.$/.test(s.topic.trim())) r.errors.push(`${w}.topic: no trailing full stop (the template adds it)`);
      if (words(s.topic).length > 16) r.warnings.push(`${w}.topic: keep it to one short phrase`);
    }
    checkHeadline(w, s.headline, s.cyan, r);
    if (i === 3) {
      if (isStr(s.supporting) && s.supporting.trim() && s.supporting.trim() !== CAROUSEL_CTA)
        r.warnings.push(`${w}.supporting: ignored, slide 4 always renders the fixed CTA`);
    } else {
      checkSupporting(`${w}.supporting`, s.supporting, r);
    }
    checkHero(`${w}.hero`, s.hero, r);
    if (isStr(s.hero)) heroes.push(s.hero.trim().toLowerCase());
  });
  if (new Set(heroes).size !== heroes.length) r.errors.push(`${where}: two slides share the same hero description; every slide needs a different object`);
}

export function validateIdea(input: unknown): Report {
  const r: Report = { errors: [], warnings: [] };
  if (!input || typeof input !== "object") {
    r.errors.push("idea: not an object");
    return r;
  }
  const i = input as Partial<IdeaInput>;
  if (checkText("title", i.title, r) && i.title.trim().length > 90) r.warnings.push("title: keep it short, it is the sidebar label");
  if (!PILLARS.includes(i.pillar as never)) r.errors.push(`pillar: must be one of: ${PILLARS.join(" | ")}`);
  if (i.service != null && i.service !== "" && !isStr(i.service)) r.errors.push("service: must be a string");
  checkSingle(i.single, r);
  checkCarousel(i.carousel, r);
  return r;
}

/** Trims every text field and drops unknown keys, so the database only ever holds the shape above. */
export function normalizeIdea(input: IdeaInput): IdeaInput {
  const t = (s: string) => s.trim().replace(/[ \t]+/g, " ");
  const slide = (s: SlideSpec, i: number): SlideSpec => ({
    topic: t(s.topic),
    headline: s.headline.map(t),
    cyan: t(s.cyan),
    supporting: i === 3 ? CAROUSEL_CTA : t(s.supporting),
    hero: s.hero.trim(),
  });
  return {
    title: t(input.title),
    pillar: input.pillar,
    service: input.service ? t(input.service) : null,
    single: {
      headline: input.single.headline.map(t),
      cyan: t(input.single.cyan),
      supporting: t(input.single.supporting),
      hero: input.single.hero.trim(),
      layout: input.single.layout,
    },
    carousel: input.carousel.map(slide),
  };
}
