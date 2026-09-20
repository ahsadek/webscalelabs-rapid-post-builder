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
  /** Optional: the service the post is about, for filtering. */
  service?: string | null;
  single: SingleSpec;
  carousel: SlideSpec[];
}

export interface Idea extends IdeaInput {
  id: number;
  service: string | null;
  status: Status;
  createdAt: string;
  updatedAt: string;
}

export type PromptKey =
  | "singleTemplate"
  | "carouselTemplate"
  | "layoutA"
  | "layoutB"
  | "layoutC"
  | "captionMain"
  | "captionAhmed"
  | "captionSalman"
  | "captionYoussef";

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
