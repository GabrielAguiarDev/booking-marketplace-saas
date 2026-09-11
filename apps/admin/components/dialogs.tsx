"use client";

/**
 * Diálogos das ações do admin. Todos seguem o mesmo contrato: rodam a ação,
 * mostram o erro dentro do próprio diálogo se ela falhar, e só fecham — com o
 * aviso de rodapé — quando ela deu certo.
 */

import { useState } from "react";

import type { PlanKind } from "./model";
import { useAdmin, type Toast } from "./store";

export function Modal({
  children,
  onClose,
  width,
  labelledBy,
}: {
  children: React.ReactNode;
  onClose: () => void;
  width: number;
  labelledBy: string;
}) {
  return (
    <div className="overlay" onKeyDown={(event) => event.key === "Escape" && onClose()}>
      <button aria-label="Fechar" className="overlay-backdrop" onClick={onClose} type="button" />
      <div
        aria-labelledby={labelledBy}
        aria-modal="true"
        className="modal"
        role="dialog"
        style={{ width }}
      >
        {children}
      </div>
    </div>
  );
}

/** Estado de uma ação em andamento: roda, captura o erro, avisa no fim. */
export function useRun(onDone?: () => void) {
  const { notify } = useAdmin();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async (action: () => Promise<unknown>, success: Toast) => {
    setPending(true);
    setError(null);
    try {
      await action();
      notify(success);
      onDone?.();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "A ação falhou. Tente de novo.");
    } finally {
      setPending(false);
    }
  };

  return { pending, error, run, setError };
}

export function FormError({ message }: { message: string | null }) {
  return message ? (
    <p className="form-error" role="alert">
      {message}
    </p>
  ) : null;
}

/** Diálogo de um campo de texto: motivo, anotação, mensagem. */
export function TextDialog({
  id,
  title,
  description,
  label,
  placeholder,
  confirmLabel,
  danger = false,
  minLength = 1,
  onClose,
  onConfirm,
  success,
}: {
  id: string;
  title: string;
  description: string;
  label: string;
  placeholder: string;
  confirmLabel: string;
  danger?: boolean;
  minLength?: number;
  onClose: () => void;
  onConfirm: (text: string) => Promise<void>;
  success: Toast;
}) {
  const [text, setText] = useState("");
  const { pending, error, run } = useRun(onClose);
  const ready = text.trim().length >= minLength;

  return (
    <Modal labelledBy={`${id}-title`} onClose={onClose} width={480}>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (ready) void run(() => onConfirm(text), success);
        }}
      >
        <div className="modal-head">
          <h3 id={`${id}-title`}>{title}</h3>
          <p>{description}</p>
        </div>
        <div className="modal-body">
          <label>
            <span>
              {label} <b className="required">obrigatório</b>
            </span>
            <textarea
              autoFocus
              id={`${id}-text`}
              onChange={(event) => setText(event.target.value)}
              placeholder={placeholder}
              value={text}
            />
          </label>
          <FormError message={error} />
        </div>
        <div className="modal-foot">
          <button className="ghost" onClick={onClose} type="button">
            Cancelar
          </button>
          <button
            className={danger ? "danger-solid" : "primary"}
            disabled={!ready || pending}
            type="submit"
          >
            {pending ? "Salvando…" : confirmLabel}
          </button>
        </div>
      </form>
    </Modal>
  );
}

/** Troca de plano de uma ou várias lojas. */
export function PlanDialog({
  ids,
  current,
  onClose,
}: {
  ids: string[];
  current: PlanKind | null;
  onClose: () => void;
}) {
  const { data, actions } = useAdmin();
  const [plan, setPlan] = useState<PlanKind>(current === "monthly" ? "commission" : "monthly");
  const { pending, error, run } = useRun(onClose);
  const selected = data.establishments.filter((e) => ids.includes(e.id));
  const label = selected.length === 1 ? selected[0]!.name : `${selected.length} estabelecimentos`;

  return (
    <Modal labelledBy="plan-title" onClose={onClose} width={460}>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void run(() => actions.changePlan(ids, plan), {
            title: "Plano trocado",
            sub: `${label} passou para ${plan === "monthly" ? "Mensalidade" : "Comissão"}.`,
          });
        }}
      >
        <div className="modal-head">
          <h3 id="plan-title">Trocar plano de {label}</h3>
          <p>
            A troca é imediata enquanto a cobrança não está conectada. Mensalidade ocupa uma vaga da
            cidade.
          </p>
        </div>
        <div className="modal-body">
          <div className="plan-options">
            {(["monthly", "commission"] as const).map((kind) => (
              <button
                aria-pressed={plan === kind}
                className={plan === kind ? "plan-option selected" : "plan-option"}
                key={kind}
                onClick={() => setPlan(kind)}
                type="button"
              >
                <span className="radio">
                  <i />
                </span>
                <span>
                  <strong>
                    {kind === "monthly" ? "Mensalidade fixa" : "Comissão por agendamento"}
                  </strong>
                  <small>
                    {kind === "monthly"
                      ? "Preço da cidade · depende de vaga"
                      : `${data.plans.find((p) => p.kind === "commission")?.commissionPercent ?? 12}% sobre agendamentos pagos no app`}
                  </small>
                </span>
              </button>
            ))}
          </div>
          <FormError message={error} />
        </div>
        <div className="modal-foot">
          <button className="ghost" onClick={onClose} type="button">
            Cancelar
          </button>
          <button className="primary" disabled={pending} type="submit">
            {pending ? "Salvando…" : "Trocar plano"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

/** Desconto percentual por alguns meses. */
export function DiscountDialog({ ids, onClose }: { ids: string[]; onClose: () => void }) {
  const { data, actions } = useAdmin();
  const [percent, setPercent] = useState("10");
  const [months, setMonths] = useState("3");
  const { pending, error, run } = useRun(onClose);
  const selected = data.establishments.filter((e) => ids.includes(e.id));
  const label = selected.length === 1 ? selected[0]!.name : `${selected.length} estabelecimentos`;

  return (
    <Modal labelledBy="discount-title" onClose={onClose} width={440}>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void run(() => actions.applyDiscount(ids, Number(percent), Number(months)), {
            title: "Desconto aplicado",
            sub: `${percent}% para ${label} por ${months} ${months === "1" ? "mês" : "meses"}.`,
          });
        }}
      >
        <div className="modal-head">
          <h3 id="discount-title">Aplicar desconto a {label}</h3>
          <p>Vale sobre a mensalidade ou a comissão, a partir da próxima cobrança.</p>
        </div>
        <div className="modal-body">
          <div className="row-fields">
            <label className="field-grow">
              <span>Desconto (%)</span>
              <input
                className="mono"
                id="discount-percent"
                inputMode="numeric"
                onChange={(event) => setPercent(event.target.value.replace(/\D/g, ""))}
                value={percent}
              />
            </label>
            <label className="field-grow">
              <span>Por quantos meses</span>
              <input
                className="mono"
                id="discount-months"
                inputMode="numeric"
                onChange={(event) => setMonths(event.target.value.replace(/\D/g, ""))}
                value={months}
              />
            </label>
          </div>
          <FormError message={error} />
        </div>
        <div className="modal-foot">
          <button className="ghost" onClick={onClose} type="button">
            Cancelar
          </button>
          <button className="primary" disabled={pending || !percent || !months} type="submit">
            {pending ? "Salvando…" : "Aplicar desconto"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
