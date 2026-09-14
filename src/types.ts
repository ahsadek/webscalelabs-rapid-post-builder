export type Status = "Unused" | "Drafted" | "Posted";
export const STATUSES: Status[] = ["Unused", "Drafted", "Posted"];

export type PromptKey = "brand" | "captionRules" | "slideCopy" | "contentSlide" | "platformCaption";

export interface Format {
  id: number;
  name: string;
  eyebrow: string;
  color: string;
  prompt: string;
  hasMaster: boolean;
  sortOrder: number;
}

export interface Idea {
  id: number;
  formatId: number;
  title: string;
  gist: string;
  copy: string;
  status: Status;
  createdAt: string;
  updatedAt: string;
}

export interface Prompt {
  key: PromptKey;
  label: string;
  body: string;
}

export interface Bootstrap {
  formats: Format[];
  ideas: Idea[];
  prompts: Prompt[];
  defaults: {
    prompts: Record<string, string>;
    formats: Record<string, string>;
  };
}

export type IdeaInput = { formatId: number; title: string; gist: string; copy: string };
export type FormatInput = { name: string; eyebrow: string; color: string; prompt: string };
