"use client";

import { useState } from "react";

import { QuotaCells, StatusChip } from "./blocks";
import { STATUS, type Chip } from "./data";
import { FormError, useRun } from "./dialogs";
import { brl, count, type City } from "./model";
import { useAdmin } from "./store";
import { AMBER, FAINT, GREEN, RED } from "./tokens";

const STATUS_CHIP: Record<City["status"], Chip> = {
  active: STATUS.ativa,
  pre_launch: STATUS.pre,
  evaluating: STATUS.aval,
};

/** Cidade sem cota vai para o fim; entre as outras, quem tem menos vaga vem antes. */
function byRemaining(a: City, b: City): number {
  if (!a.quotaTotal !== !b.quotaTotal) return a.quotaTotal ? -1 : 1;
  return (
    a.quotaTotal - a.quotaUsed - (b.quotaTotal - b.quotaUsed) ||
    a.name.localeCompare(b.name, "pt-BR")
  );
}

export function Cities({ focusId, onNewCity }: { focusId?: string; onNewCity: () => void }) {
  const { data, actions } = useAdmin();
  const statusRun = useRun();
  const cities = data.cities.slice().sort(byRemaining);
  const [selected, setSelected] = useState(
    focusId ?? data.cities[1]?.id ?? data.cities[0]?.id ?? "",
  );
  const city = cities.find((item) => item.id === selected) ?? cities[0];
  if (!city) return null;

  const left = city.quotaTotal - city.quotaUsed;
  const nextStatus =
    city.status === "evaluating"
      ? "pre_launch"
      : city.status === "active"
        ? "pre_launch"
        : "active";
  const nextStatusLabel =
    city.status === "evaluating"
      ? "Iniciar pré-lançamento"
      : city.status === "active"
        ? "Voltar ao pré-lançamento"
        : "Ativar cidade";

  return (
    <div className="cities-grid">
      <div className="stack tight">
        <div className="filter-bar">
          <span className="hint">Ordenado por vagas restantes</span>
          <div className="spacer" />
          <button className="primary" onClick={onNewCity} type="button">
            Abrir nova cidade
          </button>
        </div>

        <div className="card clip">
          <div className="table-wrap">
            <table className="rows">
              <thead>
                <tr>
                  <th>Cidade</th>
                  <th>Situação</th>
                  <th className="right">Estab.</th>
                  <th className="right">Vagas</th>
                  <th>Mensalidade</th>
                  <th className="right">Clientes</th>
                  <th className="right">Agend./mês</th>
                  <th className="right">Lacunas</th>
                </tr>
              </thead>
              <tbody>
                {cities.map((item) => {
                  const free = item.quotaTotal - item.quotaUsed;
                  const tone =
                    item.quotaTotal === 0 ? FAINT : free <= 0 ? RED : free <= 3 ? AMBER : GREEN;
                  return (
                    <tr
                      aria-selected={item.id === city.id}
                      className={item.id === city.id ? "picked" : undefined}
                      key={item.id}
                      onClick={() => setSelected(item.id)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          setSelected(item.id);
                        }
                      }}
                      tabIndex={0}
                    >
                      <td className="marker">
                        <strong>{item.name}</strong>
                        <code className="uf">{item.uf}</code>
                      </td>
                      <td>
                        <StatusChip chip={STATUS_CHIP[item.status]} />
                      </td>
                      <td className="right mono">{count(item.establishments)}</td>
                      <td className="right mono strong">
                        {item.quotaTotal ? `${item.quotaUsed}/${item.quotaTotal}` : "—"}
                      </td>
                      <td className="strong" style={{ color: tone, fontSize: "11.5px" }}>
                        {item.quotaTotal ? (free <= 0 ? "esgotada" : `${free} livres`) : "—"}
                      </td>
                      <td className="right mono">{count(item.customers)}</td>
                      <td className="right mono">{count(item.appointmentsMonth)}</td>
                      <td className="right mono strong" style={{ color: AMBER }}>
                        {item.gaps.length}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <aside className="card inspector">
        <div className="inspector-head">
          <div className="title-row">
            <h3>{city.name}</h3>
            <code className="uf">{city.uf}</code>
            <StatusChip chip={STATUS_CHIP[city.status]} small />
          </div>
          <p>
            Mensalidade local{" "}
            {city.monthlyPriceCents !== null ? brl(city.monthlyPriceCents) : "ainda sem preço"}
          </p>
          <button
            className={city.status === "active" ? "ghost small" : "primary small"}
            disabled={statusRun.pending}
            onClick={() =>
              void statusRun.run(() => actions.setCityStatus(city.id, nextStatus), {
                title: "Situação da cidade atualizada",
                sub:
                  nextStatus === "active"
                    ? `${city.name} já aparece na busca.`
                    : `${city.name} saiu da busca e voltou ao pré-lançamento.`,
              })
            }
            type="button"
          >
            {statusRun.pending ? "Salvando…" : nextStatusLabel}
          </button>
          <FormError message={statusRun.error} />
        </div>

        <div className="inspector-block">
          <div className="inline-head">
            <span>Vagas de mensalidade</span>
            <code>
              {city.quotaUsed}/{city.quotaTotal}
            </code>
          </div>
          {city.quotaTotal ? (
            <QuotaCells size="md" total={city.quotaTotal} used={city.quotaUsed} />
          ) : null}
          <p
            className="strong-note"
            style={{ color: !city.quotaTotal ? FAINT : left <= 0 ? RED : GREEN }}
          >
            {!city.quotaTotal
              ? "Sem cota definida — defina em Cotas e planos"
              : left <= 0
                ? "Esgotada — novos entram por comissão"
                : `${left} vagas de mensalidade livres`}
          </p>
        </div>

        <div className="stat-row three">
          <div>
            <code>{count(city.establishments)}</code>
            <small>Estabelec.</small>
          </div>
          <div>
            <code>{count(city.customers)}</code>
            <small>Clientes</small>
          </div>
          <div>
            <code>{count(city.appointmentsMonth)}</code>
            <small>Agend./mês</small>
          </div>
        </div>

        <div className="inspector-block">
          <p className="field-group-label">Categorias cobertas</p>
          {city.categories.length ? (
            <div className="tag-row">
              {city.categories.map((cat) => (
                <span className="tag" key={cat}>
                  {cat}
                </span>
              ))}
            </div>
          ) : (
            <p className="hint">Nenhuma loja ativa ainda.</p>
          )}
        </div>

        <div className="inspector-block last">
          <p className="field-group-label amber">Buscado sem resultado · 30 dias</p>
          {city.gaps.length ? (
            <>
              <div className="tag-row">
                {city.gaps.map((gap) => (
                  <span className="tag amber" key={gap}>
                    {gap}
                  </span>
                ))}
              </div>
              <p className="hint">
                Essas lacunas orientam a prospecção: nenhum estabelecimento local atende a busca por
                esses serviços.
              </p>
            </>
          ) : (
            <p className="hint">Toda busca feita aqui nos últimos 30 dias encontrou algo.</p>
          )}
        </div>
      </aside>
    </div>
  );
}
