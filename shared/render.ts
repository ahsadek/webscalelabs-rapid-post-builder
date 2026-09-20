/**
 * Turns an idea plus the shared templates into the exact text to paste into the image generator
 * or the caption chat. Pure functions, used by the UI and the ideas CLI.
 */
import { CAPTION_KEYS, CAROUSEL_LAYOUTS, SLIDE_ROLES, type Idea, type IdeaInput, type PromptKey, type PromptMap } from "./types.js";

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

export function renderSingle(idea: IdeaInput, prompts: PromptMap): string {
  const s = idea.single;
  return fill(prompts.singleTemplate, {
    hero: s.hero,
    layout: prompts[`layout${s.layout}` as PromptKey],
    headline: headlineText(s.headline),
    cyan: s.cyan,
    supporting: s.supporting,
  });
}

export function renderSlide(idea: IdeaInput, index: number, prompts: PromptMap): string {
  const s = idea.carousel[index];
  return fill(prompts.carouselTemplate, {
    n: String(index + 1),
    topic: s.topic.replace(/\.$/, ""),
    hero: s.hero,
    layout: prompts[`layout${CAROUSEL_LAYOUTS[index]}` as PromptKey],
    headline: headlineText(s.headline),
    cyan: s.cyan,
    supporting: s.supporting,
    cta: index === 3,
  });
}

export const renderCarousel = (idea: IdeaInput, prompts: PromptMap): string[] =>
  idea.carousel.map((_s, i) => renderSlide(idea, i, prompts));

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
