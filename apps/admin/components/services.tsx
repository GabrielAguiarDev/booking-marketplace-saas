"use client";

import { ALT_NAMES, CATALOG, NORESULT, SUGGEST } from "./data";

export function Services() {
  return (
    <div className="services-grid">
      <div className="card clip">
        <div className="list-head plain">Categorias</div>
        <div className="catalog">
          {CATALOG.map((group) => (
            <div className="catalog-group" key={group.group}>
              <p>{group.group}</p>
              {group.items.map((item) => (
                <button
                  className={"sel" in item && item.sel ? "catalog-item active" : "catalog-item"}
                  key={item.name}
                  type="button"
                >
                  <span>{item.name}</span>
                  <code>{item.n}</code>
                </button>
              ))}
            </div>
          ))}
          <button className="dashed-button" type="button">
            <svg fill="none" height="13" strokeLinecap="round" strokeWidth="2" viewBox="0 0 24 24" width="13">
              <path d="M12 5v14M5 12h14" />
            </svg>
            Novo item de catálogo
          </button>
        </div>
      </div>

      <div className="card">
        <div className="detail-head">
          <div>
            <p className="field-group-label">Barbearia</p>
            <h2 className="item-title">Corte masculino</h2>
            <p className="detail-sub">
              Oferecido por <code>1.104</code> estabelecimentos em 8 cidades
            </p>
          </div>
          <button className="primary" type="button">
            Salvar item
          </button>
        </div>
        <div className="item-body">
          <div className="row-fields">
            <label className="field-grow">
              <span>Nome no catálogo</span>
              <input defaultValue="Corte masculino" />
            </label>
            <label className="field-fixed">
              <span>Duração sugerida</span>
              <input className="mono" defaultValue="30 min" />
            </label>
          </div>

          <label>
            <span>Nomes alternativos reconhecidos pela busca</span>
            <div className="tag-row">
              {ALT_NAMES.map((name) => (
                <span className="tag removable" key={name}>
                  {name}
                  <svg fill="none" height="11" strokeLinecap="round" strokeWidth="2.2" viewBox="0 0 24 24" width="11">
                    <path d="M6 6l12 12M18 6L6 18" />
                  </svg>
                </span>
              ))}
              <button className="dashed-button inline-pair" type="button">
                + termo
              </button>
            </div>
          </label>

          <div className="mini-stats">
            <div>
              <p className="kpi-label">Buscas no mês</p>
              <code>48.211</code>
            </div>
            <div>
              <p className="kpi-label">Agendamentos no mês</p>
              <code>31.904</code>
            </div>
            <div>
              <p className="kpi-label">Preço médio</p>
              <code>R$ 48,90</code>
            </div>
          </div>
        </div>
      </div>

      <div className="stack tight">
        <div className="card clip">
          <div className="list-head">
            <span>Sugestões pendentes</span>
            <code className="amber">{SUGGEST.length}</code>
          </div>
          {SUGGEST.map((item) => (
            <div className="suggest" key={item.name}>
              <div className="inline-head">
                <strong>{item.name}</strong>
                <code>{item.n} pedidos</code>
              </div>
              <small>
                {item.by} · {item.city}
              </small>
              <div className="suggest-actions">
                <button className="primary tiny" type="button">
                  Aprovar
                </button>
                <button className="ghost tiny" type="button">
                  Mesclar
                </button>
                <button className="ghost tiny danger" type="button">
                  Recusar
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="card clip">
          <div className="list-head stacked">
            <span>Buscas sem resultado</span>
            <small>O que falta no catálogo — e quem prospectar</small>
          </div>
          {NORESULT.map((item) => (
            <div className="noresult" key={item.term}>
              <div>
                <strong>{item.term}</strong>
                <small>{item.city}</small>
              </div>
              <code>{item.n}</code>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
