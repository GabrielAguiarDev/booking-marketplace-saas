"use client";

import { NAV, type NavId, type ScreenId } from "./data";
import { SignOutButton } from "./auth";
import { useAdmin } from "./store";

export function Sidebar({ screen, go }: { screen: ScreenId; go: (id: NavId) => void }) {
  const { data } = useAdmin();

  // os números do menu saem do dado; zero some, em vez de mostrar "0"
  const counts: Partial<Record<NavId, number>> = {
    approvals: data.applications.length,
    reviews: data.reports.length,
    finance: data.invoices.filter((i) => i.status === "overdue").length,
    support: data.tickets.filter((ticket) => ticket.status !== "resolved").length,
  };
  const initials = data.me.name
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("");

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
                  screen === item.id ||
                  (item.id === "estab" &&
                    (screen === "estabDetail" || screen === "accountConsole"));
                const n = counts[item.id];
                const badge = n === undefined ? item.badge : n > 0 ? String(n) : undefined;
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
        <b>{initials}</b>
        <div>
          <strong>{data.me.name}</strong>
          <small>{data.me.role}</small>
        </div>
        <SignOutButton />
      </footer>
    </aside>
  );
}
