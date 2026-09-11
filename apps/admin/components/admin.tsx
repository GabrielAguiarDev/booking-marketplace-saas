"use client";

import { useEffect, useMemo, useState } from "react";

import { Approvals } from "./approvals";
import { AccountConsole } from "./account-console";
import { Check, SearchIcon } from "./blocks";
import { Cities } from "./cities";
import { Customers } from "./customers";
import { TITLES, type NavId, type ScreenId } from "./data";
import { EstablishmentDetail, Establishments } from "./establishments";
import { Finance } from "./finance";
import { AccessModal, CityModal, PlanImpactModal } from "./modals";
import { bannerState, day, type AccessSession, type AdminData } from "./model";
import { Overview } from "./overview";
import { Quotas } from "./quotas";
import { Reviews } from "./reviews";
import { Services } from "./services";
import { Settings } from "./settings";
import { Showcase } from "./showcase";
import { Sidebar } from "./sidebar";
import { AdminProvider, useAdmin } from "./store";
import { Support } from "./support";

type Modal =
  { kind: "access"; estabId: string } | { kind: "city" } | { kind: "plan"; planId: string } | null;

/** Onde abrir uma tela já com um item selecionado — vem da busca do cabeçalho. */
export type Focus = { screen: ScreenId; id: string } | null;

export function Admin({ initial, remote = false }: { initial: AdminData; remote?: boolean }) {
  return (
    <AdminProvider initial={initial} remote={remote}>
      <Shell />
    </AdminProvider>
  );
}

function Shell() {
  const { data, toast, dismiss } = useAdmin();
  const [screen, setScreen] = useState<ScreenId>("overview");
  const [estabId, setEstabId] = useState(
    data.establishments[4]?.id ?? data.establishments[0]?.id ?? "",
  );
  const [modal, setModal] = useState<Modal>(null);
  const [focus, setFocus] = useState<Focus>(null);
  const [accessSession, setAccessSession] = useState<AccessSession | null>(null);
  const [expiredAccess, setExpiredAccess] = useState<Set<string>>(() => new Set());

  const [title, fallback] = TITLES[screen];
  const subtitle = subtitleOf(screen, data) ?? fallback;

  const go = (id: NavId) => {
    setScreen(id);
    setModal(null);
    setFocus(null);
    window.scrollTo(0, 0);
  };

  const openEstablishment = (id: string) => {
    setEstabId(id);
    setAccessSession(null);
    setScreen("estabDetail");
    window.scrollTo(0, 0);
  };

  useEffect(() => {
    const sessions = accessSession ? [accessSession, ...data.accessSessions] : data.accessSessions;
    const timers = sessions.map((session) =>
      window.setTimeout(
        () => {
          setExpiredAccess((ids) => new Set(ids).add(session.id));
          if (accessSession?.id === session.id) {
            setAccessSession(null);
            setScreen((current) => (current === "accountConsole" ? "estabDetail" : current));
          }
        },
        Math.max(0, new Date(session.expiresAt).getTime() - Date.now()),
      ),
    );
    return () => timers.forEach(window.clearTimeout);
  }, [accessSession, data.accessSessions]);

  const activeAccess =
    accessSession?.establishmentId === estabId && !expiredAccess.has(accessSession.id)
      ? accessSession
      : data.accessSessions.find(
          (session) =>
            session.establishmentId === estabId && !expiredAccess.has(session.id),
        ) ?? null;

  const openConsole = (session: AccessSession) => {
    setEstabId(session.establishmentId);
    setAccessSession(session);
    setModal(null);
    setScreen("accountConsole");
    window.scrollTo(0, 0);
  };

  const leaveConsole = (expired = false) => {
    if (expired && activeAccess) setExpiredAccess((ids) => new Set(ids).add(activeAccess.id));
    setAccessSession(null);
    setScreen("estabDetail");
    window.scrollTo(0, 0);
  };

  const openWith = (target: ScreenId, id: string) => {
    if (target === "estabDetail") return openEstablishment(id);
    setFocus({ screen: target, id });
    setScreen(target);
    window.scrollTo(0, 0);
  };

  return (
    <div className="shell">
      <Sidebar go={go} screen={screen} />

      <main>
        <header className="topbar">
          <div className="topbar-title">
            <h1>{title}</h1>
            <span>{subtitle}</span>
          </div>
          <div className="spacer" />
          <GlobalSearch onPick={openWith} />
          <div className="clock">
            <i />
            <code>{day(new Date().toISOString())}</code>
          </div>
        </header>

        <div className="page">
          {screen === "overview" ? <Overview go={go} /> : null}
          {screen === "approvals" ? (
            <Approvals
              focusId={focus?.screen === "approvals" ? focus.id : undefined}
              key={focus?.screen === "approvals" ? focus.id : "approvals"}
            />
          ) : null}
          {screen === "estab" ? <Establishments onOpen={openEstablishment} /> : null}
          {screen === "estabDetail" ? (
            <EstablishmentDetail
              estabId={estabId}
              onAccess={() => setModal({ kind: "access", estabId })}
              onBack={() => setScreen("estab")}
              activeAccess={activeAccess}
              canAccessAccount={data.accountConsoleAccess}
              onOpenConsole={openConsole}
              onOpenTicket={(id) => openWith("support", id)}
            />
          ) : null}
          {screen === "accountConsole" && activeAccess ? (
            <AccountConsole
              onBack={() => leaveConsole(false)}
              onExpired={() => leaveConsole(true)}
              session={activeAccess}
            />
          ) : null}
          {screen === "cities" ? (
            <Cities
              focusId={focus?.screen === "cities" ? focus.id : undefined}
              key={focus?.screen === "cities" ? focus.id : "cities"}
              onNewCity={() => setModal({ kind: "city" })}
            />
          ) : null}
          {screen === "quotas" ? (
            <Quotas onEditPlan={(planId) => setModal({ kind: "plan", planId })} />
          ) : null}
          {screen === "finance" ? <Finance onOpen={openEstablishment} /> : null}
          {screen === "services" ? <Services /> : null}
          {screen === "reviews" ? <Reviews onOpenEstablishment={openEstablishment} /> : null}
          {screen === "customers" ? (
            <Customers
              focusId={focus?.screen === "customers" ? focus.id : undefined}
              key={focus?.screen === "customers" ? focus.id : "customers"}
            />
          ) : null}
          {screen === "settings" ? <Settings /> : null}
          {screen === "showcase" ? <Showcase /> : null}
          {screen === "support" ? (
            <Support
              focusId={focus?.screen === "support" ? focus.id : undefined}
              key={focus?.screen === "support" ? focus.id : "support"}
              onOpenEstablishment={openEstablishment}
            />
          ) : null}
        </div>
      </main>

      {modal?.kind === "access" ? (
        <AccessModal
          estabId={modal.estabId}
          onClose={() => setModal(null)}
          onStarted={openConsole}
        />
      ) : null}
      {modal?.kind === "city" ? <CityModal onClose={() => setModal(null)} /> : null}
      {modal?.kind === "plan" ? (
        <PlanImpactModal onClose={() => setModal(null)} planId={modal.planId} />
      ) : null}
      {toast ? (
        <div className={toast.tone === "error" ? "toast error" : "toast"} role="status">
          <Check size={16} width={2.4} />
          <div>
            <strong>{toast.title}</strong>
            <small>{toast.sub}</small>
          </div>
          <button aria-label="Fechar aviso" onClick={dismiss} type="button">
            ×
          </button>
        </div>
      ) : null}
    </div>
  );
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** Os subtítulos que contam coisas acompanham o dado; os outros ficam como no canvas. */
function subtitleOf(screen: ScreenId, data: AdminData): string | null {
  switch (screen) {
    case "overview":
      return `Plataforma toda · ${new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(new Date())}`;
    case "approvals":
      return data.applications.length
        ? `${plural(data.applications.length, "solicitação aguardando", "solicitações aguardando")}`
        : "Nenhuma solicitação aguardando";
    case "estab": {
      const active = data.establishments.filter((e) => e.status === "active").length;
      return `${plural(active, "ativo", "ativos")} · ${data.establishments.length} no total`;
    }
    case "cities": {
      const active = data.cities.filter((c) => c.status === "active").length;
      const other = data.cities.length - active;
      return `${plural(active, "ativa", "ativas")} · ${other} em avaliação ou pré-lançamento`;
    }
    case "quotas": {
      const active = data.plans.filter((p) => p.active).length;
      return plural(active, "plano ativo", "planos ativos");
    }
    case "reviews":
      return data.reports.length
        ? `${plural(data.reports.length, "denúncia aguardando", "denúncias aguardando")} · panorama das notas`
        : "Moderação e panorama das notas";
    case "customers":
      return plural(data.customers.length, "cadastrado", "cadastrados");
    case "finance":
      return new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(
        new Date(),
      );
    case "showcase": {
      const live = data.banners.filter((b) => bannerState(b) === "live").length;
      return `${plural(live, "banner no ar", "banners no ar")} · ${data.banners.length} na vitrine`;
    }
    case "support": {
      if (!data.supportAccess) return "Chamados atendidos por Suporte e Operações";
      const open = data.tickets.filter((t) => t.status === "open").length;
      const waiting = data.tickets.filter((t) => t.status === "waiting_customer").length;
      return open || waiting
        ? `${plural(open, "chamado aberto", "chamados abertos")} · ${waiting} aguardando cliente`
        : "Nenhum chamado em andamento";
    }
    case "accountConsole":
      return "Somente leitura · acesso temporário e auditado";
    default:
      return null;
  }
}

type Hit = { key: string; label: string; meta: string; screen: ScreenId; id: string };

/** Busca do cabeçalho: estabelecimentos, solicitações, cidades, clientes e chamados. */
function GlobalSearch({ onPick }: { onPick: (screen: ScreenId, id: string) => void }) {
  const { data } = useAdmin();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);

  const hits = useMemo<Hit[]>(() => {
    const q = query
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "");
    if (q.length < 2) return [];
    const match = (text: string) =>
      text
        .toLowerCase()
        .normalize("NFD")
        .replace(/\p{Diacritic}/gu, "")
        .includes(q);
    return [
      ...data.establishments
        .filter((e) => match(e.name) || match(e.city))
        .map((e) => ({
          key: `e-${e.id}`,
          label: e.name,
          meta: `Estabelecimento · ${e.city}`,
          screen: "estabDetail" as const,
          id: e.id,
        })),
      ...data.applications
        .filter((a) => match(a.name) || match(a.cnpj))
        .map((a) => ({
          key: `a-${a.id}`,
          label: a.name,
          meta: `Aguardando aprovação · ${a.city}`,
          screen: "approvals" as const,
          id: a.id,
        })),
      ...data.cities
        .filter((c) => match(c.name))
        .map((c) => ({
          key: `c-${c.id}`,
          label: `${c.name}/${c.uf}`,
          meta: "Cidade",
          screen: "cities" as const,
          id: c.id,
        })),
      ...data.customers
        .filter((c) => match(c.name))
        .map((c) => ({
          key: `u-${c.id}`,
          label: c.name,
          meta: `Cliente · ${c.city}`,
          screen: "customers" as const,
          id: c.id,
        })),
      // "#4417", "4417" ou parte do assunto
      ...data.tickets
        .filter((t) => match(`#${t.number}`) || match(t.subject))
        .map((t) => ({
          key: `t-${t.id}`,
          label: `#${t.number} · ${t.subject}`,
          meta: `Chamado · ${t.establishment ?? t.requesterName}`,
          screen: "support" as const,
          id: t.id,
        })),
    ].slice(0, 8);
  }, [query, data]);

  const pick = (hit: Hit) => {
    onPick(hit.screen, hit.id);
    setQuery("");
    setOpen(false);
  };

  return (
    <div className="search-wrap">
      <div className="search">
        <SearchIcon />
        <input
          aria-autocomplete="list"
          aria-controls="global-search-results"
          aria-expanded={open && hits.length > 0}
          aria-label="Buscar estabelecimento, cidade, cliente ou chamado"
          id="global-search"
          onBlur={() => setTimeout(() => setOpen(false), 120)}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && hits[0]) pick(hits[0]);
            if (event.key === "Escape") setOpen(false);
          }}
          placeholder="Buscar estabelecimento, cidade, cliente ou #chamado"
          role="combobox"
          value={query}
        />
      </div>
      {open && query.trim().length >= 2 ? (
        <div className="search-results" id="global-search-results" role="listbox">
          {hits.length === 0 ? (
            <p className="search-empty">Nada encontrado para “{query.trim()}”.</p>
          ) : null}
          {hits.map((hit) => (
            <button
              key={hit.key}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => pick(hit)}
              role="option"
              aria-selected={false}
              type="button"
            >
              <strong>{hit.label}</strong>
              <small>{hit.meta}</small>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
