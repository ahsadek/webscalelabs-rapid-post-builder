import { useState } from "react";
import type { Idea, PromptKey, PromptMap, Status } from "../types";
import { CAPTION_KEYS, PILLAR_COLORS, STATUSES } from "../types";
import { renderCaption, renderCarousel, renderSingle } from "../../shared/render";
import { OutBlock, copyText, useToast } from "../ui";

type Variant = "single" | "carousel";

interface Props {
  idea: Idea;
  prompts: PromptMap;
  onStatus: (s: Status) => void;
  onEdit: () => void;
  onDelete: () => void;
  onBack: () => void;
}

export function IdeaDetail({ idea, prompts, onStatus, onEdit, onDelete, onBack }: Props) {
  const [variant, setVariant] = useState<Variant | null>(null);
  const toast = useToast();

  const copyCaption = (key: PromptKey) => {
    if (!variant) return;
    copyText(renderCaption(idea, key, variant, prompts)).then(() => toast("Caption prompt copied"));
  };

  return (
    <div className="detail" style={{ "--fmt": PILLAR_COLORS[idea.pillar] } as React.CSSProperties}>
      <button className="btn ghost sm back" onClick={onBack}>← All ideas</button>
      <div className="eyebrow-row">
        <span className="fmt-tag">{idea.pillar}</span>
        {idea.service && <span className="fmt-tag plain">{idea.service}</span>}
      </div>
      <h2>{idea.title}</h2>
      <p className="gist">
        {idea.single.headline.join(" ")} <span className="muted">{idea.single.supporting}</span>
      </p>

      <div className="row between">
        <div className="row" style={{ margin: 0 }}>
          <span className="hint">Status</span>
          <select className="status-sel" value={idea.status} onChange={(e) => onStatus(e.target.value as Status)}>
            {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div className="row" style={{ margin: 0 }}>
          <button className="btn ghost sm" onClick={onEdit}>Edit</button>
          <button className="btn danger sm" onClick={onDelete}>Delete</button>
        </div>
      </div>

      <p className="lead">Post it as one image or as a 4-slide carousel. Both are ready; pick one.</p>
      <div className="actions two">
        <button className="act" aria-pressed={variant === "single"} onClick={() => setVariant("single")}>
          <span className="n">01</span>
          <b>Single-slide post</b>
          <small>One image prompt. Layout {idea.single.layout}.</small>
        </button>
        <button className="act" aria-pressed={variant === "carousel"} onClick={() => setVariant("carousel")}>
          <span className="n">02</span>
          <b>Carousel post</b>
          <small>Four image prompts, one per slide. Hook, problem, solution, outcome.</small>
        </button>
      </div>

      {variant === "single" && (
        <div className="panel">
          <h3>Single-slide image prompt</h3>
          <p>Paste into a new ChatGPT conversation and generate.</p>
          <OutBlock text={renderSingle(idea, prompts)} label=" Proofread the generated image's text character for character, then stamp the logo and the counter." />
        </div>
      )}

      {variant === "carousel" && (
        <div className="panel">
          <h3>Carousel image prompts</h3>
          <p>One prompt per slide. Generate each in the same ChatGPT conversation so the four stay consistent, and attach slide 1 as the reference for the others if the style drifts.</p>
          {renderCarousel(idea, prompts).map((text, i) => (
            <details key={i} className="slide">
              <summary>
                <span className="n">SLIDE {i + 1}</span>
                <b>{idea.carousel[i].headline.join(" ")}</b>
              </summary>
              <div className="in">
                <OutBlock text={text} label={`Slide ${i + 1} of 4.`} />
              </div>
            </details>
          ))}
        </div>
      )}

      {variant && (
        <div className="panel">
          <h3>Caption</h3>
          <p>Copy one, paste it into a ChatGPT conversation and attach the finished image{variant === "carousel" ? "s" : ""}. The post's text is included under the prompt as well.</p>
          <div className="row captions">
            {CAPTION_KEYS.map((c) => (
              <button key={c.key} className="btn" onClick={() => copyCaption(c.key)}>
                {c.short}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
