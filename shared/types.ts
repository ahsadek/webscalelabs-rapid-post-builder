/**
 * Shared shapes. One post idea carries everything that differs from post to post; the fixed text
 * (typography, colours, forbidden list) lives in the prompt templates and is rendered around it.
 */

export type Status = "Unused" | "Used";
export const STATUSES: Status[] = ["Unused", "Used"];

export const SERVICES = [
  "Social Media Marketing",
  "SEO",
  "Google Ads",
  "Meta Ads",
  "Content Creation",
  "Email Marketing",
  "Branding and Identity",
  "Graphic Design",
  "Motion Graphics",
  "UI/UX Design",
  "Website Development",
  "E-Commerce Solutions",
  "Conversion Rate Optimization",
] as const;
export type Service = (typeof SERVICES)[number];

export const PILLARS = [
  "Social proof and client results",
  "Educational content about digital marketing",
  "Pain points of business owners",
  "What makes WebScaleLabs different",
  "Services and what they actually do for a business",
] as const;
export type Pillar = (typeof PILLARS)[number];

/**
 * Visual formats. Each has its own single-slide template, carousel template and layout wording in the
 * prompts table; an idea stores only the visual description ("hero") written for its format.
 *   dark   : 3D hero object on near-black (the original master prompt)
 *   light  : 3D hero object on white
 *   people : full-bleed editorial photograph with one dominant person
 *   scene  : full-bleed editorial photograph of a real environment, no people
 */
export const FORMATS = ["dark", "light", "people", "scene"] as const;
export type Format = (typeof FORMATS)[number];
export const FORMAT_LABELS: Record<Format, string> = {
  dark: "Dark 3D",
  light: "Light 3D",
  people: "Photo with a person",
  scene: "Photo without people",
};
/** Where the image prompt is pasted. Gemini handles people better in the team's tests. */
export const FORMAT_TOOL: Record<Format, string> = {
  dark: "ChatGPT",
  light: "ChatGPT",
  people: "Gemini (Nano Banana Pro)",
  scene: "ChatGPT",
};

export type Layout = "A" | "B" | "C";
export const LAYOUTS: Layout[] = ["A", "B", "C"];

/** Carousel layouts are fixed by the master prompt: A, B, A, C. */
export const CAROUSEL_LAYOUTS: Layout[] = ["A", "B", "A", "C"];
export const CAROUSEL_CTA = "Get your free digital audit at webscalelabs.co/free-digital-audit";
export const SLIDE_ROLES = ["Hook", "The problem", "The solution", "The outcome + CTA"] as const;

/** The single-slide post. */
export interface SingleSpec {
  /** 2 or 3 lines, ALL CAPS, last line ends with a full stop. */
  headline: string[];
  /** One word of the headline, rendered in cyan. */
  cyan: string;
  /** Sentence case, 8 to 12 words (14 max). */
  supporting: string;
  /** The 3D hero object or interface scene, in concrete visual detail. */
  hero: string;
  layout: Layout;
}

/** One carousel slide. Slide 4's supporting line is ignored: the template renders the fixed CTA. */
export interface SlideSpec {
  /** One short phrase: what this slide is about. No trailing full stop. */
  topic: string;
  headline: string[];
  cyan: string;
  supporting: string;
  hero: string;
}

export interface IdeaInput {
  title: string;
  pillar: Pillar;
  /** Visual format; defaults to "dark" when missing. */
  format?: Format;
  /** Optional: the service the post is about, for filtering. */
  service?: string | null;
  single: SingleSpec;
  carousel: SlideSpec[];
}

export interface Idea extends IdeaInput {
  id: number;
  format: Format;
  service: string | null;
  status: Status;
  createdAt: string;
  updatedAt: string;
}

type FormatPromptKey<P extends string> = `${P}Single` | `${P}Carousel` | `${P}LayoutA` | `${P}LayoutB` | `${P}LayoutC`;

export type PromptKey =
  | "singleTemplate"
  | "carouselTemplate"
  | "layoutA"
  | "layoutB"
  | "layoutC"
  | FormatPromptKey<"light">
  | FormatPromptKey<"people">
  | FormatPromptKey<"scene">
  | "peopleReference"
  | "captionMain"
  | "captionAhmed"
  | "captionSalman"
  | "captionYoussef";

/** Which prompt rows each format uses. Dark keeps its original key names. */
export const FORMAT_PROMPTS: Record<Format, { single: PromptKey; carousel: PromptKey; layout: Record<Layout, PromptKey> }> = {
  dark: { single: "singleTemplate", carousel: "carouselTemplate", layout: { A: "layoutA", B: "layoutB", C: "layoutC" } },
  light: { single: "lightSingle", carousel: "lightCarousel", layout: { A: "lightLayoutA", B: "lightLayoutB", C: "lightLayoutC" } },
  people: { single: "peopleSingle", carousel: "peopleCarousel", layout: { A: "peopleLayoutA", B: "peopleLayoutB", C: "peopleLayoutC" } },
  scene: { single: "sceneSingle", carousel: "sceneCarousel", layout: { A: "sceneLayoutA", B: "sceneLayoutB", C: "sceneLayoutC" } },
};

export const CAPTION_KEYS: { key: PromptKey; short: string }[] = [
  { key: "captionMain", short: "Main profiles" },
  { key: "captionAhmed", short: "Ahmed" },
  { key: "captionSalman", short: "Salman" },
  { key: "captionYoussef", short: "Youssef" },
];

export interface Prompt {
  key: PromptKey;
  label: string;
  body: string;
}

export type PromptMap = Record<PromptKey, string>;

export interface Bootstrap {
  ideas: Idea[];
  prompts: Prompt[];
  defaults: { prompts: Record<string, string> };
}
