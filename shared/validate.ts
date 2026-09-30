/**
 * Checks a post idea against the master prompt's rules. Used by the API (on write), the UI form
 * (live) and the ideas CLI (before import). Errors block a save; warnings are advisory.
 */
import { CAROUSEL_CTA, FORMATS, LAYOUTS, PILLARS, type Format, type IdeaInput, type SingleSpec, type SlideSpec } from "./types.js";

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
  if (RENDERED_BRAND.test(full)) r.errors.push(`${where}.headline: names "${full.match(RENDERED_BRAND)?.[0]}"; the image templates forbid brand names in the rendered text`);
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

const STOP = new Set("a an the and or but of to in on for with at by from your you it its is are be this that these those not no our their than then into over as".split(" "));
const stem = (w: string) => w.toLowerCase().replace(/[^a-z0-9]/g, "").replace(/(ing|ers|er|ies|es|s|ed)$/, "");
const contentWords = (s: string) => words(s).map(stem).filter((w) => w.length > 2 && !STOP.has(w));

/** Share of the supporting line's content words that already appear in the headline. */
export function headlineOverlap(headline: string[], supporting: string): number {
  const h = new Set(contentWords(headline.join(" ")));
  const sw = contentWords(supporting);
  if (!sw.length) return 0;
  return sw.filter((w) => h.has(w)).length / sw.length;
}

function checkSupporting(where: string, s: unknown, r: Report, headline?: unknown) {
  if (!checkText(where, s, r)) return;
  if (Array.isArray(headline) && headline.every(isStr)) {
    const o = headlineOverlap(headline, s);
    if (o >= 0.3) r.warnings.push(`${where}: reuses ${Math.round(o * 100)}% of the headline's words; it should give an action step or an offer, not restate the headline`);
  }
  const n = words(s).length;
  if (n > 14) r.errors.push(`${where}: ${n} words, the maximum is 14`);
  else if (n > 12) r.warnings.push(`${where}: ${n} words, aim for 8 to 12`);
  else if (n < 8) r.warnings.push(`${where}: ${n} words, aim for 8 to 12`);
  if (/^[a-z]/.test(s.trim())) r.warnings.push(`${where}: should be sentence case (capital first letter)`);
  if (s.trim() !== s.trim().replace(/\s+/g, " ")) r.warnings.push(`${where}: has double spaces or line breaks`);
  if (/\b(we|our)\b/i.test(s) && /^we\b/i.test(s.trim())) r.warnings.push(`${where}: opens with "We"`);
  if (/\d+\s?%|\d+x\b/i.test(s)) r.warnings.push(`${where}: contains a figure; make sure it is not an unsupported performance claim`);
  if (RENDERED_BRAND.test(s)) r.errors.push(`${where}: names "${s.match(RENDERED_BRAND)?.[0]}"; the image templates forbid brand names in the rendered text, use a generic word or "Our team"`);
}

/** Brand and company names that must never be rendered in the image text (the logo is stamped afterwards). */
const RENDERED_BRAND = /\b(webscalelabs|google|meta|facebook|instagram|linkedin|whatsapp|tiktok|snapchat|youtube|twitter|shopify|apple|iphone)\b/i;

const PERSON_WORDS = /\b(person|people|man|woman|men|women|founder|owner|marketer|designer|developer|strategist|analyst|creator|editor|salesperson|customer|he|she|his|her|him|they|their|hands?|arms?|face|eyes|fingers?|someone|colleague|team|worker|staff|client)\b/i;

/** Words that put a human in the frame. Roles used as possessives ("founder's desk") are fine in a scene. */
const HUMAN_BODY = /\b(person|people|human|man|woman|men|women|he|she|his|her|him|hands?|arms?|faces?|fingers?|someone|silhouettes?|body|bodies|figure)\b/i;

function checkHero(where: string, s: unknown, r: Report, format: Format) {
  if (!checkText(where, s, r)) return;
  const n = words(s).length;
  const photo = format === "people" || format === "scene";
  const [min, aim, max] = photo ? [50, "70 to 170", 240] : [40, "60 to 140", 220];
  if (n < min) r.warnings.push(`${where}: ${n} words; the description should be concrete and detailed (aim for ${aim})`);
  if (n > max) r.warnings.push(`${where}: ${n} words; keep it to one recognisable scene`);
  if (/\b(google|meta|facebook|instagram|linkedin|shopify|hubspot|salesforce|wordpress|whatsapp|tiktok|snapchat|apple|iphone|macbook)\b/i.test(s))
    r.warnings.push(`${where}: names a third-party brand; devices and interfaces must be generic and unbranded`);
  if (photo && /#[0-9a-f]{6}\b/i.test(s))
    r.warnings.push(`${where}: contains a colour code; the photo templates set the grade and palette, keep colours out of the scene so a style change stays one edit`);
  if (photo && /\b(3D|CGI|render(ed)?|hologra\w*|floating)\b/i.test(s))
    r.errors.push(`${where}: describes a 3D render, hologram or floating element; photo formats must be a real photographed scene`);
  const stripped = s.replace(/\b(no|without|free of|absent of) (people|persons?|humans?|one|hands?|figures?)\b/gi, "");
  if (format === "scene" && HUMAN_BODY.test(stripped))
    r.errors.push(`${where}: mentions a person or body part ("${stripped.match(HUMAN_BODY)?.[0]}"); photo-without-people scenes must contain no humans`);
  if (format === "people" && !PERSON_WORDS.test(s))
    r.warnings.push(`${where}: does not seem to describe a person; photo-with-a-person scenes need one dominant subject`);
}

export function checkSingle(single: unknown, r: Report, format: Format = "dark", where = "single") {
  if (!single || typeof single !== "object") {
    r.errors.push(`${where}: missing`);
    return;
  }
  const s = single as Partial<SingleSpec>;
  checkHeadline(where, s.headline, s.cyan, r);
  checkSupporting(`${where}.supporting`, s.supporting, r, s.headline);
  checkHero(`${where}.hero`, s.hero, r, format);
  if (!LAYOUTS.includes(s.layout as never)) r.errors.push(`${where}.layout: must be A, B or C`);
}

export function checkCarousel(carousel: unknown, r: Report, format: Format = "dark", where = "carousel") {
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
      checkSupporting(`${w}.supporting`, s.supporting, r, s.headline);
    }
    checkHero(`${w}.hero`, s.hero, r, format);
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
  if (i.format != null && !FORMATS.includes(i.format)) r.errors.push(`format: must be one of ${FORMATS.join(", ")}`);
  const format: Format = FORMATS.includes(i.format as Format) ? (i.format as Format) : "dark";
  checkSingle(i.single, r, format);
  checkCarousel(i.carousel, r, format);
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
    format: input.format ?? "dark",
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
