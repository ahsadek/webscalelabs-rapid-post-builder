import { useEffect, useState } from "react";
import type { Bootstrap, Format, FormatInput, Idea, Prompt, PromptKey } from "../types";
import { Field, OutBlock } from "../ui";
import { buildAdvisorPrompt } from "../advisor";

interface Props {
  prompts: Prompt[];
  formats: Format[];
  ideas: Idea[];
  defaults: Bootstrap["defaults"];
  onSavePrompt: (key: PromptKey, body: string) => Promise<unknown>;
  onSaveFormat: (id: number, input: Partial<FormatInput>) => Promise<unknown>;
  onCreateFormat: (input: FormatInput) => Promise<Format | undefined>;
  onDeleteFormat: (f: Format) => void;
}

const NEW_FORMAT_PROMPT =
  "[BRAND BLOCK PASTED ABOVE THIS LINE]\n\nLAYOUT - New format\n- Top-left: eyebrow pill reading \"● EYEBROW\".\n- ...\n\nTEXT TO RENDER:\n[paste the row's In-image copy here]";

export function SettingsView({ prompts, formats, ideas, defaults, onSavePrompt, onSaveFormat, onCreateFormat, onDeleteFormat }: Props) {
  const countByFormat = new Map<number, number>();
  for (const i of ideas) countByFormat.set(i.formatId, (countByFormat.get(i.formatId) ?? 0) + 1);

  return (
    <section className="settings">
      <h2 className="page-title">Prompts and formats.</h2>
      <p className="lead">Everything here is shared: a change saves to the database and every teammate sees it on their next load. Changing a prompt is a team decision, not a per-post tweak. The brand block goes into every image prompt, so treat edits to it with extra care.</p>

      <AdvisorPanel prompts={prompts} formats={formats} />

      <h3 className="section">Shared prompts</h3>
      {prompts.map((p) => (
        <PromptEditor key={p.key} label={p.label} value={p.body} dflt={defaults.prompts[p.key]} onSave={(v) => onSavePrompt(p.key, v)} />
      ))}

      <h3 className="section">Formats</h3>
      {formats.map((f) => (
        <FormatEditor
          key={f.id}
          format={f}
          ideaCount={countByFormat.get(f.id) ?? 0}
          dflt={defaults.formats[f.name]}
          onSave={(input) => onSaveFormat(f.id, input)}
          onDelete={() => onDeleteFormat(f)}
        />
      ))}
      <NewFormat onCreate={onCreateFormat} />
    </section>
  );
}

function PromptEditor({ label, value, dflt, onSave }: { label: string; value: string; dflt?: string; onSave: (v: string) => Promise<unknown> }) {
  const [text, setText] = useState(value);
  useEffect(() => setText(value), [value]);
  const dirty = text !== value;
  return (
    <details>
      <summary>
        {label}
        {/* {dflt !== undefined && value !== dflt && <span className="meta">edited from default</span>} */}
      </summary>
      <div className="in">
        <textarea className="mono" value={text} onChange={(e) => setText(e.target.value)} />
        <div className="row">
          <button className="btn" disabled={!dirty || !text.trim()} onClick={() => onSave(text)}>Save</button>
          {dflt !== undefined && (
            <button className="btn ghost" disabled={value === dflt && !dirty} onClick={() => { setText(dflt); if (value !== dflt) onSave(dflt); }}>
              Reset to default
            </button>
          )}
          {dirty && <span className="hint">Unsaved changes</span>}
        </div>
      </div>
    </details>
  );
}

function FormatEditor({ format, ideaCount, dflt, onSave, onDelete }: { format: Format; ideaCount: number; dflt?: string; onSave: (i: Partial<FormatInput>) => Promise<unknown>; onDelete: () => void }) {
  const [name, setName] = useState(format.name);
  const [eyebrow, setEyebrow] = useState(format.eyebrow);
  const [color, setColor] = useState(format.color);
  const [prompt, setPrompt] = useState(format.prompt);
  useEffect(() => { setName(format.name); setEyebrow(format.eyebrow); setColor(format.color); setPrompt(format.prompt); }, [format]);

  const dirty = name !== format.name || eyebrow !== format.eyebrow || color.toLowerCase() !== format.color.toLowerCase() || prompt !== format.prompt;
  const id = `f${format.id}`;

  return (
    <details style={{ "--fmt": format.color } as React.CSSProperties}>
      <summary>
        <span className="dot" />
        {format.name}
        {/* <span className="meta">{ideaCount} idea{ideaCount === 1 ? "" : "s"}{dflt !== undefined && format.prompt !== dflt ? " · prompt edited from default" : ""}</span> */}
      </summary>
      <div className="in">
        <div className="grid2">
          <Field label="Format name" htmlFor={id + "n"}>
            <input id={id + "n"} value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label="Eyebrow label (goes after the ● in the pill)" htmlFor={id + "e"}>
            <input id={id + "e"} value={eyebrow} onChange={(e) => setEyebrow(e.target.value)} />
          </Field>
        </div>
        <Field label="Colour in the idea list" htmlFor={id + "c"}>
          <div className="row" style={{ margin: 0 }}>
            <input id={id + "c"} type="color" value={color} onChange={(e) => setColor(e.target.value)} />
            <span className="hint">{color.toUpperCase()}</span>
          </div>
        </Field>
        <Field label="Format prompt (layout section)" htmlFor={id + "p"}>
          <textarea id={id + "p"} className="mono" value={prompt} onChange={(e) => setPrompt(e.target.value)} />
        </Field>
        <div className="row">
          <button className="btn" disabled={!dirty || !name.trim() || !eyebrow.trim() || !prompt.trim()} onClick={() => onSave({ name: name.trim(), eyebrow: eyebrow.trim(), color, prompt })}>
            Save
          </button>
          {dflt !== undefined && (
            <button className="btn ghost" disabled={format.prompt === dflt && prompt === dflt} onClick={() => { setPrompt(dflt); if (format.prompt !== dflt) onSave({ prompt: dflt }); }}>
              Reset prompt to default
            </button>
          )}
          <button className="btn danger" disabled={ideaCount > 0} title={ideaCount > 0 ? "Move or delete its ideas first" : undefined} onClick={onDelete}>
            Delete format
          </button>
          {dirty && <span className="hint">Unsaved changes</span>}
        </div>
      </div>
    </details>
  );
}

function NewFormat({ onCreate }: { onCreate: (i: FormatInput) => Promise<Format | undefined> }) {
  const [name, setName] = useState("");
  const [eyebrow, setEyebrow] = useState("");
  const [color, setColor] = useState("#009ab8");
  const [prompt, setPrompt] = useState(NEW_FORMAT_PROMPT);
  const [busy, setBusy] = useState(false);
  const ok = name.trim() && eyebrow.trim() && prompt.trim();

  const submit = async () => {
    setBusy(true);
    const created = await onCreate({ name: name.trim(), eyebrow: eyebrow.trim(), color, prompt });
    setBusy(false);
    if (created) { setName(""); setEyebrow(""); setPrompt(NEW_FORMAT_PROMPT); }
  };

  return (
    <details>
      <summary>Add a format</summary>
      <div className="in">
        <p className="hint" style={{ margin: "0 0 12px" }}>
          Keep the two placeholder lines: the first line is replaced by the brand block, and the last line is replaced by the row&apos;s in-image copy.
        </p>
        <div className="grid2">
          <Field label="Format name" htmlFor="nfN"><input id="nfN" placeholder="e.g. Before and after" value={name} onChange={(e) => setName(e.target.value)} /></Field>
          <Field label="Eyebrow label" htmlFor="nfE"><input id="nfE" placeholder="e.g. BEFORE AND AFTER" value={eyebrow} onChange={(e) => setEyebrow(e.target.value)} /></Field>
        </div>
        <Field label="Colour in the idea list" htmlFor="nfC">
          <div className="row" style={{ margin: 0 }}>
            <input id="nfC" type="color" value={color} onChange={(e) => setColor(e.target.value)} />
            <span className="hint">{color.toUpperCase()}</span>
          </div>
        </Field>
        <Field label="Format prompt (layout section)" htmlFor="nfP">
          <textarea id="nfP" className="mono" value={prompt} onChange={(e) => setPrompt(e.target.value)} />
        </Field>
        <div className="row">
          <button className="btn" disabled={!ok || busy} onClick={submit}>Add format</button>
        </div>
      </div>
    </details>
  );
}

function AdvisorPanel({ prompts, formats }: { prompts: Prompt[]; formats: Format[] }) {
  const [request, setRequest] = useState("");
  const ready = request.trim().length > 0;
  return (
    <details className="adv advisor">
      <summary onMouseDown={(e) => { if (e.detail > 1) e.preventDefault(); }}>Ask an AI where to change something</summary>
      <div className="in">
        <p className="hint" style={{ margin: "0 0 12px" }}>
          Describe the change you want, or ask a question. The prompt below packs in how every piece of text fits together, where each one lives in this app, and the current text of every prompt. Paste it into ChatGPT and it will tell you exactly what to edit, where, and what to type.
        </p>
        <Field label="What do you want to change or know?" htmlFor="advReq">
          <textarea
            id="advReq"
            style={{ minHeight: 110 }}
            placeholder="e.g. Make every headline end without a full stop. / Where do I change the CTA wording? / The Delete this format should use a thicker strikethrough."
            value={request}
            onChange={(e) => setRequest(e.target.value)}
          />
        </Field>
        {ready ? (
          <OutBlock text={buildAdvisorPrompt(request, prompts, formats)} label="Paste into a text-only ChatGPT conversation. Everything it needs is included." />
        ) : (
          <p className="hint">Type a request above and the prompt appears here.</p>
        )}
      </div>
    </details>
  );
}
