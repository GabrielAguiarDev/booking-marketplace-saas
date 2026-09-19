"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";

import type { ScheduleImpact } from "./model";
import { AMBER, MUTED } from "./tokens";

/* ── Formatação ───────────────────────────────────────────────────────────── */

export function money(cents: number): string {
  return `R$ ${(cents / 100).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/** "45,90" e "45.90" viram 4590. Devolve `null` quando não é dinheiro. */
export function parseMoney(input: string): number | null {
  const cleaned = input.trim().replace(/\s/g, "").replace(/\./g, "").replace(",", ".");
  if (cleaned === "" || !/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  return Math.round(Number(cleaned) * 100);
}

export function minutesLabel(minutes: number): string {
  if (minutes < 60) return `${minutes}min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (minutes % 1440 === 0) return minutes === 1440 ? "1 dia" : `${minutes / 1440} dias`;
  return rest === 0 ? `${hours}h` : `${hours}h${String(rest).padStart(2, "0")}`;
}

/** `09:00:00` do Postgres vira `09:00`, que é o que o input `time` aceita. */
export const hhmm = (value: string): string => value.slice(0, 5);

export function dateLabel(iso: string): string {
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" }).format(
    new Date(`${iso}T12:00:00`),
  );
}

export function dateTimeLabel(iso: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

export const todayISO = (): string => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
    now.getDate(),
  ).padStart(2, "0")}`;
};

/* ── Aviso do que aconteceu ───────────────────────────────────────────────── */

type ToastState = { text: string; bad: boolean } | null;
const ToastContext = createContext<((text: string, bad?: boolean) => void) | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<ToastState>(null);
  const show = useCallback((text: string, bad = false) => setToast({ text, bad }), []);
  return (
    <ToastContext.Provider value={show}>
      {children}
      {toast ? (
        <div className="toast" role="status">
          <strong>{toast.bad ? "Não deu certo" : "Pronto"}</strong>
          <small>{toast.text}</small>
          <button onClick={() => setToast(null)} type="button">
            fechar
          </button>
        </div>
      ) : null}
    </ToastContext.Provider>
  );
}

/**
 * Executa uma escrita e conta o que aconteceu.
 *
 * Toda seção do cadastro usa este mesmo caminho para que nenhuma delas fique
 * "salvando" em silêncio: ou o aviso diz que salvou, ou diz por que não.
 */
export function useSave() {
  const show = useContext(ToastContext);
  const [pending, setPending] = useState(false);

  const run = useCallback(
    async (action: () => Promise<void>, done: string): Promise<boolean> => {
      setPending(true);
      try {
        await action();
        show?.(done);
        return true;
      } catch (error) {
        show?.(error instanceof Error ? error.message : "Erro inesperado.", true);
        return false;
      } finally {
        setPending(false);
      }
    },
    [show],
  );

  return useMemo(() => ({ run, pending }), [run, pending]);
}

/* ── Peças visuais ────────────────────────────────────────────────────────── */

export function Switch({
  label,
  on,
  disabled,
  onChange,
}: {
  label: string;
  on: boolean;
  disabled?: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <button
      aria-label={label}
      aria-pressed={on}
      className={on ? "switch on" : "switch"}
      disabled={disabled}
      onClick={() => onChange(!on)}
      type="button"
    >
      <i />
    </button>
  );
}

export function Dialog({
  title,
  sub,
  onCancel,
  children,
}: {
  title: string;
  sub?: string;
  onCancel: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="dialog-scrim">
      <button aria-label="Fechar" className="dialog-backdrop" onClick={onCancel} type="button" />
      <div aria-label={title} aria-modal="true" className="dialog" role="dialog">
        <h2>{title}</h2>
        {sub ? <p>{sub}</p> : null}
        {children}
      </div>
    </div>
  );
}

export function EmptyBox({ title, body }: { title: string; body: string }) {
  return (
    <div className="empty-box left">
      <strong>{title}</strong>
      <p>{body}</p>
    </div>
  );
}

/**
 * Regra R9 na tela: o que a mudança deixaria de fora.
 *
 * A lista vem do Postgres (`schedule_change_impact` / `block_impact`), nunca de
 * uma conta feita aqui. Enquanto ela tiver linha, o botão de salvar diz
 * claramente que vai quebrar reserva já vendida — não some, porque às vezes
 * quebrar é mesmo o que a loja quer (alguém pediu demissão).
 */
export function ImpactWarning({
  impact,
  mode = "schedule",
}: {
  impact: ScheduleImpact[];
  mode?: "schedule" | "block";
}) {
  if (impact.length === 0) return null;
  const one = impact.length === 1;
  return (
    <div className="danger-box">
      <strong>
        {mode === "block"
          ? one
            ? "1 reserva já vendida cai dentro deste período"
            : `${impact.length} reservas já vendidas caem dentro deste período`
          : one
            ? "1 reserva já vendida fica fora deste horário"
            : `${impact.length} reservas já vendidas ficam fora deste horário`}
      </strong>
      <p>
        Salvar não cancela nada: elas continuam na agenda,{" "}
        {mode === "block" ? "dentro do período fechado" : "fora da jornada"}. Avise o cliente ou
        remarque em Agenda antes de confirmar.
      </p>
      <ul style={{ listStyle: "none", margin: "8px 0 0", padding: 0 }}>
        {impact.slice(0, 6).map((item) => (
          <li key={item.id} style={{ fontSize: 12, color: MUTED, lineHeight: 1.7 }}>
            <b style={{ color: AMBER }}>{dateTimeLabel(item.startsAt)}</b> · {item.customerName} ·{" "}
            {item.serviceName} · {item.professionalName}
          </li>
        ))}
        {impact.length > 6 ? (
          <li style={{ fontSize: 12, color: MUTED }}>e mais {impact.length - 6}.</li>
        ) : null}
      </ul>
    </div>
  );
}
