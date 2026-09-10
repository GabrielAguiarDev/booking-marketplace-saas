"use client";

import { CircleAlert, StatusChip, Toggle } from "./blocks";
import { chip, CITIES } from "./data";
import { AMBER, INK, RED } from "./tokens";

const MONTHLY_PLAN = [
  ["Profissionais", "até 12", "mono"],
  ["Filiais", "até 3", "mono"],
  ["Fila de espera", "Incluída", "green"],
  ["Pagamento integrado", "Opcional, sem taxa", ""],
  ["Destaque na busca", "Incluído", "green"],
] as const;

const COMMISSION_PLAN = [
  ["Profissionais", "sem limite", "mono"],
  ["Filiais", "até 1", "mono"],
  ["Fila de espera", "Incluída", "green"],
  ["Pagamento integrado", "Obrigatório", "red"],
  ["Destaque na busca", "Não incluído", "muted"],
] as const;

export function Quotas({ onEditPlan }: { onEditPlan: () => void }) {
  const rows = CITIES.filter((city) => city.qt > 0);

  return (
    <div className="stack">
      <section>
        <h2 className="section-title">Catálogo de planos</h2>
        <div className="plan-grid">
          <PlanCard
            features={MONTHLY_PLAN}
            meta="802 estabelecimentos · vagas limitadas"
            name="Mensalidade fixa"
            onEdit={onEditPlan}
            price="R$ 249–349"
            unit="/mês, por cidade"
          />
          <PlanCard
            features={COMMISSION_PLAN}
            meta="482 estabelecimentos · sem limite de vagas"
            name="Comissão por agendamento"
            onEdit={onEditPlan}
            price="12%"
            unit="sobre agendamentos pagos no app"
          />
          <button className="dashed-card" type="button">
            <svg fill="none" height="20" strokeLinecap="round" strokeWidth="1.8" viewBox="0 0 24 24" width="20">
              <path d="M12 5v14M5 12h14" />
            </svg>
            <strong>Novo modelo de cobrança</strong>
            <small>Ex.: híbrido, franquia de agendamentos</small>
          </button>
        </div>
      </section>

      <section className="quotas-grid">
        <div className="card clip">
          <div className="card-head">
            <div>
              <h3>Cotas de mensalidade por cidade</h3>
              <p>Ao esgotar, novos cadastros passam a receber apenas o plano de comissão.</p>
            </div>
            <button className="ghost small" type="button">
              Salvar alterações
            </button>
          </div>
          <table>
            <thead>
              <tr>
                <th>Cidade</th>
                <th className="fill">Ocupação</th>
                <th className="right">Ocupadas</th>
                <th className="right">Restantes</th>
                <th className="right">Preço local</th>
                <th className="right total">Total de vagas</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((city) => {
                const left = city.qt - city.qu;
                const tone = left === 0 ? RED : left <= 3 ? AMBER : INK;
                return (
                  <tr key={city.id}>
                    <td className="strong">
                      {city.name}/{city.uf}
                    </td>
                    <td>
                      <div className="meter">
                        <span
                          style={{
                            width: `${Math.round((city.qu / city.qt) * 100)}%`,
                            background: left === 0 ? RED : INK,
                          }}
                        />
                      </div>
                    </td>
                    <td className="right mono">{city.qu}</td>
                    <td className="right mono strong" style={{ color: tone }}>
                      {left}
                    </td>
                    <td className="right mono">{city.price}</td>
                    <td className="right">
                      <input className="mono-input" defaultValue={city.qt} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="stack tight">
          <div className="card pad">
            <h3 className="card-title">Regras de troca de plano</h3>
            <div className="form-stack">
              <label>
                <span>Quando entra em vigor</span>
                <select defaultValue="No próximo ciclo de cobrança">
                  <option>No próximo ciclo de cobrança</option>
                  <option>Imediatamente, com pró-rata</option>
                </select>
              </label>
              <label>
                <span>Intervalo mínimo entre trocas</span>
                <select defaultValue="90 dias">
                  <option>90 dias</option>
                  <option>60 dias</option>
                  <option>30 dias</option>
                </select>
              </label>
              <div className="toggle-row">
                <Toggle on />
                <span>
                  Liberar vaga de mensalidade automaticamente quando um estabelecimento cancela
                </span>
              </div>
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

function PlanCard({
  name,
  price,
  unit,
  meta,
  features,
  onEdit,
}: {
  name: string;
  price: string;
  unit: string;
  meta: string;
  features: readonly (readonly [string, string, string])[];
  onEdit: () => void;
}) {
  return (
    <div className="card pad plan-card">
      <div className="inline-head">
        <h3>{name}</h3>
        <StatusChip chip={chip("ativo")} small />
      </div>
      <p className="plan-price">
        <code>{price}</code>
        <span>{unit}</span>
      </p>
      <code className="plan-meta">{meta}</code>
      <hr />
      <div className="plan-features">
        {features.map(([label, value, tone]) => (
          <div key={label}>
            <span>{label}</span>
            <b className={tone}>{value}</b>
          </div>
        ))}
      </div>
      <button className="ghost" onClick={onEdit} type="button">
        Editar plano
      </button>
    </div>
  );
}
