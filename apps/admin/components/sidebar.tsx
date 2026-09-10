"use client";

import { NAV, type NavId, type ScreenId } from "./data";

export function Sidebar({
  screen,
  go,
  reviewCount,
}: {
  screen: ScreenId;
  go: (id: NavId) => void;
  reviewCount: number;
}) {
  return (
    <aside className="sidebar">
      <div className="brand">
        <b>V</b>
        <div>
          <strong>Vez</strong>
          <code>Admin</code>
        </div>
      </div>

      <nav>
        {NAV.map((group) => (
          <div className="nav-group" key={group.label}>
            <p>{group.label}</p>
            <div className="nav-items">
              {group.items.map((item) => {
                // A ficha do estabelecimento continua sob "Estabelecimentos".
                const active =
                  screen === item.id || (item.id === "estab" && screen === "estabDetail");
                const badge =
                  item.id === "reviews"
                    ? reviewCount > 0
                      ? String(reviewCount)
                      : undefined
                    : item.badge;
                return (
                  <button
                    className={active ? "nav-link active" : "nav-link"}
                    key={item.id}
                    onClick={() => go(item.id)}
                    type="button"
                  >
                    <svg
                      fill="none"
                      height="17"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="1.6"
                      viewBox="0 0 24 24"
                      width="17"
                    >
                      <path d={item.d} />
                    </svg>
                    <span>{item.label}</span>
                    {badge ? <b className="badge">{badge}</b> : null}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <footer>
        <b>HR</b>
        <div>
          <strong>Helena Reis</strong>
          <small>Operações · admin</small>
        </div>
      </footer>
    </aside>
  );
}
