"use client";

import { useState } from "react";

import { Placeholder, StatusChip } from "./blocks";
import { APPROVALS, chip, DECISIONS, QUOTA_BY_CITY } from "./data";
import { AMBER, GREEN, GREEN_SOFT, RED, RED_SOFT } from "./tokens";

/** `auto` deixa a cota decidir; escolher trava o plano naquela solicitação. */
type PlanChoice = "auto" | "mens" | "com";

export function Approvals() {
  const [selected, setSelected] = useState(APPROVALS[0]!.id);
  const [plan, setPlan] = useState<PlanChoice>("auto");

  const appr = APPROVALS.find((item) => item.id === selected) ?? APPROVALS[0]!;
  const quota = QUOTA_BY_CITY[appr.city];
  const left = quota ? quota[0] - quota[1] : 0;
  const sold = left === 0;
  const effective: Exclude<PlanChoice, "auto"> = plan !== "auto" ? plan : sold ? "com" : "mens";

  const photos = Math.min(appr.photos, 5);

  return (
    <div className="stack">
      <div className="approvals-grid">
        <div className="card clip">
          <div className="list-head">
            <span>Fila · ordenada por espera</span>
            <code>{APPROVALS.length}</code>
          </div>
          <div className="list">
            {APPROVALS.map((item) => (
              <button
                className={item.id === appr.id ? "list-row active" : "list-row"}
                key={item.id}
                onClick={() => {
                  setSelected(item.id);
                  setPlan("auto");
                }}
                type="button"
              >
                <div className="list-main">
                  <strong>{item.name}</strong>
                  <small>
                    {item.city} · {item.cat}
                  </small>
                </div>
                <div className="list-side">
                  <code style={{ color: item.late ? RED : AMBER }}>{item.wait}</code>
                  <small>esperando</small>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="detail-head">
            <div>
              <div className="title-row">
                <h2>{appr.name}</h2>
                <StatusChip chip={chip("pendente")} />
              </div>
              <p className="detail-sub">
                {appr.city} · {appr.cat} · solicitado há <code>{appr.wait}</code>
              </p>
            </div>
            <div className="actions">
              <button className="ghost danger" type="button">
                Recusar
              </button>
              <button className="ghost" type="button">
                Solicitar correção
              </button>
              <button className="primary" type="button">
                Aprovar
              </button>
            </div>
          </div>

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
                  <p>{appr.razao}</p>
                </div>
                <div className="wide">
                  <small>Endereço</small>
                  <p>{appr.addr}</p>
                </div>
                <div>
                  <small>Responsável</small>
                  <p>{appr.resp}</p>
                </div>
                <div>
                  <small>Contato</small>
                  <code>{appr.fone}</code>
                </div>
                <div className="wide">
                  <small>E-mail</small>
                  <p>{appr.email}</p>
                </div>
              </div>

              <hr />

              <div className="field-group-head">
                <p className="field-group-label">Fotos enviadas</p>
                <code>{appr.photos} arquivos</code>
              </div>
              <div className="photo-strip">
                {Array.from({ length: photos }, (_, i) => (
                  <div className="photo" key={i}>
                    <Placeholder />
                  </div>
                ))}
              </div>

              <hr />

              <div className="field-group-head">
                <p className="field-group-label">Serviços que pretende oferecer</p>
                <code>{appr.pros} profissionais</code>
              </div>
              <div className="tag-row">
                {appr.servs.map((service) => (
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
                style={{
                  background: sold ? RED_SOFT : GREEN_SOFT,
                  color: sold ? RED : GREEN,
                }}
              >
                {quota
                  ? sold
                    ? `Vagas de mensalidade esgotadas em ${appr.city} (${quota[1]}/${quota[0]}). Este estabelecimento entra no plano de comissão.`
                    : `Restam ${left} vagas de mensalidade em ${appr.city} (${quota[1]}/${quota[0]} ocupadas).`
                  : ""}
              </p>

              <div className="plan-options">
                <PlanOption
                  disabled={sold}
                  label="Mensalidade fixa"
                  meta={`R$ 349,00/mês · ${sold ? "sem vaga nesta cidade" : `${left} vagas livres`}`}
                  onSelect={() => !sold && setPlan("mens")}
                  selected={effective === "mens" && !sold}
                />
                <PlanOption
                  label="Comissão por agendamento"
                  meta="12% sobre agendamentos pagos no app"
                  onSelect={() => setPlan("com")}
                  selected={effective === "com"}
                />
              </div>

              <hr />

              <p className="field-group-label">Mensagem ao solicitante</p>
              <textarea placeholder="Usada ao recusar ou solicitar correção" />
            </div>
          </div>
        </div>
      </div>

      <div className="card clip">
        <div className="card-head">
          <h3>Histórico de decisões</h3>
        </div>
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
            {DECISIONS.map((decision) => (
              <tr key={`${decision.name}-${decision.when}`}>
                <td className="strong">{decision.name}</td>
                <td className="muted">{decision.city}</td>
                <td className="strong" style={{ color: decision.tone }}>
                  {decision.dec}
                </td>
                <td>{decision.plan}</td>
                <td>{decision.who}</td>
                <td className="right mono muted">{decision.when}</td>
              </tr>
            ))}
          </tbody>
        </table>
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
      className={selected ? "plan-option selected" : "plan-option"}
      onClick={onSelect}
      style={disabled ? { opacity: 0.45 } : undefined}
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
