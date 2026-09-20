import type { Idea, Pillar, Status } from "../types";
import { PILLARS, PILLAR_COLORS, PILLAR_SHORT, SERVICES, STATUSES } from "../types";

export interface Filters {
  q: string;
  status: Status | "All";
  pillar: Pillar | "All";
  service: string | "All";
}

interface Props {
  ideas: Idea[];
  filters: Filters;
  onFilters: (f: Filters) => void;
  currentId: number | null;
  onSelect: (i: Idea) => void;
  onNew: () => void;
}

export function applyFilters(ideas: Idea[], f: Filters): Idea[] {
  const q = f.q.trim().toLowerCase();
  return ideas.filter(
    (i) =>
      (f.status === "All" || i.status === f.status) &&
      (f.pillar === "All" || i.pillar === f.pillar) &&
      (f.service === "All" || i.service === f.service) &&
      (!q ||
        i.title.toLowerCase().includes(q) ||
        (i.service ?? "").toLowerCase().includes(q) ||
        i.single.headline.join(" ").toLowerCase().includes(q) ||
        i.carousel.some((s) => s.headline.join(" ").toLowerCase().includes(q))),
  );
}

export function Sidebar({ ideas, filters, onFilters, currentId, onSelect, onNew }: Props) {
  const rows = applyFilters(ideas, filters);
  const unused = ideas.filter((i) => i.status === "Unused").length;
  const set = (patch: Partial<Filters>) => onFilters({ ...filters, ...patch });

  return (
    <aside className="side">
      <div className="filters">
        <div className="search">
          <input
            className="filter-q"
            type="search"
            placeholder="Search ideas"
            value={filters.q}
            onChange={(e) => set({ q: e.target.value })}
            aria-label="Search ideas by title, service or headline"
          />
          {filters.q && (
            <button className="clear" aria-label="Clear search" onClick={() => set({ q: "" })}>×</button>
          )}
        </div>
        <div className="filter-row">
          <select className="filter-sel" value={filters.status} onChange={(e) => set({ status: e.target.value as Filters["status"] })} aria-label="Status">
            <option value="All">All statuses</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <select className="filter-sel" value={filters.pillar} onChange={(e) => set({ pillar: e.target.value as Filters["pillar"] })} aria-label="Pillar">
            <option value="All">All pillars</option>
            {PILLARS.map((p) => (
              <option key={p} value={p}>{PILLAR_SHORT[p]}</option>
            ))}
          </select>
        </div>
        <select className="filter-sel" value={filters.service} onChange={(e) => set({ service: e.target.value })} aria-label="Service">
          <option value="All">All services</option>
          {SERVICES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>
      <div className="side-bar">
        <span>
          {rows.length} of {ideas.length} · {unused} unused
        </span>
        <button className="btn sm" onClick={onNew}>+ New idea</button>
      </div>
      <div className="list">
        {rows.length === 0 ? (
          <div className="empty">{ideas.length ? "No ideas match." : "The idea bank is empty. Run npm run ideas:import."}</div>
        ) : (
          rows.map((i) => (
            <button
              key={i.id}
              className="idea"
              style={{ "--fmt": PILLAR_COLORS[i.pillar] ?? "#009AB8" } as React.CSSProperties}
              aria-current={currentId === i.id}
              onClick={() => onSelect(i)}
            >
              <span className="t">{i.title}</span>
              <span className={"st " + i.status.toLowerCase()}>{i.status.toUpperCase()}</span>
              <span className="m">
                #{i.id} · {PILLAR_SHORT[i.pillar] ?? i.pillar}
                {i.service ? ` · ${i.service}` : ""}
              </span>
            </button>
          ))
        )}
      </div>
    </aside>
  );
}
