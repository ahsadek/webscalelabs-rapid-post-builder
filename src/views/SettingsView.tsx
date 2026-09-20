import { useEffect, useState } from "react";
import type { Bootstrap, Prompt, PromptKey } from "../types";

interface Props {
  prompts: Prompt[];
  defaults: Bootstrap["defaults"];
  onSavePrompt: (key: PromptKey, body: string) => Promise<unknown>;
}

const TEMPLATE_KEYS: PromptKey[] = ["singleTemplate", "carouselTemplate", "layoutA", "layoutB", "layoutC"];

export function SettingsView({ prompts, defaults, onSavePrompt }: Props) {
  const templates = prompts.filter((p) => TEMPLATE_KEYS.includes(p.key));
  const captions = prompts.filter((p) => !TEMPLATE_KEYS.includes(p.key));
  return (
    <section className="settings">
      <h2 className="page-title">Shared prompts.</h2>
      <p className="lead">Everything here is shared: a change saves to the database and every teammate sees it on their next load. The two image templates wrap every idea in the bank, so one edit here changes every single-slide and carousel prompt at once. Changing them is a team decision.</p>

      <h3 className="section">Image prompt templates</h3>
      <p className="hint" style={{ margin: "0 0 12px" }}>
        The variable parts are placeholders the app fills from each idea: <code>{"{{hero}}"}</code>, <code>{"{{layout}}"}</code>, <code>{"{{headline}}"}</code>, <code>{"{{cyan}}"}</code>, <code>{"{{supporting}}"}</code>, and for carousels <code>{"{{n}}"}</code>, <code>{"{{topic}}"}</code> and the <code>{"{{#cta}}"}</code> block that only renders on slide 4. Keep them.
      </p>
      {templates.map((p) => (
        <PromptEditor key={p.key} label={p.label} value={p.body} dflt={defaults.prompts[p.key]} onSave={(v) => onSavePrompt(p.key, v)} />
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
