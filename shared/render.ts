/**
 * Turns an idea plus the shared templates into the exact text to paste into the image generator
 * or the caption chat. Pure functions, used by the UI and the ideas CLI.
 */
import { CAPTION_KEYS, CAROUSEL_LAYOUTS, FORMAT_PROMPTS, SLIDE_ROLES, type Format, type Idea, type IdeaInput, type PromptKey, type PromptMap } from "./types.js";

/** Minimal mustache: {{key}}, {{#flag}}...{{/flag}} (kept when true) and {{^flag}}...{{/flag}} (kept when false). */
export function fill(template: string, vars: Record<string, string | boolean>): string {
  let out = template.replace(/\{\{([#^])(\w+)\}\}([\s\S]*?)\{\{\/\2\}\}/g, (_m, kind: string, key: string, body: string) => {
    const on = Boolean(vars[key]);
    return (kind === "#") === on ? body : "";
  });
  out = out.replace(/\{\{(\w+)\}\}/g, (m, key: string) => {
    const v = vars[key];
    return typeof v === "string" ? v : m;
  });
  return out;
}

const headlineText = (lines: string[]) => lines.map((l) => l.trim()).join(" / ");

export const formatOf = (idea: Pick<IdeaInput, "format">): Format => idea.format ?? "dark";

export interface RenderOptions {
  /** Photo-with-a-person only: the subject is the real person in the photos attached to the chat. */
  referencePerson?: boolean;
}

/** The shared reference-person block goes first, so it frames every rule that follows. */
function withReference(idea: IdeaInput, text: string, prompts: PromptMap, opts?: RenderOptions): string {
  if (!opts?.referencePerson || formatOf(idea) !== "people" || !prompts.peopleReference) return text;
  return prompts.peopleReference + "\n\n" + text;
}

export function renderSingle(idea: IdeaInput, prompts: PromptMap, opts?: RenderOptions): string {
  const s = idea.single;
  const keys = FORMAT_PROMPTS[formatOf(idea)];
  const text = fill(prompts[keys.single], {
    hero: s.hero,
    layout: prompts[keys.layout[s.layout]],
    headline: headlineText(s.headline),
    cyan: s.cyan,
    supporting: s.supporting,
  });
  return withReference(idea, text, prompts, opts);
}

export function renderSlide(idea: IdeaInput, index: number, prompts: PromptMap, opts?: RenderOptions): string {
  const s = idea.carousel[index];
  const keys = FORMAT_PROMPTS[formatOf(idea)];
  const text = fill(prompts[keys.carousel], {
    n: String(index + 1),
    topic: s.topic.replace(/\.$/, ""),
    hero: s.hero,
    layout: prompts[keys.layout[CAROUSEL_LAYOUTS[index]]],
    headline: headlineText(s.headline),
    cyan: s.cyan,
    supporting: s.supporting,
    cta: index === 3,
  });
  return withReference(idea, text, prompts, opts);
}

export const renderCarousel = (idea: IdeaInput, prompts: PromptMap, opts?: RenderOptions): string[] =>
  idea.carousel.map((_s, i) => renderSlide(idea, i, prompts, opts));

/**
 * A caption prompt for the given profile. The master prompt expects the image to be attached; the
 * post's text is appended as well so the writer has it even when the image is not attached.
 */
export function renderCaption(idea: IdeaInput, key: PromptKey, variant: "single" | "carousel", prompts: PromptMap): string {
  if (!CAPTION_KEYS.some((c) => c.key === key)) throw new Error("Not a caption prompt: " + key);
  const q = (s: string) => `"${s}"`;
  let ref: string;
  if (variant === "single") {
    ref =
      `The attached post is a single image.\n` +
      `Headline: ${q(idea.single.headline.join(" "))}\n` +
      `Supporting line: ${q(idea.single.supporting)}`;
  } else {
    ref =
      `The attached post is a 4-slide carousel.\n` +
      idea.carousel
        .map((s, i) => `Slide ${i + 1} (${SLIDE_ROLES[i]}): ${q(s.headline.join(" "))} Supporting line: ${q(s.supporting)}`)
        .join("\n");
  }
  return `${prompts[key]}\n\nFOR REFERENCE, THE TEXT IN THE ATTACHED POST\n${ref}`;
}

/** File-name friendly slug for the stamp step and exports. */
export const slug = (idea: Pick<Idea, "title">) =>
  idea.title.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase().slice(0, 40);
