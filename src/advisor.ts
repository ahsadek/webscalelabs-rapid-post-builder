/**
 * Builds the "where do I change this?" prompt. It explains how the prompt system is
 * structured and assembled, embeds the live text of every prompt from the database,
 * and asks the model to answer with exact locations and exact replacement text.
 *
 * The map below is generated from code and data on every call, so it cannot drift
 * from the app: formats are listed from the database, prompt texts are the live ones.
 */
import type { Format, Prompt } from "./types";
import { DEFAULT_CTA, REFERENCE_HEAD } from "./prompts";

const LABELS: Record<string, string> = {
  brand: "Brand block",
  captionRules: "Caption rules",
  slideCopy: "Slide copy prompt",
  contentSlide: "Content slide prompt",
  platformCaption: "Platform caption spec",
};

const fence = (title: string, body: string) => `----- ${title} -----\n${body.trim()}\n----- end of ${title} -----`;

export function buildAdvisorPrompt(request: string, prompts: Prompt[], formats: Format[]): string {
  const byKey = Object.fromEntries(prompts.map((p) => [p.key, p]));
  const formatNames = formats.map((f) => `"${f.name}"`).join(", ");

  const map = `You are helping a small team maintain the prompt system behind "Rapid Post Builder", an internal web app made by WebScale Labs. The app turns a bank of post ideas into social media carousels: it assembles prompts that the team pastes into ChatGPT (with image generation) to render each slide. Nothing is generated inside the app itself; the app only stores text and assembles prompts.

The team wants to change something (or has a question) and needs to know EXACTLY which stored text to edit, where to find it in the app, and what to type. Their request is at the very end of this message. All the current prompt texts are included below, verbatim, so you can quote them.

======================================================================
1. THE PIECES OF TEXT THAT EXIST, AND WHERE EACH ONE LIVES IN THE APP
======================================================================

A) SHARED PROMPTS (global, apply to every post). Found on the "Settings" page, section "Shared prompts". Each one is a collapsible editor with a Save button and a "Reset to default" button. There are exactly five:
  1. "Brand block": the visual rulebook for every generated image (canvas, colours, typography, layout principles, forbidden things, text rendering rules). It is pasted at the top of EVERY image prompt (thumbnail and content slides). Change this for anything about how ALL images look.
  2. "Caption rules": the writing rules (voice, banned words, approved CTAs, per-platform caption lengths). They are pasted into the Slide copy prompt, so they govern the wording of content slides, and the team reads them by hand when writing platform captions.
  3. "Slide copy prompt": the TEXT-ONLY prompt that turns an idea's Gist into slide headers and bodies (step 02). It contains the placeholders [PASTE CAPTION RULES], [paste the row's In-image copy] and [paste the row's Gist], which the app fills in. Change this for anything about how content-slide copy is written or shaped (number of slides, header/body limits, output format, the fixed final-slide CTA line).
  4. "Content slide prompt": the IMAGE prompt layout for slides 2..N (step 03). Change this for anything about how content slides (not the thumbnail) look: header size, body rules, final-slide CTA rendering.
  5. "Platform caption spec": how to write the short LinkedIn / Instagram / Facebook caption by hand. It is never assembled into another prompt; the team just reads it in Settings.

B) FORMAT PROMPTS (one per thumbnail format). Found on the "Settings" page, section "Formats". Each format is a collapsible editor with these fields: "Format name", "Eyebrow label" (the text after the ● in the pill, e.g. THE MATH), "Colour in the idea list" (purely cosmetic, only used in the app's sidebar), and "Format prompt (layout section)". The current formats are: ${formatNames}.
  - The format prompt describes the thumbnail (slide 1) layout for that format only. Change it for anything specific to one format's thumbnail.
  - It must keep two placeholder lines: "[BRAND BLOCK PASTED ABOVE THIS LINE]" as the first line (the app removes it and puts the Brand block there) and "[paste the row's In-image copy here]" at the end (the app replaces it with the idea's In-image copy).
  - GOTCHA: the eyebrow text appears in TWO places that must agree: inside the format prompt (e.g. 'eyebrow pill reading "● THE MATH"') and in the format's separate "Eyebrow label" field, which the app inserts into the Content slide prompt so slides 2..N show the same pill. Changing an eyebrow means editing both.

C) PER-IDEA TEXT (specific to one post). Found on the "Prompts" page: pick the idea in the left list, then press "Edit". Each idea has:
  - "Format": which format prompt is used for its thumbnail.
  - "Post idea": a short internal title. It is NEVER inserted into any prompt; it only labels the idea in the list.
  - "Gist": the point of the post. Inserted ONLY into the Slide copy prompt (it never enters an image prompt).
  - "In-image copy": the exact thumbnail text in the pattern Headline / Line 1 / Line 2 / Kicker / Cyan element (or Left / Right for the "This, not that" format). Inserted into the Thumbnail prompt (as the TEXT TO RENDER) and into the Slide copy prompt (so the model knows what slide 1 already says).
  - "Status": Unused / Drafted / Posted. Never enters a prompt.
  Anything that should change for ONE post only belongs here. Anything that should change for ALL posts belongs in A or B.

D) TEXT THAT IS HARD-CODED IN THE APP (needs a developer, not an edit in Settings):
  - The reference-image line added at the top of image prompts when the checkbox "I have a reference image for this format" is ticked: "${REFERENCE_HEAD.trim()}"
  - The default CTA line pre-filled in the Content slide panel: "${DEFAULT_CTA}" (the person can overwrite it per slide in the panel; the same wording also appears inside the Slide copy prompt and the Content slide prompt texts, which ARE editable).
  - The automatic checks in the Content slide panel: header max 6 words, must end with a full stop, no questions, must not open with "We", no dashes; body max 25 words, one paragraph, no em dashes, no hedging words. These mirror rules written in the Slide copy prompt. Changing a limit means editing the Slide copy prompt AND asking a developer to update the checker.
  - The Stamp page (logo and slide counter) works on finished images and involves no prompt text at all; the Brand block only tells the model to keep the top-right corner and bottom margin empty for them.

======================================================================
2. HOW THE APP ASSEMBLES THE THREE PROMPTS THE TEAM ACTUALLY PASTES
======================================================================

Step 01, "Thumbnail prompt" (image conversation, slide 1):
  [reference line, only if the checkbox is ticked] + Brand block + blank line + Format prompt of the idea's format, with its first placeholder line removed and "[paste the row's In-image copy here]" replaced by the idea's In-image copy.

Step 02, "Slide copy prompt" (separate text-only conversation):
  Slide copy prompt with [PASTE CAPTION RULES] replaced by Caption rules, [paste the row's In-image copy] replaced by the idea's In-image copy, and [paste the row's Gist] replaced by the idea's Gist.

Step 03, "Content slide prompt" (same image conversation as step 01, one prompt per slide):
  [reference line, only if the checkbox is ticked] + Brand block + blank line + Content slide prompt with its first placeholder line removed, the sentence "the same eyebrow pill as the reference image, same position." extended with 'reading "● <Eyebrow label of the format>"', and everything from "TEXT TO RENDER:" onward REPLACED by the app with: a note saying whether this is the final slide, then Header: "...", Body: "..." typed in the panel, plus a CTA line if it is the final slide. So any text you put after "TEXT TO RENDER:" in the Content slide prompt is never sent; edit the part above it.

Platform caption spec and Caption rules are read by hand for the caption; they are not assembled into a prompt (Caption rules are also pasted into step 02).

======================================================================
3. HOW TO ANSWER
======================================================================

Answer in plain language, in this exact structure, and repeat it once per edit if more than one edit is needed:

  WHAT TO CHANGE: one sentence.
  WHERE IN THE APP: page > section > editor or field name (for example: Settings > Shared prompts > Brand block; or Settings > Formats > "Math post" > Format prompt; or Prompts > idea "<title>" > Edit > In-image copy).
  FIND THIS TEXT: the exact current text to locate, quoted verbatim from the prompts below.
  REPLACE WITH: the exact new text, ready to paste.
  WHY HERE: one sentence on why this location and not another, and which of the three assembled prompts (step 01, 02, 03) the change flows into.

Rules:
  - Be precise about global vs per-post. If the request affects every post, never propose editing an idea; if it affects one post, never propose editing a shared or format prompt.
  - If the same wording lives in several places (for example the CTA sentence, the eyebrow text, or a rule mirrored by the app's checker), list every place, including hard-coded ones that need a developer.
  - Do not rewrite prompts wholesale. Propose the smallest edit that achieves the request, and keep the placeholder lines intact.
  - If the request is a question rather than a change, answer it, then say which text it relates to using the same WHERE IN THE APP wording.
  - If the request is ambiguous, state the assumption you are making in one line, then answer.`;

  const live = [
    fence("SHARED PROMPT: Brand block", byKey.brand?.body ?? ""),
    fence("SHARED PROMPT: Caption rules", byKey.captionRules?.body ?? ""),
    fence("SHARED PROMPT: Slide copy prompt", byKey.slideCopy?.body ?? ""),
    fence("SHARED PROMPT: Content slide prompt", byKey.contentSlide?.body ?? ""),
    fence("SHARED PROMPT: Platform caption spec", byKey.platformCaption?.body ?? ""),
    ...formats.map((f) => fence(`FORMAT PROMPT: "${f.name}" (Eyebrow label: ${f.eyebrow})`, f.prompt)),
  ].join("\n\n");

  return `${map}

======================================================================
4. THE CURRENT TEXTS, VERBATIM
======================================================================

${live}

======================================================================
5. THE TEAM'S REQUEST
======================================================================

${request.trim()}`;
}

export const PROMPT_LABELS = LABELS;
