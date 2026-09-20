import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "./api";
import type { Bootstrap, Idea, IdeaInput, PromptKey, PromptMap, Status } from "./types";
import { ToastProvider, useToast } from "./ui";
import { Sidebar, type Filters } from "./views/Sidebar";
import { IdeaDetail } from "./views/IdeaDetail";
import { IdeaForm } from "./views/IdeaForm";
import { StampView } from "./views/StampView";
import { SettingsView } from "./views/SettingsView";
import { slug } from "../shared/render";

type View = "prompts" | "stamp" | "settings";
type Route = { view: View; ideaId: number | null; newIdea: boolean };

function parseHash(): Route {
  const h = window.location.hash.replace(/^#\/?/, "");
  const [view, arg] = h.split("/");
  if (view === "stamp" || view === "settings") return { view, ideaId: null, newIdea: false };
  if (arg === "new") return { view: "prompts", ideaId: null, newIdea: true };
  const id = Number(arg);
  return { view: "prompts", ideaId: Number.isInteger(id) && id > 0 ? id : null, newIdea: false };
}
const go = (path: string) => {
  window.location.hash = "#/" + path;
};

export function App() {
  return (
    <ToastProvider>
      <Shell />
    </ToastProvider>
  );
}

function Shell() {
  const toast = useToast();
  const [data, setData] = useState<Bootstrap | null>(null);
  const [fatal, setFatal] = useState<string | null>(null);
  const [route, setRoute] = useState<Route>(parseHash);
  const [filters, setFilters] = useState<Filters>({ q: "", status: "All", pillar: "All", service: "All" });
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    const onHash = () => {
      setRoute(parseHash());
      setEditing(false);
      window.scrollTo(0, 0);
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  useEffect(() => {
    api.bootstrap().then(setData).catch((e: Error) => setFatal(e.message));
  }, []);

  const run = useCallback(
    async <T,>(work: () => Promise<T>, ok?: string): Promise<T | undefined> => {
      try {
        const r = await work();
        if (ok) toast(ok);
        return r;
      } catch (e) {
        toast((e as Error).message || "Something went wrong");
        return undefined;
      }
    },
    [toast],
  );

  const ideas = data?.ideas ?? [];
  const prompts = useMemo(
    () => Object.fromEntries((data?.prompts ?? []).map((p) => [p.key, p.body])) as PromptMap,
    [data],
  );
  const current = route.ideaId != null ? ideas.find((i) => i.id === route.ideaId) ?? null : null;

  /* ---------- mutations ---------- */
  const patch = (fn: (d: Bootstrap) => Bootstrap) => setData((d) => (d ? fn(d) : d));
  const replaceIdea = (updated: Idea) => patch((d) => ({ ...d, ideas: d.ideas.map((i) => (i.id === updated.id ? updated : i)) }));

  const setStatus = (idea: Idea, status: Status) => run(async () => replaceIdea(await api.updateIdea(idea.id, { status })));

  const createIdea = (input: IdeaInput) =>
    run(async () => {
      const created = await api.createIdea(input);
      patch((d) => ({ ...d, ideas: [...d.ideas, created] }));
      go(`prompts/${created.id}`);
    }, "Idea added");

  const updateIdea = (id: number, input: IdeaInput) =>
    run(async () => {
      replaceIdea(await api.updateIdea(id, input));
      setEditing(false);
    }, "Idea saved");

  const deleteIdea = (idea: Idea) => {
    if (!window.confirm(`Delete "${idea.title}" for everyone? This cannot be undone.`)) return;
    run(async () => {
      await api.deleteIdea(idea.id);
      patch((d) => ({ ...d, ideas: d.ideas.filter((i) => i.id !== idea.id) }));
      go("prompts");
    }, "Idea deleted");
  };

  const savePrompt = (key: PromptKey, body: string) =>
    run(async () => {
      const saved = await api.savePrompt(key, body);
      patch((d) => ({ ...d, prompts: d.prompts.map((p) => (p.key === saved.key ? saved : p)) }));
    }, "Saved");

  /* ---------- render ---------- */
  const view = route.view;
  const showSide = view === "prompts";
  const mainClass = [showSide ? "" : "single", showSide && (current || route.newIdea) ? "has-current" : ""]
    .filter(Boolean)
    .join(" ");

  return (
    <>
      <header className="top">
        <h1>
          <img className="wordmark" src="/logo-white.png" alt="WebScaleLabs" />
          <span className="sep">·</span><span className="app">Rapid Post Builder</span>
        </h1>
        <nav className="nav" aria-label="Sections">
          {(["prompts", "stamp", "settings"] as View[]).map((v) => (
            <button key={v} aria-current={view === v ? "page" : undefined} onClick={() => go(v)}>
              {v === "prompts" ? "Ideas" : v[0].toUpperCase() + v.slice(1)}
            </button>
          ))}
        </nav>
      </header>

      {fatal ? (
        <div className="fatal">
          Could not load the idea bank.
          <code>{fatal}</code>
        </div>
      ) : !data ? (
        <div className="loading">Loading the idea bank…</div>
      ) : (
        <main className={mainClass}>
          {showSide && (
            <Sidebar
              ideas={ideas}
              filters={filters}
              onFilters={setFilters}
              currentId={current?.id ?? null}
              onSelect={(i) => go(`prompts/${i.id}`)}
              onNew={() => go("prompts/new")}
            />
          )}

          {view === "prompts" && (
            <section className="content">
              {route.newIdea ? (
                <div className="detail">
                  <button className="btn ghost sm back" onClick={() => go("prompts")}>← All ideas</button>
                  <h2 className="page-title">New post idea.</h2>
                  <p className="lead">One idea carries both the single-slide post and the 4-slide carousel. Fill the fields, or paste a JSON file from the idea pipeline. It is saved for the whole team.</p>
                  <IdeaForm onSubmit={createIdea} onCancel={() => go("prompts")} submitLabel="Add idea" />
                </div>
              ) : current && editing ? (
                <div className="detail">
                  <button className="btn ghost sm back" onClick={() => setEditing(false)}>← Back</button>
                  <h2 className="page-title">Edit idea.</h2>
                  <IdeaForm
                    initial={current}
                    onSubmit={(input) => updateIdea(current.id, input)}
                    onCancel={() => setEditing(false)}
                    submitLabel="Save changes"
                  />
                </div>
              ) : current ? (
                <IdeaDetail
                  key={current.id}
                  idea={current}
                  prompts={prompts}
                  onStatus={(s) => setStatus(current, s)}
                  onEdit={() => setEditing(true)}
                  onDelete={() => deleteIdea(current)}
                  onBack={() => go("prompts")}
                />
              ) : (
                <div className="detail">
                  <div className="empty">Pick a post idea on the left.</div>
                </div>
              )}
            </section>
          )}

          {view === "stamp" && <StampView baseName={current ? slug(current) : null} />}

          {view === "settings" && <SettingsView prompts={data.prompts} defaults={data.defaults} onSavePrompt={savePrompt} />}
        </main>
      )}
    </>
  );
}
