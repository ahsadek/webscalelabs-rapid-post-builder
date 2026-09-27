import { useEffect, useState } from "react";
import type { Bootstrap, Format, Prompt, PromptKey } from "../types";
import { FORMATS, FORMAT_LABELS, FORMAT_PROMPTS } from "../types";

interface Props {
  prompts: Prompt[];
  defaults: Bootstrap["defaults"];
  onSavePrompt: (key: PromptKey, body: string) => Promise<unknown>;
}

/** The rows each format owns, in display order. The reference-person block belongs to the people format. */
const keysFor = (f: Format): PromptKey[] => {
  const k = FORMAT_PROMPTS[f];
  return [k.single, k.carousel, k.layout.A, k.layout.B, k.layout.C, ...(f === "people" ? (["peopleReference"] as PromptKey[]) : [])];
};
const TEMPLATE_KEYS = new Set(FORMATS.flatMap(keysFor));

export function SettingsView({ prompts, defaults, onSavePrompt }: Props) {
  const byKey = new Map(prompts.map((p) => [p.key, p]));
  const captions = prompts.filter((p) => !TEMPLATE_KEYS.has(p.key));
  return (
    <section className="settings">
      <h2 className="page-title">Shared prompts.</h2>
      <p className="lead">Everything here is shared: a change saves to the database and every teammate sees it on their next load. Each visual format has its own templates, and they wrap every idea of that format, so one edit here changes every single-slide or carousel prompt of that format at once. Changing them is a team decision.</p>

      <h3 className="section">Image prompt templates</h3>
      <p className="hint" style={{ margin: "0 0 12px" }}>
        The variable parts are placeholders the app fills from each idea: <code>{"{{hero}}"}</code>, <code>{"{{layout}}"}</code>, <code>{"{{headline}}"}</code>, <code>{"{{cyan}}"}</code>, <code>{"{{supporting}}"}</code>, and for carousels <code>{"{{n}}"}</code>, <code>{"{{topic}}"}</code> and the <code>{"{{#cta}}"}</code> block that only renders on slide 4. Keep them.
      </p>
      {FORMATS.map((f) => (
        <div key={f} className="format-group">
          <h4 className="format-title">{FORMAT_LABELS[f]}</h4>
          {keysFor(f)
            .map((k) => byKey.get(k))
            .filter((p): p is Prompt => Boolean(p))
            .map((p) => (
              <PromptEditor key={p.key} label={p.label} value={p.body} dflt={defaults.prompts[p.key]} onSave={(v) => onSavePrompt(p.key, v)} />
            ))}
        </div>
      ))}

      <h3 className="section">Caption prompts</h3>
      <p className="hint" style={{ margin: "0 0 12px" }}>Copied from an idea's Caption row. The app appends the post's text under the prompt at copy time; the prompt itself stays as written here.</p>
      {captions.map((p) => (
        <PromptEditor key={p.key} label={p.label} value={p.body} dflt={defaults.prompts[p.key]} onSave={(v) => onSavePrompt(p.key, v)} />
      ))}
    </section>
  );
}

function PromptEditor({ label, value, dflt, onSave }: { label: string; value: string; dflt?: string; onSave: (v: string) => Promise<unknown> }) {
  const [text, setText] = useState(value);
  useEffect(() => setText(value), [value]);
  const dirty = text !== value;
  const edited = dflt !== undefined && value !== dflt;
  return (
    <details>
      <summary>
        {label}
        {edited && <span className="meta"> · edited from default</span>}
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
