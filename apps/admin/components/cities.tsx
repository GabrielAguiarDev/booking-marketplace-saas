"use client";

import { useState } from "react";

import { QuotaCells, StatusChip } from "./blocks";
import { chip, CITIES } from "./data";
import { AMBER, FAINT, GREEN, RED } from "./tokens";

export function Cities({ onNewCity }: { onNewCity: () => void }) {
  const [selected, setSelected] = useState("c2");
  const city = CITIES.find((item) => item.id === selected) ?? CITIES[0]!;
  const left = city.qt - city.qu;

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
              {CITIES.map((item) => {
                const free = item.qt - item.qu;
                const tone =
                  item.qt === 0 ? FAINT : free === 0 ? RED : free <= 3 ? AMBER : GREEN;
                return (
                  <tr
                    className={item.id === city.id ? "picked" : undefined}
                    key={item.id}
                    onClick={() => setSelected(item.id)}
                  >
                    <td className="marker">
                      <strong>{item.name}</strong>
                      <code className="uf">{item.uf}</code>
                    </td>
                    <td>
                      <StatusChip chip={chip(item.st)} />
                    </td>
                    <td className="right mono">{item.est}</td>
                    <td className="right mono strong">
                      {item.qt ? `${item.qu}/${item.qt}` : "—"}
                    </td>
                    <td className="strong" style={{ color: tone, fontSize: "11.5px" }}>
                      {item.qt ? (free === 0 ? "esgotada" : `${free} livres`) : "—"}
                    </td>
                    <td className="right mono">{item.cli}</td>
                    <td className="right mono">{item.appt}</td>
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

      <aside className="card inspector">
        <div className="inspector-head">
          <div className="title-row">
            <h3>{city.name}</h3>
            <code className="uf">{city.uf}</code>
            <StatusChip chip={chip(city.st)} small />
          </div>
          <p>Mensalidade local {city.price}</p>
        </div>

        <div className="inspector-block">
          <div className="inline-head">
            <span>Vagas de mensalidade</span>
            <code>
              {city.qu}/{city.qt}
            </code>
          </div>
          <QuotaCells size="md" total={city.qt} used={city.qu} />
          <p className="strong-note" style={{ color: left === 0 ? RED : GREEN }}>
            {left === 0
              ? "Esgotada — novos entram por comissão"
              : `${left} vagas de mensalidade livres`}
          </p>
        </div>

        <div className="stat-row three">
          <div>
            <code>{city.est}</code>
            <small>Estabelec.</small>
          </div>
          <div>
            <code>{city.cli}</code>
            <small>Clientes</small>
          </div>
          <div>
            <code>{city.appt}</code>
            <small>Agend./mês</small>
          </div>
        </div>

        <div className="inspector-block">
          <p className="field-group-label">Categorias cobertas</p>
          <div className="tag-row">
            {city.cats.map((cat) => (
              <span className="tag" key={cat}>
                {cat}
              </span>
            ))}
          </div>
        </div>

        <div className="inspector-block last">
          <p className="field-group-label amber">Sem nenhum estabelecimento</p>
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
        </div>
      </aside>
    </div>
  );
}
