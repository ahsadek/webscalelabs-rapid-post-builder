import { useState } from "react";
import type { Format, Idea, Status } from "../types";
import { STATUSES } from "../types";
import { Field, OutBlock } from "../ui";
import {
  DEFAULT_CTA,
  bodyIssues,
  contentSlidePrompt,
  extract,
  headerIssues,
  slideCopyPrompt,
  thumbnailPrompt,
  type PromptMap,
} from "../prompts";

type Action = "thumb" | "copy" | "slide";

interface Props {
  idea: Idea;
  format: Format | undefined;
  prompts: PromptMap;
  onStatus: (s: Status) => void;
  onToggleMaster: (f: Format, hasMaster: boolean) => void;
  onEdit: () => void;
  onDelete: () => void;
  onBack: () => void;
}

const ACTIONS: [Action, string, string, string][] = [
  ["thumb", "01", "Thumbnail prompt", "Slide 1. Brand block, format layout, this row’s copy."],
  ["copy", "02", "Copy prompt", "Text step. Turns the gist into slide headers, bodies and the post caption."],
  ["slide", "03", "Content slide(s) prompt", "One per slide. Paste a header and body from step 02."],
];

export function IdeaDetail({ idea, format, prompts, onStatus, onToggleMaster, onEdit, onDelete, onBack }: Props) {
  const [action, setAction] = useState<Action | null>(null);

  if (!format) {
    return (
      <div className="detail">
        <div className="empty">This idea points at a format that no longer exists. Edit it and pick a format.</div>
        <div className="row"><button className="btn ghost" onClick={onEdit}>Edit idea</button></div>
      </div>
    );
  }

  return (
    <div className="detail" style={{ "--fmt": format.color } as React.CSSProperties}>
      <button className="btn ghost sm back" onClick={onBack}>← All ideas</button>
      <div className="eyebrow-row">
        <span className="fmt-tag">{format.name}</span>
      </div>
      <h2>{extract(idea.copy, "Headline") || idea.title}</h2>
      <p className="gist">{idea.gist}</p>

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

      <div className="actions">
        {ACTIONS.map(([k, n, t, s]) => (
          <button key={k} className="act" aria-pressed={action === k} onClick={() => setAction(k)}>
            <span className="n">{n}</span>
            <b>{t}</b>
            <small>{s}</small>
          </button>
        ))}
      </div>

      {action === "thumb" && <PanelThumb idea={idea} format={format} prompts={prompts} onToggleMaster={onToggleMaster} />}
      {action === "copy" && <PanelCopy idea={idea} prompts={prompts} />}
      {action === "slide" && <PanelSlide format={format} prompts={prompts} onToggleMaster={onToggleMaster} />}
    </div>
  );
}

function PanelThumb({ idea, format, prompts, onToggleMaster }: { idea: Idea; format: Format; prompts: PromptMap; onToggleMaster: Props["onToggleMaster"] }) {
  const withMaster = format.hasMaster;
  return (
    <div className="panel">
      <h3>Thumbnail (slide 1)</h3>
      <p>Generate in a new conversation. Proofread against the copy character for character, check the single cyan element, then keep the conversation open for the slides.</p>
      <div className="row check">
        <input type="checkbox" id="wm" checked={withMaster} onChange={(e) => onToggleMaster(format, e.target.checked)} />
        <label htmlFor="wm">I have a reference image for this format (adds the reference instruction)</label>
      </div>
      <OutBlock
        text={thumbnailPrompt(idea, format, prompts, withMaster)}
        label={withMaster ? "Attach this format’s master image before sending." : "Paste into a new ChatGPT conversation. Stay in it for the whole carousel."}
      />
    </div>
  );
}

function PanelCopy({ idea, prompts }: { idea: Idea; prompts: PromptMap }) {
  return (
    <div className="panel">
      <h3>Copy (text step)</h3>
      <p>Run in a separate text conversation with no images. It gives you the slide headers and bodies plus the post caption. Check every header against the rules before rendering; the checker in step 03 will flag anything over the limit.</p>
      <OutBlock text={slideCopyPrompt(idea, prompts)} label="Paste into a text-only conversation." />
    </div>
  );
}

function PanelSlide({ format, prompts, onToggleMaster }: { format: Format; prompts: PromptMap; onToggleMaster: Props["onToggleMaster"] }) {
  const withMaster = format.hasMaster;
  const [header, setHeader] = useState("");
  const [body, setBody] = useState("");
  const [isFinal, setIsFinal] = useState(false);
  const [cta, setCta] = useState(DEFAULT_CTA);

  const hi = headerIssues(header);
  const bi = bodyIssues(body);
  const words = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;
  const hHint = hi.length ? hi.join(" · ") : header.trim() ? `${words(header)} words` : "Max 6 words, statement, full stop.";
  const bHint = bi.length ? bi.join(" · ") : body.trim() ? `${words(body)} words` : "One paragraph, max 25 words.";

  return (
    <div className="panel">
      <h3>Content slide(s)</h3>
      <p>One prompt per slide. Paste the header and body the slide copy step gave you. Counters and logo are added afterwards in Stamp, never here.</p>
      <Field label="Header" htmlFor="sh" hint={<div className={"hint" + (hi.length ? " bad" : "")}>{hHint}</div>}>
        <input id="sh" placeholder="Your search result sells first." value={header} onChange={(e) => setHeader(e.target.value)} />
      </Field>
      <Field label="Body" htmlFor="sb" hint={<div className={"hint" + (bi.length ? " bad" : "")}>{bHint}</div>}>
        <textarea
          id="sb"
          placeholder="Customers judge your credibility from what Google shows before they ever reach your site. Make that first impression earn the click."
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />
      </Field>
      <div className="row check" style={{ margin: "0 0 10px" }}>
        <input type="checkbox" id="swm" checked={withMaster} onChange={(e) => onToggleMaster(format, e.target.checked)} />
        <label htmlFor="swm">I have a reference image for this format (adds the reference instruction)</label>
      </div>
      <div className="row check" style={{ margin: "0 0 14px" }}>
        <input type="checkbox" id="sf" checked={isFinal} onChange={(e) => setIsFinal(e.target.checked)} />
        <label htmlFor="sf">This is the final slide (adds the CTA line)</label>
      </div>
      {isFinal && (
        <Field label="CTA line (final slide only, plain cyan text)" htmlFor="sc">
          <input id="sc" value={cta} onChange={(e) => setCta(e.target.value)} />
        </Field>
      )}
      {header.trim() && body.trim() ? (
        <OutBlock
          text={contentSlidePrompt(format, prompts, header, body, isFinal, cta, withMaster)}
          label="Same conversation as the thumbnail. Attach slide 1 as the reference."
        />
      ) : (
        <p className="hint">Fill the header and body from step 02 and the prompt appears here.</p>
      )}
    </div>
  );
}
