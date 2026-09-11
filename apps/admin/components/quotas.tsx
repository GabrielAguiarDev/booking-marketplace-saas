"use client";

import { useState } from "react";

import { CircleAlert, StatusChip } from "./blocks";
import { STATUS } from "./data";
import { FormError, useRun } from "./dialogs";
import { brl, count, type PlanDef } from "./model";

/** "229,00" → 22900 */
const toCents = (text: string) =>
  Math.round(Number(text.replace(/[^\d,]/g, "").replace(",", ".")) * 100) || 0;
const priceText = (cents: number) => (cents / 100).toFixed(2).replace(".", ",");
import { useAdmin } from "./store";
import { AMBER, FAINT, INK, RED } from "./tokens";

type Feature = readonly [label: string, value: string, tone: string];

function features(plan: PlanDef): Feature[] {
  return [
    [
      "Profissionais",
      plan.maxProfessionals === null ? "sem limite" : `até ${plan.maxProfessionals}`,
      "mono",
    ],
    ["Filiais", plan.maxBranches === null ? "sem limite" : `até ${plan.maxBranches}`, "mono"],
    [
      "Fila de espera",
      plan.queueIncluded ? "Incluída" : "Não incluída",
      plan.queueIncluded ? "green" : "muted",
    ],
    [
      "Pagamento integrado",
      plan.integratedPayment === "required" ? "Obrigatório" : "Opcional, sem taxa",
      plan.integratedPayment === "required" ? "red" : "",
    ],
    [
      "Destaque na busca",
      plan.searchHighlight ? "Incluído" : "Não incluído",
      plan.searchHighlight ? "green" : "muted",
    ],
  ];
}

export function Quotas({ onEditPlan }: { onEditPlan: (planId: string) => void }) {
  const { data, actions } = useAdmin();
  // Todas as cidades entram: é aqui que uma cidade sem cota ou sem preço ganha os dois.
  const rows = data.cities
    .slice()
    .sort((a, b) => b.quotaTotal - a.quotaTotal || a.name.localeCompare(b.name, "pt-BR"));
  const prices = data.cities.map((c) => c.monthlyPriceCents).filter((c): c is number => c !== null);
  const low = prices.length ? Math.min(...prices) : 0;
  const high = prices.length ? Math.max(...prices) : 0;

  const [draft, setDraft] = useState<Record<string, string>>({});
  const [priceDraft, setPriceDraft] = useState<Record<string, string>>({});
  const changedQuotas = Object.entries(draft).filter(
    ([id, text]) => Number(text) !== data.cities.find((c) => c.id === id)?.quotaTotal,
  );
  const changedPrices = Object.entries(priceDraft).filter(
    ([id, text]) =>
      text !== "" && toCents(text) !== data.cities.find((c) => c.id === id)?.monthlyPriceCents,
  );
  const dirty = changedQuotas.length > 0 || changedPrices.length > 0;
  const discard = () => {
    setDraft({});
    setPriceDraft({});
  };
  const save = useRun(discard);
  const rules = useRun();

  const interval = data.params.find((p) => p.key === "plan_change_interval_days");

  return (
    <div className="stack">
      <section>
        <h2 className="section-title">Catálogo de planos</h2>
        <div className="plan-grid">
          {data.plans.map((plan) => {
            const contracts = data.establishments.filter((e) => e.planId === plan.id).length;
            return (
              <div className="card pad plan-card" key={plan.id}>
                <div className="inline-head">
                  <h3>{plan.name}</h3>
                  <StatusChip chip={plan.active ? STATUS.ativo : STATUS.aval} small />
                </div>
                <p className="plan-price">
                  {plan.kind === "monthly" ? (
                    <>
                      <code>
                        {low === high
                          ? brl(low).replace(",00", "")
                          : `R$ ${Math.round(low / 100)}–${Math.round(high / 100)}`}
                      </code>
                      <span>/mês, por cidade</span>
                    </>
                  ) : (
                    <>
                      <code>{plan.commissionPercent}%</code>
                      <span>sobre agendamentos pagos no app</span>
                    </>
                  )}
                </p>
                <code className="plan-meta">
                  {count(contracts)} {contracts === 1 ? "estabelecimento" : "estabelecimentos"} ·{" "}
                  {plan.kind === "monthly" ? "vagas limitadas" : "sem limite de vagas"}
                </code>
                <hr />
                <div className="plan-features">
                  {features(plan).map(([label, value, tone]) => (
                    <div key={label}>
                      <span>{label}</span>
                      <b className={tone}>{value}</b>
                    </div>
                  ))}
                </div>
                <button className="ghost" onClick={() => onEditPlan(plan.id)} type="button">
                  Editar plano
                </button>
              </div>
            );
          })}

          <div className="dashed-card unavailable" title="Depende do ciclo de cobrança">
            <svg
              fill="none"
              height="20"
              strokeLinecap="round"
              strokeWidth="1.8"
              viewBox="0 0 24 24"
              width="20"
            >
              <path d="M12 5v14M5 12h14" />
            </svg>
            <strong>Novos modelos após integrar a cobrança</strong>
            <small>Hoje apenas mensalidade e comissão têm regras completas.</small>
          </div>
        </div>
      </section>

      <section className="quotas-grid">
        <div className="card clip">
          <div className="card-head">
            <div>
              <h3>Cotas de mensalidade por cidade</h3>
              <p>Ao esgotar, novos cadastros passam a receber apenas o plano de comissão.</p>
            </div>
            <div className="head-actions">
              {dirty ? (
                <button className="link muted" onClick={discard} type="button">
                  Descartar
                </button>
              ) : null}
              <button
                className={dirty ? "primary small" : "ghost small"}
                disabled={!dirty || save.pending}
                onClick={() =>
                  void save.run(
                    () =>
                      actions.saveQuotas(
                        Object.fromEntries(changedQuotas.map(([id, text]) => [id, Number(text)])),
                        Object.fromEntries(changedPrices.map(([id, text]) => [id, toCents(text)])),
                      ),
                    {
                      title: "Cotas salvas",
                      sub: "Cotas e preços já valem para os próximos cadastros e trocas de plano.",
                    },
                  )
                }
                type="button"
              >
                {save.pending ? "Salvando…" : "Salvar alterações"}
              </button>
            </div>
          </div>
          <FormError message={save.error} />
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Cidade</th>
                  <th className="fill">Ocupação</th>
                  <th className="right">Ocupadas</th>
                  <th className="right">Restantes</th>
                  <th className="right total">Preço local (R$)</th>
                  <th className="right total">Total de vagas</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((city) => {
                  const text = draft[city.id] ?? String(city.quotaTotal);
                  const total = Number(text) || 0;
                  const left = total - city.quotaUsed;
                  const tone = total === 0 ? FAINT : left <= 0 ? RED : left <= 3 ? AMBER : INK;
                  const invalid = total < city.quotaUsed;
                  return (
                    <tr key={city.id}>
                      <td className="strong">
                        {city.name}/{city.uf}
                      </td>
                      <td>
                        <div className="meter">
                          <span
                            style={{
                              width: `${total ? Math.min(100, Math.round((city.quotaUsed / total) * 100)) : 0}%`,
                              background: left <= 0 ? RED : INK,
                            }}
                          />
                        </div>
                      </td>
                      <td className="right mono">{city.quotaUsed}</td>
                      <td className="right mono strong" style={{ color: tone }}>
                        {Math.max(0, left)}
                      </td>
                      <td className="right">
                        <input
                          aria-label={`Preço local da mensalidade em ${city.name}`}
                          className="mono-input price"
                          id={`price-${city.id}`}
                          inputMode="decimal"
                          onChange={(event) =>
                            setPriceDraft((all) => ({
                              ...all,
                              [city.id]: event.target.value.replace(/[^\d,]/g, ""),
                            }))
                          }
                          placeholder="sem preço"
                          value={
                            priceDraft[city.id] ??
                            (city.monthlyPriceCents === null
                              ? ""
                              : priceText(city.monthlyPriceCents))
                          }
                        />
                      </td>
                      <td className="right">
                        <input
                          aria-invalid={invalid}
                          aria-label={`Total de vagas em ${city.name}`}
                          className={invalid ? "mono-input invalid" : "mono-input"}
                          id={`quota-${city.id}`}
                          inputMode="numeric"
                          onChange={(event) =>
                            setDraft((all) => ({
                              ...all,
                              [city.id]: event.target.value.replace(/\D/g, ""),
                            }))
                          }
                          title={invalid ? `Há ${city.quotaUsed} vagas ocupadas` : undefined}
                          value={text}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="stack tight">
          <div className="card pad">
            <h3 className="card-title">Regras de troca de plano</h3>
            <div className="form-stack">
              <label>
                <span>Intervalo mínimo entre trocas</span>
                <select
                  id="rule-interval"
                  onChange={(event) =>
                    void rules.run(
                      () =>
                        actions.updateParam(
                          "plan_change_interval_days",
                          Number(event.target.value),
                        ),
                      {
                        title: "Regra salva",
                        sub: `O backend passa a exigir ${event.target.value} dias entre trocas.`,
                      },
                    )
                  }
                  value={interval?.value ?? 90}
                >
                  {[...new Set([90, 60, 30, interval?.value ?? 90])]
                    .sort((a, b) => b - a)
                    .map((days) => (
                      <option key={days} value={days}>
                        {days} {days === 1 ? "dia" : "dias"}
                      </option>
                    ))}
                </select>
              </label>
              <p className="hint">
                Trocas são aplicadas imediatamente. Suspender uma loja libera a vaga; reativar
                confere a cota novamente.
              </p>
              <FormError message={rules.error} />
            </div>
          </div>

          <div className="notice amber">
            <div className="notice-head">
              <CircleAlert />
              <strong>Alterações afetam contratos vigentes</strong>
            </div>
            <p>
              Editar preço, limites ou percentual de um plano muda o que já está contratado. O
              número de estabelecimentos impactados é mostrado antes de confirmar.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
