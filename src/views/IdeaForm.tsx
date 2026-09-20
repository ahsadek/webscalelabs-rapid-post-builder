import { useMemo, useState } from "react";
import type { Idea, IdeaInput, Layout, Pillar, SlideSpec } from "../types";
import { CAROUSEL_CTA, CAROUSEL_LAYOUTS, LAYOUTS, PILLARS, SLIDE_ROLES } from "../types";
import { validateIdea } from "../../shared/validate";
import { Field, useToast } from "../ui";

interface Props {
  initial?: Idea;
  submitLabel: string;
  onSubmit: (input: IdeaInput) => Promise<unknown> | void;
  onCancel: () => void;
}

type SlideDraft = { topic: string; headline: string; cyan: string; supporting: string; hero: string };
type Draft = {
  title: string;
  pillar: Pillar;
  service: string;
  single: { headline: string; cyan: string; supporting: string; hero: string; layout: Layout };
  carousel: SlideDraft[];
};

const emptySlide = (): SlideDraft => ({ topic: "", headline: "", cyan: "", supporting: "", hero: "" });

function fromIdea(i?: Idea): Draft {
  if (!i)
    return {
      title: "",
      pillar: PILLARS[2],
      service: "",
      single: { headline: "", cyan: "", supporting: "", hero: "", layout: "A" },
      carousel: [emptySlide(), emptySlide(), emptySlide(), emptySlide()],
    };
  return {
    title: i.title,
    pillar: i.pillar,
    service: i.service ?? "",
    single: { ...i.single, headline: i.single.headline.join("\n") },
    carousel: i.carousel.map((s) => ({ ...s, headline: s.headline.join("\n") })),
  };
}

const lines = (s: string) => s.split("\n").map((l) => l.trim()).filter(Boolean);

function toInput(d: Draft): IdeaInput {
  const slide = (s: SlideDraft, i: number): SlideSpec => ({
    topic: s.topic,
    headline: lines(s.headline),
    cyan: s.cyan,
    supporting: i === 3 ? CAROUSEL_CTA : s.supporting,
    hero: s.hero,
  });
  return {
    title: d.title,
    pillar: d.pillar,
    service: d.service || null,
    single: { ...d.single, headline: lines(d.single.headline) },
    carousel: d.carousel.map(slide),
  };
}

export function IdeaForm({ initial, submitLabel, onSubmit, onCancel }: Props) {
  const toast = useToast();
  const [d, setD] = useState<Draft>(() => fromIdea(initial));
  const [busy, setBusy] = useState(false);
  const [json, setJson] = useState("");

  const input = useMemo(() => toInput(d), [d]);
  const report = useMemo(() => validateIdea(input), [input]);

  const patchSingle = (p: Partial<Draft["single"]>) => setD({ ...d, single: { ...d.single, ...p } });
  const patchSlide = (i: number, p: Partial<SlideDraft>) =>
    setD({ ...d, carousel: d.carousel.map((s, k) => (k === i ? { ...s, ...p } : s)) });

  const loadJson = () => {
    try {
      const raw = JSON.parse(json) as Partial<IdeaInput>;
      const draft = fromIdea({ ...(raw as Idea), service: raw.service ?? null });
      setD({ ...draft, carousel: [0, 1, 2, 3].map((i) => draft.carousel[i] ?? emptySlide()) });
      setJson("");
      toast("Loaded into the form");
    } catch (e) {
      toast("Not valid JSON: " + (e as Error).message);
    }
  };

  const submit = async () => {
    if (report.errors.length) {
      toast("Fix the errors first");
      return;
    }
    setBusy(true);
    try {
      await onSubmit(input);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="panel form">
      <details className="adv">
        <summary>Paste an idea as JSON instead</summary>
        <div className="in">
          <p className="hint" style={{ margin: "0 0 8px" }}>The same shape as the files under content/ideas. It fills the form below; you can still edit before saving.</p>
          <textarea className="mono" style={{ minHeight: 120 }} value={json} onChange={(e) => setJson(e.target.value)} placeholder='{ "title": "...", "pillar": "...", "single": { ... }, "carousel": [ ... ] }' />
          <div className="row"><button className="btn ghost" disabled={!json.trim()} onClick={loadJson}>Load into the form</button></div>
        </div>
      </details>

      <div className="grid2">
        <Field label="Title (the sidebar label)" htmlFor="fTitle">
          <input id="fTitle" value={d.title} onChange={(e) => setD({ ...d, title: e.target.value })} placeholder="Ad clicks are not paying clients" />
        </Field>
        <Field label="Service (optional)" htmlFor="fService">
          <input id="fService" value={d.service} onChange={(e) => setD({ ...d, service: e.target.value })} placeholder="Google Ads" />
        </Field>
      </div>
      <Field label="Content pillar" htmlFor="fPillar">
        <select id="fPillar" value={d.pillar} onChange={(e) => setD({ ...d, pillar: e.target.value as Pillar })}>
          {PILLARS.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
      </Field>

      <h3 className="section">Single-slide post</h3>
      <div className="grid2">
        <Field label="Headline (one line per row, ALL CAPS, ends with a full stop)" htmlFor="sHead">
          <textarea id="sHead" className="mono" style={{ minHeight: 84 }} value={d.single.headline} onChange={(e) => patchSingle({ headline: e.target.value })} placeholder={"AD CLICKS ARE\nNOT PAYING\nCLIENTS."} />
        </Field>
        <div>
          <Field label="Cyan word (exactly as in the headline)" htmlFor="sCyan">
            <input id="sCyan" value={d.single.cyan} onChange={(e) => patchSingle({ cyan: e.target.value })} placeholder="CLIENTS" />
          </Field>
          <Field label="Layout" htmlFor="sLayout">
            <select id="sLayout" value={d.single.layout} onChange={(e) => patchSingle({ layout: e.target.value as Layout })}>
              {LAYOUTS.map((l) => <option key={l} value={l}>Option {l}</option>)}
            </select>
          </Field>
        </div>
      </div>
      <Field label="Supporting line (sentence case, 8 to 12 words, adds new information)" htmlFor="sSup">
        <input id="sSup" value={d.single.supporting} onChange={(e) => patchSingle({ supporting: e.target.value })} placeholder="Track which campaigns turn enquiries into actual sales." />
      </Field>
      <Field label="3D hero object or interface scene (concrete visual description)" htmlFor="sHero">
        <textarea id="sHero" style={{ minHeight: 120 }} value={d.single.hero} onChange={(e) => patchSingle({ hero: e.target.value })} />
      </Field>

      <h3 className="section">Carousel post</h3>
      {d.carousel.map((s, i) => (
        <fieldset key={i} className="slide-fs">
          <legend>Slide {i + 1} · {SLIDE_ROLES[i]} · Layout {CAROUSEL_LAYOUTS[i]}</legend>
          <Field label="Topic (short phrase, no full stop)" htmlFor={`c${i}Topic`}>
            <input id={`c${i}Topic`} value={s.topic} onChange={(e) => patchSlide(i, { topic: e.target.value })} placeholder="the gap between advertising clicks and customer enquiries" />
          </Field>
          <div className="grid2">
            <Field label="Headline (one line per row)" htmlFor={`c${i}Head`}>
              <textarea id={`c${i}Head`} className="mono" style={{ minHeight: 84 }} value={s.headline} onChange={(e) => patchSlide(i, { headline: e.target.value })} />
            </Field>
            <Field label="Cyan word" htmlFor={`c${i}Cyan`}>
              <input id={`c${i}Cyan`} value={s.cyan} onChange={(e) => patchSlide(i, { cyan: e.target.value })} />
            </Field>
          </div>
          {i === 3 ? (
            <Field label="Supporting line (fixed CTA)">
              <input value={CAROUSEL_CTA} disabled />
            </Field>
          ) : (
            <Field label="Supporting line" htmlFor={`c${i}Sup`}>
              <input id={`c${i}Sup`} value={s.supporting} onChange={(e) => patchSlide(i, { supporting: e.target.value })} />
            </Field>
          )}
          <Field label="3D hero object or interface scene" htmlFor={`c${i}Hero`}>
            <textarea id={`c${i}Hero`} style={{ minHeight: 110 }} value={s.hero} onChange={(e) => patchSlide(i, { hero: e.target.value })} />
          </Field>
        </fieldset>
      ))}

      {(report.errors.length > 0 || report.warnings.length > 0) && (
        <div className="report">
          {report.errors.map((e) => <div key={"e" + e} className="hint bad">✗ {e}</div>)}
          {report.warnings.map((w) => <div key={"w" + w} className="hint">! {w}</div>)}
        </div>
      )}

      <div className="row">
        <button className="btn" onClick={submit} disabled={busy || report.errors.length > 0}>{submitLabel}</button>
        <button className="btn ghost" onClick={onCancel} disabled={busy}>Cancel</button>
        {report.errors.length > 0 && <span className="hint">{report.errors.length} thing{report.errors.length === 1 ? "" : "s"} to fix</span>}
      </div>
    </div>
  );
}
