import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Field, useToast } from "../ui";
import { extract } from "../prompts";

type Slide = { name: string; img: HTMLImageElement };
type CounterMode = "all" | "skip1" | "none";

const DEFAULT_LOGO = "/logo-white.png";
const LOGO_KEY = "wsl.logo";

const store = {
  get(k: string): string | null {
    try { return localStorage.getItem(k); } catch { return null; }
  },
  set(k: string, v: string) {
    try { localStorage.setItem(k, v); } catch { /* ignore */ }
  },
  del(k: string) {
    try { localStorage.removeItem(k); } catch { /* ignore */ }
  },
};

const loadImage = (src: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const im = new Image();
    im.onload = () => resolve(im);
    im.onerror = () => reject(new Error("Could not load image"));
    im.src = src;
  });

const readAsDataURL = (f: File) =>
  new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(f);
  });

const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name, undefined, { numeric: true });
const pad = (n: number) => String(n).padStart(2, "0");
const SEP = " / ";

/**
 * Sizes and distances are % of the slide width; opacities are 0 to 100.
 * The logo always sits top right, the counter always sits bottom left.
 */
interface Settings {
  logoW: number; logoOpacity: number; logoInset: number;
  counter: CounterMode;
  counterSize: number; counterOpacity: number; counterInset: number;
}

const DEFAULT_SETTINGS: Settings = {
  logoW: 28, logoOpacity: 25, logoInset: 3,
  counter: "all",
  counterSize: 2.8, counterOpacity: 60, counterInset: 5,
};

function counterFor(idx: number, total: number, s: Settings): string | null {
  if (s.counter === "none") return null;
  if (s.counter === "all") return `${idx + 1}${SEP}${total}`;
  if (idx === 0) return null;
  return `${idx}${SEP}${total - 1}`;
}

function drawSlide(s: Slide, idx: number, total: number, cvs: HTMLCanvasElement, logo: HTMLImageElement | null, st: Settings) {
  const W = s.img.naturalWidth, H = s.img.naturalHeight;
  cvs.width = W; cvs.height = H;
  const ctx = cvs.getContext("2d")!;
  ctx.drawImage(s.img, 0, 0);
  if (logo) {
    const lw = Math.round(W * (st.logoW / 100));
    const lh = Math.round(logo.naturalHeight * (lw / logo.naturalWidth));
    const inset = Math.round(W * (st.logoInset / 100));
    const x = W - inset - lw;
    const y = inset;
    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1, st.logoOpacity / 100));
    ctx.drawImage(logo, x, y, lw, lh);
    ctx.restore();
  }
  const c = counterFor(idx, total, st);
  if (c) {
    const size = Math.round(W * (st.counterSize / 100));
    const inset = Math.round(W * (st.counterInset / 100));
    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1, st.counterOpacity / 100));
    ctx.font = `500 ${size}px "DM Mono", ui-monospace, Menlo, monospace`;
    ctx.fillStyle = "#6B8FA3";
    // Anchor on the digits' baseline so the text never dips below the slide, whatever the distance.
    ctx.textBaseline = "alphabetic";
    const c2 = ctx as CanvasRenderingContext2D & { letterSpacing?: string };
    if (c2.letterSpacing !== undefined) c2.letterSpacing = Math.round(size * 0.12) + "px";
    ctx.fillText(c, inset, H - inset);
    ctx.restore();
  }
}

const fontsReady = async () => {
  try {
    await document.fonts.load('500 20px "DM Mono"');
    await document.fonts.ready;
  } catch { /* fall back to system font */ }
};

export function StampView({ baseName }: { baseName: string | null }) {
  const toast = useToast();
  const [slides, setSlides] = useState<Slide[]>([]);
  const [logo, setLogo] = useState<HTMLImageElement | null>(null);
  const [logoSource, setLogoSource] = useState<"default" | "custom">(store.get(LOGO_KEY) ? "custom" : "default");
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [over, setOver] = useState(false);
  const [fontTick, setFontTick] = useState(0);
  const logoInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const src = store.get(LOGO_KEY) || DEFAULT_LOGO;
    loadImage(src).then(setLogo).catch(() => setLogo(null));
  }, [logoSource]);

  useEffect(() => {
    fontsReady().then(() => setFontTick((t) => t + 1));
  }, []);

  const loadSlides = useCallback(async (files: FileList | File[]) => {
    const arr = [...files].filter((f) => /^image\//.test(f.type)).sort(byName);
    if (!arr.length) return;
    const loaded = await Promise.all(arr.map(async (f) => ({ name: f.name, img: await loadImage(await readAsDataURL(f)) })));
    setSlides((prev) => [...prev, ...loaded].sort(byName));
  }, []);

  const onLogoFile = async (f: File | undefined) => {
    if (!f) return;
    const data = await readAsDataURL(f);
    store.set(LOGO_KEY, data);
    setLogoSource("custom");
    toast("Logo saved in this browser");
  };
  const useDefaultLogo = () => {
    store.del(LOGO_KEY);
    setLogoSource("default");
    if (logoInput.current) logoInput.current.value = "";
  };

  const renderAll = async () => {
    await fontsReady();
    return slides.map((s, idx) => {
      const c = document.createElement("canvas");
      drawSlide(s, idx, slides.length, c, logo, settings);
      return c;
    });
  };
  const fileBase = useMemo(() => {
    const t = baseName ? extract(baseName, "Headline").replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase().slice(0, 40) : "";
    return t || "carousel";
  }, [baseName]);

  const download = (href: string, name: string) => {
    const a = document.createElement("a");
    a.href = href; a.download = name;
    document.body.append(a); a.click(); a.remove();
  };

  const dlZip = async () => {
    const cs = await renderAll();
    const { default: JSZip } = await import("jszip");
    const zip = new JSZip();
    for (let i = 0; i < cs.length; i++) {
      const blob = await new Promise<Blob | null>((r) => cs[i].toBlob(r, "image/png"));
      if (blob) zip.file(`${pad(i + 1)}.png`, blob);
    }
    const out = await zip.generateAsync({ type: "blob" });
    download(URL.createObjectURL(out), `${fileBase}-slides.zip`);
    toast("PNGs downloaded");
  };

  const dlPdf = async () => {
    const cs = await renderAll();
    const { jsPDF } = await import("jspdf");
    const w = cs[0].width, h = cs[0].height;
    const pdf = new jsPDF({ orientation: w >= h ? "l" : "p", unit: "px", format: [w, h], compress: true });
    cs.forEach((c, i) => {
      if (i) pdf.addPage([w, h], w >= h ? "l" : "p");
      pdf.addImage(c.toDataURL("image/jpeg", 0.92), "JPEG", 0, 0, w, h);
    });
    pdf.save(`${fileBase}-linkedin.pdf`);
    toast("PDF downloaded");
  };

  const has = slides.length > 0;
  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => setSettings((s) => ({ ...s, [k]: v }));
  const settingsChanged = (Object.keys(DEFAULT_SETTINGS) as (keyof Settings)[]).some((k) => settings[k] !== DEFAULT_SETTINGS[k]);

  return (
    <section className="stamp">
      <h2 className="page-title">Stamp logo and counters.</h2>
      <p className="lead">Drop the finished slides here in order. The logo goes top right, the slide counter goes bottom-left in the margin, both at the same place on every slide. Nothing here touches the generator.</p>

      <label
        className={"drop" + (over ? " over" : "")}
        onDragEnter={(e) => { e.preventDefault(); setOver(true); }}
        onDragOver={(e) => { e.preventDefault(); setOver(true); }}
        onDragLeave={(e) => { e.preventDefault(); setOver(false); }}
        onDrop={(e) => { e.preventDefault(); setOver(false); loadSlides(e.dataTransfer.files); }}
      >
        <input type="file" accept="image/png,image/jpeg,image/webp" multiple onChange={(e) => { if (e.target.files) loadSlides(e.target.files); e.target.value = ""; }} />
        Drop slides here, or <b>choose files</b>. They are ordered by filename, so name them 01, 02, 03.
      </label>

      <div className="previews">
        {slides.map((s, idx) => (
          <div className="prev" key={s.name + idx}>
            <SlideCanvas slide={s} idx={idx} total={slides.length} logo={logo} settings={settings} tick={fontTick} />
            <div className="cap">
              <span title={s.name}>{idx + 1}. {s.name}</span>
              <button onClick={() => setSlides((prev) => prev.filter((_, i) => i !== idx))}>Remove</button>
            </div>
          </div>
        ))}
      </div>

      <div className="row stamp-actions">
        <button className="btn" disabled={!has} onClick={dlZip}>Download all PNGs</button>
        <button className="btn ghost" disabled={!has} onClick={dlPdf}>Download LinkedIn PDF</button>
        <button className="btn ghost" disabled={!has} onClick={() => setSlides([])}>Clear</button>
      </div>

      <details className="adv">
        <summary onMouseDown={(e) => { if (e.detail > 1) e.preventDefault(); }}>
          Advanced settings{settingsChanged && <span className="meta">edited</span>}
        </summary>
        <div className="in">
          <div className="controls-row">
            <Field label="Logo file" htmlFor="logoFile">
              <input ref={logoInput} type="file" id="logoFile" accept="image/png,image/svg+xml,image/webp" onChange={(e) => onLogoFile(e.target.files?.[0])} />
              <div className="logo-prev">
                {logo && <img src={logo.src} alt="Logo in use" />}
                {logoSource === "custom" && <button className="btn ghost sm" onClick={useDefaultLogo}>Use default</button>}
              </div>
            </Field>
            <Field label={`Logo width · ${settings.logoW.toFixed(1)}%`} htmlFor="logoW">
              <input type="range" step={0.1} id="logoW" min={10} max={35} value={settings.logoW} onChange={(e) => set("logoW", Number(e.target.value))} />
            </Field>
            <Field label={`Logo opacity · ${settings.logoOpacity.toFixed(1)}%`} htmlFor="logoOpacity">
              <input type="range" step={0.1} id="logoOpacity" min={10} max={100} value={settings.logoOpacity} onChange={(e) => set("logoOpacity", Number(e.target.value))} />
            </Field>
            <Field label={`Logo corner distance · ${settings.logoInset.toFixed(1)}%`} htmlFor="logoInset">
              <input type="range" step={0.1} id="logoInset" min={2} max={16} value={settings.logoInset} onChange={(e) => set("logoInset", Number(e.target.value))} />
            </Field>
          </div>
          <div className="controls-row">
            <Field label="Counter mode" htmlFor="counter">
              <select id="counter" value={settings.counter} onChange={(e) => set("counter", e.target.value as CounterMode)}>
                <option value="all">Every slide, thumbnail is 1</option>
                <option value="skip1">Content slides only</option>
                <option value="none">Off</option>
              </select>
            </Field>
            <Field label={`Counter size · ${settings.counterSize.toFixed(1)}%`} htmlFor="counterSize">
              <input type="range" id="counterSize" min={1} max={5} step={0.1} value={settings.counterSize} onChange={(e) => set("counterSize", Number(e.target.value))} />
            </Field>
            <Field label={`Counter opacity · ${settings.counterOpacity.toFixed(1)}%`} htmlFor="counterOpacity">
              <input type="range" step={0.1} id="counterOpacity" min={10} max={100} value={settings.counterOpacity} onChange={(e) => set("counterOpacity", Number(e.target.value))} />
            </Field>
            <Field label={`Counter corner distance · ${settings.counterInset.toFixed(1)}%`} htmlFor="counterInset">
              <input type="range" step={0.1} id="counterInset" min={2} max={16} value={settings.counterInset} onChange={(e) => set("counterInset", Number(e.target.value))} />
            </Field>
          </div>
          <div className="row" style={{ margin: "10px 0 0" }}>
            <button className="btn ghost sm" disabled={!settingsChanged} onClick={() => setSettings(DEFAULT_SETTINGS)}>
              Reset to defaults
            </button>
            {settingsChanged && <span className="hint">Some settings differ from the defaults.</span>}
          </div>
        </div>
      </details>

    </section>
  );
}

function SlideCanvas({ slide, idx, total, logo, settings, tick }: { slide: Slide; idx: number; total: number; logo: HTMLImageElement | null; settings: Settings; tick: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (ref.current) drawSlide(slide, idx, total, ref.current, logo, settings);
  }, [slide, idx, total, logo, settings, tick]);
  return <canvas ref={ref} />;
}
