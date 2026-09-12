"use client";

import { useState } from "react";

import { ICONS, NAV_GROUPS, type SectionId } from "./data";
import { ROLE_LABEL, type PortalData } from "./model";

type Hint = { label: string; top: number } | null;

export function Sidebar({ section, go, collapsed, onToggle, data }: {
  section: SectionId;
  go: (section: SectionId) => void;
  collapsed: boolean;
  onToggle: () => void;
  data: PortalData;
}) {
  const [hint, setHint] = useState<Hint>(null);
  const show = (event: React.SyntheticEvent<HTMLElement>, label: string) => {
    if (!collapsed) return;
    const rect = event.currentTarget.getBoundingClientRect();
    setHint({ label, top: rect.top + rect.height / 2 });
  };
  const initials = data.establishment.name.split(/\s+/).map((part) => part[0]).slice(0, 2).join("").toUpperCase();

  return (
    <nav className="sidebar" onMouseLeave={() => setHint(null)}>
      <div className="brand"><b>V</b><strong>Vez</strong><code>PORTAL</code>
        <button aria-label={collapsed ? "Abrir menu" : "Recolher menu"} className="nav-toggle" onClick={onToggle} type="button">
          <svg fill="none" height="16" viewBox="0 0 24 24" width="16"><path d={collapsed ? "M9 6l6 6-6 6" : "M15 6l-6 6 6 6"} strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" /></svg>
        </button>
      </div>
      <div className="nav-groups">
        {NAV_GROUPS.map((group) => (
          <div className="nav-group" key={group.label}><p>{group.label}</p>
            {group.items.map((item) => (
              <button aria-label={collapsed ? item.label : undefined} className={item.id === section ? "nav-link active" : "nav-link"} key={item.id} onClick={() => go(item.id)} onFocus={(event) => show(event, item.label)} onMouseEnter={(event) => show(event, item.label)} onMouseLeave={() => setHint(null)} type="button">
                <i /><svg fill="none" height="19" viewBox="0 0 24 24" width="19"><path d={ICONS[item.id]} strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" /></svg><span>{item.label}</span>
              </button>
            ))}
          </div>
        ))}
      </div>
      <footer><b className="establishment-mark">{initials}</b><strong>{data.establishment.name}</strong><small>{data.user.name} · {ROLE_LABEL[data.establishment.role]}</small></footer>
      {collapsed && hint ? <span className="nav-hint" style={{ top: hint.top }}>{hint.label}</span> : null}
    </nav>
  );
}
