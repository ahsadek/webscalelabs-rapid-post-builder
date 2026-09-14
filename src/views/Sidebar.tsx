import type { Format, Idea } from "../types";

interface Props {
  ideas: Idea[];
  formats: Format[];
  filter: string;
  onFilter: (f: string) => void;
  currentId: number | null;
  onSelect: (i: Idea) => void;
  onNew: () => void;
}

export function Sidebar({ ideas, formats, filter, onFilter, currentId, onSelect, onNew }: Props) {
  const byId = new Map(formats.map((f) => [f.id, f]));
  const rows = ideas.filter((i) => filter === "All" || byId.get(i.formatId)?.name === filter);
  const posted = ideas.filter((i) => i.status === "Posted").length;
  const countFor = (name: string) =>
    name === "All" ? ideas.length : ideas.filter((i) => byId.get(i.formatId)?.name === name).length;

  return (
    <aside className="side">
      <div className="filters">
        <label htmlFor="filterFmt">Format</label>
        <select id="filterFmt" className="filter-sel" value={filter} onChange={(e) => onFilter(e.target.value)}>
          {["All", ...formats.map((f) => f.name)].map((name) => (
            <option key={name} value={name}>
              {name === "All" ? "All formats" : name} ({countFor(name)})
            </option>
          ))}
        </select>
      </div>
      <div className="side-bar">
        <span>
          {rows.length} idea{rows.length === 1 ? "" : "s"} · {posted} posted
        </span>
        <button className="btn sm" onClick={onNew}>+ New idea</button>
      </div>
      <div className="list">
        {rows.length === 0 ? (
          <div className="empty">No ideas in this format yet.</div>
        ) : (
          rows.map((i) => {
            const f = byId.get(i.formatId);
            return (
              <button
                key={i.id}
                className="idea"
                style={{ "--fmt": f?.color ?? "#009AB8" } as React.CSSProperties}
                aria-current={currentId === i.id}
                onClick={() => onSelect(i)}
              >
                <span className="t">{i.title}</span>
                <span className={"st " + i.status.toLowerCase()}>{i.status.toUpperCase()}</span>
                <span className="m">
                  #{i.id} · {f?.name ?? "Unknown format"}
                </span>
              </button>
            );
          })
        )}
      </div>
    </aside>
  );
}
