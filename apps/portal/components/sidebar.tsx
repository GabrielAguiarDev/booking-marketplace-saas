"use client";

import { useState } from "react";

import { SignOutButton } from "./auth";
import { VezLogo, VezSymbol } from "./brand";
import { ICONS, NAV_GROUPS, type SectionId } from "./data";
import { ROLE_LABEL, type PortalData } from "./model";

type Hint = { label: string; top: number } | null;

export function Sidebar({
  section,
  go,
  canOpen,
  collapsed,
  onToggle,
  onClose,
  data,
}: {
  section: SectionId;
  go: (section: SectionId) => void;
  /** Seção que o papel não abre some do menu, em vez de levar a "Acesso restrito". */
  canOpen: (section: SectionId) => boolean;
  collapsed: boolean;
  onToggle: () => void;
  onClose: () => void;
  data: PortalData;
}) {
  const [hint, setHint] = useState<Hint>(null);
  const show = (event: React.SyntheticEvent<HTMLElement>, label: string) => {
    if (!collapsed) return;
    const rect = event.currentTarget.getBoundingClientRect();
    setHint({ label, top: rect.top + rect.height / 2 });
  };
  const initials = data.establishment.name
    .split(/\s+/)
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <nav
      aria-label="Seções do portal"
      className="sidebar"
      id="portal-nav"
      onMouseLeave={() => setHint(null)}
    >
      <button
        aria-label={collapsed ? "Expandir menu lateral" : "Recolher menu lateral"}
        aria-expanded={!collapsed}
        aria-controls="portal-nav"
        className="nav-toggle"
        onClick={onToggle}
        title={collapsed ? "Expandir menu lateral" : "Recolher menu lateral"}
        type="button"
      >
        <svg aria-hidden="true" fill="none" height="16" viewBox="0 0 24 24" width="16">
          <path
            d={collapsed ? "M9 6l6 6-6 6" : "M15 6l-6 6 6 6"}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.8"
          />
        </svg>
      </button>
      <div className="brand">
        <VezLogo className="brand-logo" height={22} title="Vez" />
        <VezSymbol className="brand-symbol" height={24} title="Vez" />
        <code>PORTAL</code>
        <button
          aria-label="Fechar menu lateral"
          className="nav-close"
          onClick={onClose}
          type="button"
        >
          <svg aria-hidden="true" fill="none" height="18" viewBox="0 0 24 24" width="18">
            <path
              d="M6 6l12 12M18 6L6 18"
              stroke="currentColor"
              strokeLinecap="round"
              strokeWidth="1.8"
            />
          </svg>
        </button>
      </div>
      <div className="nav-groups">
        {NAV_GROUPS.map((group) => ({
          ...group,
          items: group.items.filter((item) => canOpen(item.id)),
        }))
          .filter((group) => group.items.length > 0)
          .map((group) => (
            <div className="nav-group" key={group.label}>
              <p>{group.label}</p>
              {group.items.map((item) => (
                <button
                  aria-current={item.id === section ? "page" : undefined}
                  aria-label={collapsed ? item.label : undefined}
                  className={item.id === section ? "nav-link active" : "nav-link"}
                  key={item.id}
                  onClick={() => go(item.id)}
                  onFocus={(event) => show(event, item.label)}
                  onMouseEnter={(event) => show(event, item.label)}
                  onMouseLeave={() => setHint(null)}
                  type="button"
                >
                  <i />
                  <svg aria-hidden="true" fill="none" height="19" viewBox="0 0 24 24" width="19">
                    <path
                      d={ICONS[item.id]}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="1.7"
                    />
                  </svg>
                  <span>{item.label}</span>
                </button>
              ))}
            </div>
          ))}
      </div>
      <footer>
        <b className="establishment-mark">{initials}</b>
        <strong>{data.establishment.name}</strong>
        <small>
          {data.user.name} · {ROLE_LABEL[data.establishment.role]}
        </small>
        <SignOutButton className="sidebar-sign-out" />
      </footer>
      {collapsed && hint ? (
        <span className="nav-hint" style={{ top: hint.top }}>
          {hint.label}
        </span>
      ) : null}
    </nav>
  );
}
