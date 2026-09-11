"use client";

import { useState } from "react";

import { Placeholder, StatusChip } from "./blocks";
import { chip } from "./data";
import { FormError, useRun } from "./dialogs";
import { DECISION_LABEL, isLate, planText, stamp, waited, type PlanKind } from "./model";
import { useAdmin } from "./store";
import { AMBER, GREEN, GREEN_SOFT, RED, RED_SOFT } from "./tokens";

/** `auto` deixa a cota decidir; escolher trava o plano naquela solicitação. */
type PlanChoice = "auto" | PlanKind;

const DECISION_TONE = { approved: GREEN, rejected: RED, correction: AMBER } as const;

export function Approvals({ focusId }: { focusId?: string }) {
  const { data, actions } = useAdmin();
  // fila ordenada por espera: quem pediu primeiro aparece em cima
  const queue = data.applications
    .slice()
    .sort((a, b) => a.submittedAt.localeCompare(b.submittedAt));

  const [selected, setSelected] = useState(focusId ?? queue[0]?.id ?? "");
  const [plan, setPlan] = useState<PlanChoice>("auto");
  const [message, setMessage] = useState("");

  const index = Math.max(
    0,
    queue.findIndex((item) => item.id === selected),
  );
  const appr = queue[index];

  const afterDecision = () => {
    // o próximo da fila abre sozinho; no fim, volta para o anterior
    const next = queue[index + 1] ?? queue[index - 1];
    setSelected(next?.id ?? "");
    setPlan("auto");
    setMessage("");
  };
  const { pending, error, run, setError } = useRun(afterDecision);

  const commission = data.plans.find((p) => p.kind === "commission")?.commissionPercent ?? 12;

  return (
    <div className="stack">
      {appr ? (
        <div className="approvals-grid">
          <div className="card clip">
            <div className="list-head">
              <span>Fila · ordenada por espera</span>
              <code>{queue.length}</code>
            </div>
            <div className="list">
              {queue.map((item) => (
                <button
                  className={item.id === appr.id ? "list-row active" : "list-row"}
                  key={item.id}
                  onClick={() => {
                    setSelected(item.id);
                    setPlan("auto");
                    setMessage("");
                    setError(null);
                  }}
                  type="button"
                >
                  <div className="list-main">
                    <strong>{item.name}</strong>
                    <small>
                      {item.city} · {item.category}
                    </small>
                  </div>
                  <div className="list-side">
                    <code style={{ color: isLate(item.submittedAt) ? RED : AMBER }}>
                      {waited(item.submittedAt)}
                    </code>
                    <small>esperando</small>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <ApplicationDetail
            commission={commission}
            error={error}
            message={message}
            onApprove={(effective) =>
              run(() => actions.approveApplication(appr.id, effective, message), {
                title: `${appr.name} aprovado`,
                sub: `Entra no plano ${planText(effective, commission)} e já aparece na busca de ${appr.city}.`,
              })
            }
            onCorrection={() =>
              run(() => actions.requestCorrection(appr.id, message), {
                title: "Correção solicitada",
                sub: "A mensagem ficou registrada; o envio será ligado ao fluxo de onboarding.",
              })
            }
            onMessage={setMessage}
            onPlan={setPlan}
            onReject={() =>
              run(() => actions.rejectApplication(appr.id, message), {
                title: "Solicitação recusada",
                sub: "O motivo ficou registrado; o envio será ligado ao fluxo de onboarding.",
              })
            }
            pending={pending}
            plan={plan}
            selectedId={appr.id}
          />
        </div>
      ) : (
        <div className="empty-queue">
          <span className="empty-mark">
            <svg
              fill="none"
              height="20"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2.2"
              viewBox="0 0 24 24"
              width="20"
            >
              <path d="M20 6L9 17l-5-5" />
            </svg>
          </span>
          <strong>Nenhuma solicitação na fila</strong>
          <p>Todo cadastro novo foi decidido. Os próximos entram aqui assim que forem enviados.</p>
        </div>
      )}

      <div className="card clip">
        <div className="card-head">
          <h3>Histórico de decisões</h3>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Estabelecimento</th>
                <th>Cidade</th>
                <th>Decisão</th>
                <th>Plano definido</th>
                <th>Decidido por</th>
                <th className="right">Quando</th>
              </tr>
            </thead>
            <tbody>
              {data.decisions.map((decision) => (
                <tr key={decision.id}>
                  <td className="strong">{decision.name}</td>
                  <td className="muted">{decision.city}</td>
                  <td className="strong" style={{ color: DECISION_TONE[decision.decision] }}>
                    {DECISION_LABEL[decision.decision]}
                  </td>
                  <td>{decision.plan ? planText(decision.plan, commission) : "—"}</td>
                  <td>{decision.who}</td>
                  <td className="right mono muted">{stamp(decision.at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function ApplicationDetail({
  selectedId,
  plan,
  message,
  pending,
  error,
  commission,
  onPlan,
  onMessage,
  onApprove,
  onReject,
  onCorrection,
}: {
  selectedId: string;
  plan: PlanChoice;
  message: string;
  pending: boolean;
  error: string | null;
  commission: number;
  onPlan: (plan: PlanChoice) => void;
  onMessage: (message: string) => void;
  onApprove: (plan: PlanKind) => void;
  onReject: () => void;
  onCorrection: () => void;
}) {
  const { data } = useAdmin();
  const appr = data.applications.find((a) => a.id === selectedId);
  if (!appr) return null;

  const city = data.cities.find((c) => c.id === appr.cityId);
  const left = city ? city.quotaTotal - city.quotaUsed : 0;
  const sold = left <= 0;
  const effective: PlanKind = plan !== "auto" ? plan : sold ? "commission" : "monthly";
  const price = city?.monthlyPriceCents;
  const photos = Math.min(appr.photos, 5);
  const noMessage = !message.trim();

  return (
    <div className="card">
      <div className="detail-head">
        <div>
          <div className="title-row">
            <h2>{appr.name}</h2>
            <StatusChip chip={chip("pendente")} />
          </div>
          <p className="detail-sub">
            {appr.city} · {appr.category} · solicitado há <code>{waited(appr.submittedAt)}</code>
          </p>
        </div>
        <div className="actions">
          <button
            className="ghost danger"
            disabled={pending}
            onClick={onReject}
            title={noMessage ? "Escreva a mensagem ao solicitante para recusar" : undefined}
            type="button"
          >
            Recusar
          </button>
          <button
            className="ghost"
            disabled={pending}
            onClick={onCorrection}
            title={noMessage ? "Escreva o que precisa ser corrigido" : undefined}
            type="button"
          >
            Solicitar correção
          </button>
          <button
            className="primary"
            disabled={pending}
            onClick={() => onApprove(effective)}
            type="button"
          >
            {pending ? "Salvando…" : "Aprovar"}
          </button>
        </div>
      </div>

      <FormError message={error} />

      <div className="detail-body">
        <div className="detail-main">
          <p className="field-group-label">Dados cadastrais</p>
          <div className="fields">
            <div>
              <small>CNPJ</small>
              <code>{appr.cnpj}</code>
            </div>
            <div>
              <small>Razão social</small>
              <p>{appr.legalName}</p>
            </div>
            <div className="wide">
              <small>Endereço</small>
              <p>{appr.address}</p>
            </div>
            <div>
              <small>Responsável</small>
              <p>{appr.responsible}</p>
            </div>
            <div>
              <small>Contato</small>
              <code>{appr.phone}</code>
            </div>
            <div className="wide">
              <small>E-mail</small>
              <p>{appr.email}</p>
            </div>
          </div>

          <hr />

          <div className="field-group-head">
            <p className="field-group-label">Fotos enviadas</p>
            <code>
              {appr.photos} {appr.photos === 1 ? "arquivo" : "arquivos"}
            </code>
          </div>
          {photos ? (
            <div className="photo-strip">
              {Array.from({ length: photos }, (_, i) => (
                <div className="photo" key={i}>
                  <Placeholder />
                </div>
              ))}
            </div>
          ) : (
            <p className="hint">Nenhuma foto enviada.</p>
          )}

          <hr />

          <div className="field-group-head">
            <p className="field-group-label">Serviços que pretende oferecer</p>
            <code>
              {appr.professionals} {appr.professionals === 1 ? "profissional" : "profissionais"}
            </code>
          </div>
          <div className="tag-row">
            {appr.services.map((service) => (
              <span className="tag" key={service}>
                {service}
              </span>
            ))}
          </div>
        </div>

        <div className="detail-aside">
          <p className="field-group-label">Plano inicial</p>
          <p
            className="quota-note"
            style={{ background: sold ? RED_SOFT : GREEN_SOFT, color: sold ? RED : GREEN }}
          >
            {city
              ? sold
                ? `Vagas de mensalidade esgotadas em ${appr.city} (${city.quotaUsed}/${city.quotaTotal}). Este estabelecimento entra no plano de comissão.`
                : `Restam ${left} vagas de mensalidade em ${appr.city} (${city.quotaUsed}/${city.quotaTotal} ocupadas).`
              : "A cidade ainda não tem cota de mensalidade."}
          </p>

          <div className="plan-options">
            <PlanOption
              disabled={sold}
              label="Mensalidade fixa"
              meta={`${price ? `${(price / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}/mês` : "sem preço na cidade"} · ${sold ? "sem vaga nesta cidade" : `${left} vagas livres`}`}
              onSelect={() => !sold && onPlan("monthly")}
              selected={effective === "monthly" && !sold}
            />
            <PlanOption
              label="Comissão por agendamento"
              meta={`${commission}% sobre agendamentos pagos no app`}
              onSelect={() => onPlan("commission")}
              selected={effective === "commission"}
            />
          </div>

          <hr />

          <label className="field-group-label" htmlFor="appr-message">
            Mensagem ao solicitante
          </label>
          <textarea
            id="appr-message"
            onChange={(event) => onMessage(event.target.value)}
            placeholder="Usada ao recusar ou solicitar correção"
            value={message}
          />
        </div>
      </div>
    </div>
  );
}

function PlanOption({
  label,
  meta,
  selected,
  disabled = false,
  onSelect,
}: {
  label: string;
  meta: string;
  selected: boolean;
  disabled?: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      aria-pressed={selected}
      className={selected ? "plan-option selected" : "plan-option"}
      disabled={disabled}
      onClick={onSelect}
      type="button"
    >
      <span className="radio">
        <i />
      </span>
      <span>
        <strong>{label}</strong>
        <small>{meta}</small>
      </span>
    </button>
  );
}
