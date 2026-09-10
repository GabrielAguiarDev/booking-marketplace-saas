/** Peças que aparecem em mais de uma tela do canvas `Vez Portal Admin.dc.html`. */

import type { Chip } from "./data";

/** Etiqueta de situação: ponto colorido + rótulo, fundo tingido. */
export function StatusChip({ chip, small = false }: { chip: Chip; small?: boolean }) {
  return (
    <span
      className={small ? "chip small" : "chip"}
      style={{ background: chip.bg, color: chip.fg }}
    >
      <i style={{ background: chip.fg }} />
      {chip.label}
    </span>
  );
}

/** Grade de vagas de mensalidade: célula cheia = ocupada. */
export function QuotaCells({ total, used, size }: { total: number; used: number; size: "sm" | "md" }) {
  return (
    <div className={size === "sm" ? "cells" : "cells md"}>
      {Array.from({ length: total }, (_, i) => (
        <span className={i < used ? "cell filled" : "cell"} key={i} />
      ))}
    </div>
  );
}

/** Nota como cinco quadradinhos, do jeito do canvas — não estrela. */
export function Stars({ value, size = "md" }: { value: number; size?: "sm" | "md" }) {
  return (
    <div className={size === "sm" ? "stars sm" : "stars"}>
      {Array.from({ length: 5 }, (_, i) => (
        <span className={i < value ? "star filled" : "star"} key={i} />
      ))}
    </div>
  );
}

export function TriangleAlert({ size = 16, className }: { size?: number; className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      height={size}
      strokeLinecap="round"
      strokeWidth="1.9"
      viewBox="0 0 24 24"
      width={size}
    >
      <path d="M12 3l9.5 17H2.5z" />
      <path d="M12 9v5M12 17.2v.1" />
    </svg>
  );
}

export function CircleAlert({ size = 15 }: { size?: number }) {
  return (
    <svg fill="none" height={size} strokeLinecap="round" strokeWidth="1.9" viewBox="0 0 24 24" width={size}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8v5M12 16.2v.1" />
    </svg>
  );
}

export function Check({ size = 20, width = 2.2 }: { size?: number; width?: number }) {
  return (
    <svg
      fill="none"
      height={size}
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={width}
      viewBox="0 0 24 24"
      width={size}
    >
      <path d="M20 6L9 17l-5-5" />
    </svg>
  );
}

export function ChevronRight({ size = 15 }: { size?: number }) {
  return (
    <svg
      fill="none"
      height={size}
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.8"
      viewBox="0 0 24 24"
      width={size}
    >
      <path d="M9 5l7 7-7 7" />
    </svg>
  );
}

export function SearchIcon({ size = 14 }: { size?: number }) {
  return (
    <svg fill="none" height={size} strokeLinecap="round" strokeWidth="1.8" viewBox="0 0 24 24" width={size}>
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-4.2-4.2" />
    </svg>
  );
}

export function Placeholder({ size = 18, width = 1.6 }: { size?: number; width?: number }) {
  return (
    <svg fill="none" height={size} strokeWidth={width} viewBox="0 0 24 24" width={size}>
      <rect height="16" rx="2" width="18" x="3" y="4" />
      <path d="M3 16l5-5 4 4 3-3 6 6" />
    </svg>
  );
}

export function DocIcon({ size = 30, width = 1.5 }: { size?: number; width?: number }) {
  return (
    <svg fill="none" height={size} strokeWidth={width} viewBox="0 0 24 24" width={size}>
      <rect height="16" rx="2" width="18" x="3" y="4" />
      <path d="M7 9h10M7 13h6" />
    </svg>
  );
}

/** Interruptor decorativo: o único que muda de estado é o de notificar o autor. */
export function Toggle({ on }: { on: boolean }) {
  return (
    <span className={on ? "toggle on" : "toggle"}>
      <i />
    </span>
  );
}

/** Barra de abas com sublinhado coral na ativa. */
export function Tabs<T extends string>({
  tabs,
  active,
  onSelect,
  counts,
  end,
}: {
  tabs: readonly T[];
  active: T;
  onSelect: (tab: T) => void;
  counts?: Partial<Record<T, string>>;
  end?: React.ReactNode;
}) {
  return (
    <div className="tabs">
      {tabs.map((tab) => (
        <button
          className={tab === active ? "tab active" : "tab"}
          key={tab}
          onClick={() => onSelect(tab)}
          type="button"
        >
          {tab}
          {counts?.[tab] ? <b className="badge">{counts[tab]}</b> : null}
        </button>
      ))}
      {end ? (
        <>
          <div className="spacer" />
          {end}
        </>
      ) : null}
    </div>
  );
}
