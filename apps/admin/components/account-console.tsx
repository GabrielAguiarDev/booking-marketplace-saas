"use client";

import { useEffect, useRef, useState } from "react";

import { DocIcon, Stars } from "./blocks";
import { FormError, useRun } from "./dialogs";
import {
  brl,
  day,
  stamp,
  type AccessSession,
  type AccountAppointment,
  type AccountProfessional,
  type AccountReview,
  type AccountService,
  type AccountSettings,
} from "./model";
import { useAdmin } from "./store";

const TABS = ["Agenda", "Serviços", "Profissionais", "Ajustes", "Avaliações"] as const;
type ConsoleTab = (typeof TABS)[number];

const APPOINTMENT_STATUS: Record<string, string> = {
  scheduled: "Agendado",
  confirmed: "Confirmado",
  completed: "Concluído",
  cancelled_by_customer: "Cancelado pelo cliente",
  cancelled_by_establishment: "Cancelado pela loja",
  no_show: "Falta",
};

const BOOKING_MODE: Record<string, string> = {
  scheduled: "Hora marcada",
  queue: "Fila",
  both: "Hora marcada e fila",
};

const yesNo = (value: boolean) => (value ? "Ligado" : "Desligado");

function countdown(expiresAt: string) {
  const seconds = Math.max(0, Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 1000));
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

export function AccountConsole({
  session,
  onBack,
  onExpired,
}: {
  session: AccessSession;
  onBack: () => void;
  onExpired: () => void;
}) {
  const { actions } = useAdmin();
  const [tab, setTab] = useState<ConsoleTab>("Agenda");
  const [remaining, setRemaining] = useState(() => countdown(session.expiresAt));
  const [pendingTab, setPendingTab] = useState<ConsoleTab | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [agenda, setAgenda] = useState<AccountAppointment[] | null>(null);
  const [services, setServices] = useState<AccountService[] | null>(null);
  const [professionals, setProfessionals] = useState<AccountProfessional[] | null>(null);
  const [settings, setSettings] = useState<AccountSettings | null>(null);
  const [reviews, setReviews] = useState<AccountReview[] | null>(null);
  const loaded = useRef(new Set<ConsoleTab>());
  const end = useRun(onBack);

  useEffect(() => {
    const update = () => {
      const next = countdown(session.expiresAt);
      setRemaining(next);
      if (next === "00:00") onExpired();
    };
    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, [session.expiresAt, onExpired]);

  useEffect(() => {
    if (loaded.current.has(tab)) return;
    loaded.current.add(tab);
    setPendingTab(tab);
    setError(null);
    const request =
      tab === "Agenda"
        ? actions.accountAgenda(session.id, session.establishmentId).then(setAgenda)
        : tab === "Serviços"
          ? actions.accountServices(session.id, session.establishmentId).then(setServices)
          : tab === "Profissionais"
            ? actions
                .accountProfessionals(session.id, session.establishmentId)
                .then(setProfessionals)
            : tab === "Ajustes"
              ? actions.accountSettings(session.id, session.establishmentId).then(setSettings)
              : actions.accountReviews(session.id, session.establishmentId).then(setReviews);
    void request
      .catch((cause) => {
        loaded.current.delete(tab);
        setError(cause instanceof Error ? cause.message : "A leitura da conta falhou.");
      })
      .finally(() => setPendingTab(null));
  }, [actions, session.establishmentId, session.id, tab]);

  return (
    <div className="stack account-console">
      <div className="account-console-bar">
        <span className="account-console-lock" aria-hidden="true">
          <svg fill="none" height="15" strokeWidth="1.8" viewBox="0 0 24 24" width="15">
            <path d="M7 10V7a5 5 0 0110 0v3M5 10h14v10H5z" />
          </svg>
        </span>
        <div>
          <strong>Somente leitura</strong>
          <small>
            {session.establishment} · termina em <code>{remaining}</code>
          </small>
        </div>
        <div className="spacer" />
        <button className="ghost small" onClick={onBack} type="button">
          Voltar à ficha
        </button>
        <button
          className="ghost small danger"
          disabled={end.pending}
          onClick={() =>
            void end.run(() => actions.endAccessSession(session.id), {
              title: "Acesso encerrado",
              sub: `A janela de ${session.establishment} foi encerrada antes do prazo.`,
            })
          }
          type="button"
        >
          {end.pending ? "Encerrando…" : "Encerrar"}
        </button>
      </div>

      <div className="account-console-head">
        <button className="back" onClick={onBack} type="button">
          Ficha do estabelecimento
        </button>
        <h2>{session.establishment}</h2>
        <p>
          Motivo autorizado: <strong>{session.reason}</strong>
        </p>
      </div>

      <div className="tabs">
        {TABS.map((name) => (
          <button
            className={tab === name ? "tab active" : "tab"}
            key={name}
            onClick={() => setTab(name)}
            type="button"
          >
            {name}
          </button>
        ))}
      </div>

      <FormError message={end.error ?? error} />
      {pendingTab === tab ? (
        <p className="account-console-loading">Lendo {tab.toLowerCase()}…</p>
      ) : null}

      {tab === "Agenda" && agenda ? <Agenda rows={agenda} /> : null}
      {tab === "Serviços" && services ? <Services rows={services} /> : null}
      {tab === "Profissionais" && professionals ? <Professionals rows={professionals} /> : null}
      {tab === "Ajustes" && settings ? <Settings value={settings} /> : null}
      {tab === "Avaliações" && reviews ? <Reviews rows={reviews} /> : null}
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="empty-card">
      <DocIcon />
      <strong>Nada para mostrar</strong>
      <p>{text}</p>
    </div>
  );
}

function Agenda({ rows }: { rows: AccountAppointment[] }) {
  if (!rows.length) return <Empty text="Não há agendamentos de hoje até os próximos 7 dias." />;
  return (
    <div className="card clip">
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Quando</th>
              <th>Cliente protegido</th>
              <th>Serviço</th>
              <th>Profissional</th>
              <th>Situação</th>
              <th className="right">Valor</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td className="mono">{stamp(row.startsAt)}</td>
                <td className="strong">{row.customer}</td>
                <td>{row.service}</td>
                <td>{row.professional}</td>
                <td>{APPOINTMENT_STATUS[row.status] ?? row.status}</td>
                <td className="right mono">{brl(row.priceCents)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Services({ rows }: { rows: AccountService[] }) {
  if (!rows.length) return <Empty text="Esta loja ainda não cadastrou serviços." />;
  return (
    <div className="account-console-grid">
      {rows.map((row) => (
        <div className="card pad" key={row.id}>
          <div className="account-console-card-title">
            <strong>{row.name}</strong>
            <span className={row.active ? "chip ok" : "chip neutral"}>
              {row.active ? "Ativo" : "Inativo"}
            </span>
          </div>
          <p>{row.description || "Sem descrição."}</p>
          <small>
            {row.durationMinutes} min · {brl(row.priceCents)} · {row.professionals} profissional(is)
          </small>
        </div>
      ))}
    </div>
  );
}

function Professionals({ rows }: { rows: AccountProfessional[] }) {
  if (!rows.length) return <Empty text="Esta loja ainda não cadastrou profissionais." />;
  return (
    <div className="account-console-grid">
      {rows.map((row) => (
        <div className="card pad" key={row.id}>
          <div className="account-console-card-title">
            <strong>{row.name}</strong>
            <span className={row.active ? "chip ok" : "chip neutral"}>
              {row.active ? "Ativo" : "Inativo"}
            </span>
          </div>
          <p>{row.title || row.bio || "Sem apresentação."}</p>
          <small>
            {row.services.length ? row.services.join(" · ") : "Nenhum serviço vinculado"}
          </small>
        </div>
      ))}
    </div>
  );
}

function Settings({ value }: { value: AccountSettings }) {
  const rows = [
    ["Forma de atendimento", BOOKING_MODE[value.bookingMode] ?? value.bookingMode],
    ["Fuso horário", value.timezone],
    ["Intervalo da grade", `${value.slotIntervalMinutes} min`],
    ["Antecedência mínima", `${value.minLeadMinutes} min`],
    ["Cancelamento sem custo", `${value.cancellationWindowMinutes} min antes`],
    ["Sinal", `${value.depositPercent}%`],
    ["Aprovação automática", yesNo(value.autoApprove)],
    ["Pagamento no app", yesNo(value.acceptAppPayment)],
    ["Sinal reembolsável", yesNo(value.depositRefundable)],
    ["Entrada remota na fila", yesNo(value.queueRemoteJoin)],
    ["Chegada obrigatória", yesNo(value.queueRequireArrival)],
    ["Fila por profissional", yesNo(value.queuePerProfessional)],
    ["Fechamento automático", yesNo(value.queueAutoClose)],
    ["Limite para fechar fila", `${value.queueCloseAfterMinutes} min`],
    ["Pular automaticamente", yesNo(value.queueAutoSkip)],
    ["Avisos da fila", yesNo(value.queueNotifyEnabled)],
  ];
  return (
    <div className="card pad account-console-settings">
      {rows.map(([label, result]) => (
        <div key={label}>
          <small>{label}</small>
          <strong>{result}</strong>
        </div>
      ))}
    </div>
  );
}

function Reviews({ rows }: { rows: AccountReview[] }) {
  if (!rows.length) return <Empty text="Esta loja ainda não recebeu avaliações." />;
  return (
    <div className="stack tight">
      {rows.map((row) => (
        <div className="card pad account-console-review" key={row.id}>
          <div>
            <Stars size="sm" value={row.rating} />
            <strong>{row.rating.toFixed(1)}</strong>
            <small>
              {row.customer} · {row.professional ?? "Loja"} · {day(row.createdAt)}
            </small>
          </div>
          <p>{row.comment || "Sem comentário."}</p>
          {row.tags.length ? <small>{row.tags.join(" · ")}</small> : null}
        </div>
      ))}
    </div>
  );
}
