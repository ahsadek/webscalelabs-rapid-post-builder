import { useState } from "react";
import type { Format, Idea, IdeaInput } from "../types";
import { Field, useToast } from "../ui";

interface Props {
  formats: Format[];
  initial?: Idea;
  submitLabel: string;
  onSubmit: (input: IdeaInput) => Promise<unknown> | void;
  onCancel: () => void;
}

const COPY_PLACEHOLDER = 'Headline: "..."\nLine 1: "..."\nKicker: "..."\nCyan element: "..."';

export function IdeaForm({ formats, initial, submitLabel, onSubmit, onCancel }: Props) {
  const toast = useToast();
  const [formatId, setFormatId] = useState<number>(initial?.formatId ?? formats[0]?.id ?? 0);
  const [title, setTitle] = useState(initial?.title ?? "");
  const [gist, setGist] = useState(initial?.gist ?? "");
  const [copy, setCopy] = useState(initial?.copy ?? "");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!title.trim() || !gist.trim() || !copy.trim()) {
      toast("Fill the idea, gist and copy");
      return;
    }
    setBusy(true);
    try {
      await onSubmit({ formatId, title: title.trim(), gist: gist.trim(), copy: copy.trim() });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="panel">
      <div className="grid2">
        <Field label="Format" htmlFor="niFmt">
          <select id="niFmt" value={formatId} onChange={(e) => setFormatId(Number(e.target.value))}>
            {formats.map((f) => (
              <option key={f.id} value={f.id}>{f.name}</option>
            ))}
          </select>
        </Field>
        <Field label="Post idea" htmlFor="niTitle">
          <input id="niTitle" placeholder="Short topic, for you" value={title} onChange={(e) => setTitle(e.target.value)} />
        </Field>
      </div>
      <Field label="Gist (becomes the content slides)" htmlFor="niGist">
        <textarea id="niGist" value={gist} onChange={(e) => setGist(e.target.value)} />
      </Field>
      <Field label="In-image copy (same pattern as the others: Headline / Line 1 / Kicker / Cyan element)" htmlFor="niCopy">
        <textarea id="niCopy" className="mono" style={{ minHeight: 140 }} placeholder={COPY_PLACEHOLDER} value={copy} onChange={(e) => setCopy(e.target.value)} />
      </Field>
      <div className="row">
        <button className="btn" onClick={submit} disabled={busy}>{submitLabel}</button>
        <button className="btn ghost" onClick={onCancel} disabled={busy}>Cancel</button>
      </div>
    </div>
  );
}
