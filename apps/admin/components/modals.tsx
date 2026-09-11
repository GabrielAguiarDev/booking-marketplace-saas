"use client";

import { useState } from "react";

import { CircleAlert } from "./blocks";
import { FormError, Modal, useRun } from "./dialogs";
import { brl, type PlanKind } from "./model";
import { useAdmin } from "./store";

const UFS = [
  "AC",
  "AL",
  "AM",
  "AP",
  "BA",
  "CE",
  "DF",
  "ES",
  "GO",
  "MA",
  "MG",
  "MS",
  "MT",
  "PA",
  "PB",
  "PE",
  "PI",
  "PR",
  "RJ",
  "RN",
  "RO",
  "RR",
  "RS",
  "SC",
  "SE",
  "SP",
  "TO",
];

/** "229,00" ou "R$ 229" → 22900 */
const toCents = (text: string) =>
  Math.round(Number(text.replace(/[^\d,]/g, "").replace(",", ".")) * 100) || 0;

export function AccessModal({ estabId, onClose }: { estabId: string; onClose: () => void }) {
  const { data, actions } = useAdmin();
  const est = data.establishments.find((item) => item.id === estabId);
  const [reason, setReason] = useState("");
  const [minutes, setMinutes] = useState(15);
  const { pending, error, run } = useRun(onClose);
  if (!est) return null;

  return (
    <Modal labelledBy="access-title" onClose={onClose} width={520}>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void run(() => actions.startAccessSession(est.id, reason, minutes), {
            title: "Autorização registrada",
            sub: `${est.name} · janela de ${minutes} min registrada na auditoria.`,
          });
        }}
      >
        <div className="modal-head">
          <h3 id="access-title">Registrar acesso a {est.name}</h3>
          <p>
            Registre o motivo e a janela autorizada antes de prestar suporte. O console de leitura
            da conta ainda não está conectado; esta ação não abre nem assume a conta da loja.
          </p>
        </div>
        <div className="modal-body">
          <label>
            <span>
              Motivo <b className="required">obrigatório</b>
            </span>
            <textarea
              autoFocus
              id="access-reason"
              onChange={(event) => setReason(event.target.value)}
              placeholder="Ex.: investigar agendamentos duplicados relatados no chamado #4417"
              value={reason}
            />
          </label>
          <div className="row-fields">
            <label className="field-grow">
              <span>Prazo da sessão</span>
              <select
                id="access-minutes"
                onChange={(event) => setMinutes(Number(event.target.value))}
                value={minutes}
              >
                <option value={15}>15 minutos</option>
                <option value={30}>30 minutos</option>
                <option value={60}>1 hora</option>
              </select>
            </label>
            <div className="field-grow">
              <span className="field-label">Escopo atual</span>
              <div className="static-field">
                <strong>Registro de autorização</strong>
              </div>
            </div>
          </div>
          <p className="callout amber icon">
            <CircleAlert />
            Autorização auditada · visível a donos e gerentes no registro da loja
          </p>
          <FormError message={error} />
        </div>
        <div className="modal-foot">
          <button className="ghost" onClick={onClose} type="button">
            Cancelar
          </button>
          <button className="primary" disabled={pending || reason.trim().length < 10} type="submit">
            {pending ? "Registrando…" : "Registrar autorização"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export function CityModal({ onClose }: { onClose: () => void }) {
  const { actions } = useAdmin();
  const [name, setName] = useState("");
  const [uf, setUf] = useState("MG");
  const [quota, setQuota] = useState("12");
  const [price, setPrice] = useState("229,00");
  const { pending, error, run } = useRun(onClose);

  return (
    <Modal labelledBy="city-title" onClose={onClose} width={480}>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void run(
            () => actions.openCity({ name, uf, quota: Number(quota), priceCents: toCents(price) }),
            {
              title: "Cidade aberta",
              sub: `${name.trim()}/${uf} está em pré-lançamento, fora da busca.`,
            },
          );
        }}
      >
        <div className="modal-head">
          <h3 id="city-title">Abrir nova cidade</h3>
          <p>
            A cidade entra em pré-lançamento e não aparece na busca até ser ativada. O cadastro
            público depende do onboarding ainda pendente.
          </p>
        </div>
        <div className="modal-body">
          <div className="row-fields">
            <label className="field-grow">
              <span>Cidade</span>
              <input
                autoFocus
                id="city-name"
                onChange={(event) => setName(event.target.value)}
                placeholder="Ex.: Uberlândia"
                value={name}
              />
            </label>
            <label className="uf-field">
              <span>UF</span>
              <select id="city-uf" onChange={(event) => setUf(event.target.value)} value={uf}>
                {UFS.map((u) => (
                  <option key={u}>{u}</option>
                ))}
              </select>
            </label>
          </div>
          <div className="row-fields">
            <label className="field-grow">
              <span>Vagas de mensalidade</span>
              <input
                className="mono"
                id="city-quota"
                inputMode="numeric"
                onChange={(event) => setQuota(event.target.value.replace(/\D/g, ""))}
                value={quota}
              />
            </label>
            <label className="field-grow">
              <span>Preço do plano ali (R$)</span>
              <input
                className="mono"
                id="city-price"
                inputMode="decimal"
                onChange={(event) => setPrice(event.target.value.replace(/[^\d,]/g, ""))}
                value={price}
              />
            </label>
          </div>
          <FormError message={error} />
        </div>
        <div className="modal-foot">
          <button className="ghost" onClick={onClose} type="button">
            Cancelar
          </button>
          <button className="primary" disabled={pending || name.trim().length < 2} type="submit">
            {pending ? "Abrindo…" : "Abrir cidade"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

/**
 * Editar um plano: os valores e, antes de confirmar, quantos contratos vigentes
 * a mudança alcança.
 */
export function PlanImpactModal({ planId, onClose }: { planId: string; onClose: () => void }) {
  const { data, actions } = useAdmin();
  const plan = data.plans.find((p) => p.id === planId);
  const priced = data.cities.filter((c) => c.quotaTotal > 0 && c.monthlyPriceCents !== null);

  const [commission, setCommission] = useState(String(plan?.commissionPercent ?? 12));
  const [maxPros, setMaxPros] = useState(
    plan?.maxProfessionals == null ? "" : String(plan.maxProfessionals),
  );
  const [prices, setPrices] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      priced.map((c) => [c.id, ((c.monthlyPriceCents ?? 0) / 100).toFixed(2).replace(".", ",")]),
    ),
  );
  const { pending, error, run } = useRun(onClose);
  if (!plan) return null;

  const kind: PlanKind = plan.kind;
  const contracts = data.establishments.filter(
    (e) => e.planId === plan.id && e.status !== "suspended",
  );
  const cityCount = new Set(contracts.map((e) => e.cityId)).size;

  const cityPrices = Object.fromEntries(
    Object.entries(prices).map(([id, text]) => [id, toCents(text)]),
  );
  const changes = [
    ...(kind === "monthly"
      ? priced
          .filter((c) => cityPrices[c.id] !== c.monthlyPriceCents)
          .map((c) => [
            `Preço em ${c.name}`,
            `${brl(c.monthlyPriceCents ?? 0)} → ${brl(cityPrices[c.id] ?? 0)}`,
          ])
      : []),
    ...(kind === "commission" && Number(commission) !== plan.commissionPercent
      ? [["Comissão", `${plan.commissionPercent}% → ${commission}%`]]
      : []),
    ...((maxPros === "" ? null : Number(maxPros)) !== plan.maxProfessionals
      ? [
          [
            "Limite de profissionais",
            `${plan.maxProfessionals ?? "sem limite"} → ${maxPros || "sem limite"}`,
          ],
        ]
      : []),
  ];

  return (
    <Modal labelledBy="impact-title" onClose={onClose} width={520}>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void run(
            () =>
              actions.updatePlan(
                plan.id,
                {
                  commissionPercent:
                    kind === "commission" ? Number(commission) : plan.commissionPercent,
                  maxProfessionals: maxPros === "" ? null : Number(maxPros),
                },
                kind === "monthly" ? cityPrices : undefined,
              ),
            {
              title: "Plano atualizado",
              sub: `Valores aplicados agora; ${contracts.length} estabelecimentos usam este modelo.`,
            },
          );
        }}
      >
        <div className="modal-head">
          <h3 id="impact-title">Editar plano {plan.name}</h3>
          <p>Confira o alcance da mudança antes de confirmar.</p>
        </div>
        <div className="modal-body">
          <div className="plan-edit">
            {kind === "commission" ? (
              <label>
                <span>Comissão (%)</span>
                <input
                  className="mono"
                  id="plan-commission"
                  inputMode="numeric"
                  onChange={(event) => setCommission(event.target.value.replace(/\D/g, ""))}
                  value={commission}
                />
              </label>
            ) : null}
            <label>
              <span>Limite de profissionais</span>
              <input
                className="mono"
                id="plan-max-pros"
                inputMode="numeric"
                onChange={(event) => setMaxPros(event.target.value.replace(/\D/g, ""))}
                placeholder="sem limite"
                value={maxPros}
              />
            </label>
          </div>

          {kind === "monthly" ? (
            <div className="price-grid">
              {priced.map((c) => (
                <label key={c.id}>
                  <span>
                    {c.name}/{c.uf}
                  </span>
                  <input
                    className="mono"
                    id={`plan-price-${c.id}`}
                    inputMode="decimal"
                    onChange={(event) =>
                      setPrices((all) => ({
                        ...all,
                        [c.id]: event.target.value.replace(/[^\d,]/g, ""),
                      }))
                    }
                    value={prices[c.id] ?? ""}
                  />
                </label>
              ))}
            </div>
          ) : null}

          <div className="impact-banner">
            <code>{contracts.length}</code>
            <p>
              estabelecimentos vigentes serão impactados em {cityCount}{" "}
              {cityCount === 1 ? "cidade" : "cidades"}. Sem um provedor de cobrança conectado, a
              mudança é aplicada imediatamente e a comunicação precisa ser feita fora do Vez.
            </p>
          </div>
          {changes.length ? (
            <div className="impact-list">
              {changes.map(([k, v], i) => (
                <div className={i === changes.length - 1 ? "last" : undefined} key={k}>
                  <span>{k}</span>
                  <code>{v}</code>
                </div>
              ))}
            </div>
          ) : (
            <p className="hint">Nenhum valor mudou ainda.</p>
          )}
          <FormError message={error} />
        </div>
        <div className="modal-foot">
          <button className="ghost" onClick={onClose} type="button">
            Cancelar
          </button>
          <button className="danger-solid" disabled={pending || !changes.length} type="submit">
            {pending ? "Salvando…" : `Confirmar para ${contracts.length} contratos`}
          </button>
        </div>
      </form>
    </Modal>
  );
}
