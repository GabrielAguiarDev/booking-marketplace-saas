"use client";

import { useState } from "react";

import { ICONS, NAV_GROUPS, type SectionId } from "./data";

type Hint = { label: string; top: number } | null;

/** Rótulo que substitui o texto do item quando o menu está recolhido. */
function useHint(enabled: boolean) {
  const [hint, setHint] = useState<Hint>(null);
  const show = (event: React.SyntheticEvent<HTMLElement>, label: string) => {
    if (!enabled) return;
    const rect = event.currentTarget.getBoundingClientRect();
    setHint({ label, top: rect.top + rect.height / 2 });
  };
  return { hint, show, hide: () => setHint(null) };
}

export function Sidebar({
  section,
  go,
  collapsed,
  onToggle,
}: {
  section: SectionId;
  go: (section: SectionId) => void;
  collapsed: boolean;
  onToggle: () => void;
}) {
  const { hint, show, hide } = useHint(collapsed);

  return (
    <nav className="sidebar" onMouseLeave={hide}>
      <div className="brand">
        <b>V</b>
        <strong>Vez</strong>
        <code>PORTAL</code>
        <button
          aria-label={collapsed ? "Abrir menu" : "Recolher menu"}
          className="nav-toggle"
          onBlur={hide}
          onClick={onToggle}
          onFocus={(event) => show(event, "Abrir menu")}
          onMouseEnter={(event) => show(event, "Abrir menu")}
          onMouseLeave={hide}
          type="button"
        >
          <svg fill="none" height="16" viewBox="0 0 24 24" width="16">
            <path
              d={collapsed ? "M9 6l6 6-6 6" : "M15 6l-6 6 6 6"}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="1.8"
            />
          </svg>
        </button>
      </div>

      <div className="nav-groups">
        {NAV_GROUPS.map((group) => (
          <div className="nav-group" key={group.label}>
            <p>{group.label}</p>
            {group.items.map((item) => (
              <button
                aria-label={collapsed ? item.label : undefined}
                className={item.id === section ? "nav-link active" : "nav-link"}
                key={item.id}
                onBlur={hide}
                onClick={() => go(item.id)}
                onFocus={(event) => show(event, item.label)}
                onMouseEnter={(event) => show(event, item.label)}
                onMouseLeave={hide}
                type="button"
              >
                <i />
                <svg fill="none" height="19" viewBox="0 0 24 24" width="19">
                  <path
                    d={ICONS[item.id]}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="1.7"
                  />
                </svg>
                <span>{item.label}</span>
                {item.badge ? (
                  <b className={item.critical ? "badge critical" : "badge"}>{item.badge}</b>
                ) : null}
              </button>
            ))}
          </div>
        ))}
      </div>

      <footer>
        <button
          className="billing-alert"
          onBlur={hide}
          onClick={() => go("billing")}
          onFocus={(event) => show(event, "Cobrança recusada")}
          onMouseEnter={(event) => show(event, "Cobrança recusada")}
          onMouseLeave={hide}
          type="button"
        >
          <i />
          <span>
            <strong>Cobrança recusada</strong>
            <small>Atualize o cartão até 12/09.</small>
          </span>
        </button>
        <b
          className="establishment-mark"
          onBlur={hide}
          onFocus={(event) => show(event, "Barbearia Corte Reto")}
          onMouseEnter={(event) => show(event, "Barbearia Corte Reto")}
          onMouseLeave={hide}
          tabIndex={collapsed ? 0 : -1}
        >
          BC
        </b>
        <strong>Barbearia Corte Reto</strong>
        <small>Rafael Nunes · dono</small>
      </footer>

      {collapsed && hint ? (
        <span className="nav-hint" style={{ top: hint.top }}>
          {hint.label}
        </span>
      ) : null}
    </nav>
  );
}
