"use client";

import { useMemo, useState } from "react";

import { FormError, Modal, useRun } from "./dialogs";
import { brl, count, type CatalogItem, type Suggestion } from "./model";
import { useAdmin } from "./store";

export function Services() {
  const { data } = useAdmin();
  const groups = useMemo(() => {
    const map = new Map<string, CatalogItem[]>();
    for (const item of data.catalog) map.set(item.group, [...(map.get(item.group) ?? []), item]);
    return [...map.entries()];
  }, [data.catalog]);

  const [selected, setSelected] = useState(data.catalog[0]?.id ?? "");
  const [creating, setCreating] = useState(false);
  const [merging, setMerging] = useState<Suggestion | null>(null);
  const item = data.catalog.find((c) => c.id === selected) ?? data.catalog[0];

  return (
    <div className="services-grid">
      <div className="card clip">
        <div className="list-head plain">Categorias</div>
        <div className="catalog">
          {groups.map(([group, items]) => (
            <div className="catalog-group" key={group}>
              <p>{group}</p>
              {items.map((entry) => (
                <button
                  aria-pressed={entry.id === item?.id}
                  className={entry.id === item?.id ? "catalog-item active" : "catalog-item"}
                  key={entry.id}
                  onClick={() => setSelected(entry.id)}
                  type="button"
                >
                  <span>{entry.name}</span>
                  <code>{entry.establishments}</code>
                </button>
              ))}
            </div>
          ))}
          <button className="dashed-button" onClick={() => setCreating(true)} type="button">
            <svg
              fill="none"
              height="13"
              strokeLinecap="round"
              strokeWidth="2"
              viewBox="0 0 24 24"
              width="13"
            >
              <path d="M12 5v14M5 12h14" />
            </svg>
            Novo item de catálogo
          </button>
        </div>
      </div>

      {item ? (
        <ItemEditor item={item} key={item.id} />
      ) : (
        <div className="card pad hint">O catálogo está vazio.</div>
      )}

      <div className="stack tight">
        <Suggestions onMerge={setMerging} />

        <div className="card clip">
          <div className="list-head stacked">
            <span>Buscas sem resultado</span>
            <small>O que falta no catálogo — e quem prospectar</small>
          </div>
          {data.noResults.length === 0 ? (
            <p className="table-empty">Toda busca do mês encontrou algo.</p>
          ) : null}
          {data.noResults.map((entry) => (
            <div className="noresult" key={`${entry.term}-${entry.city}`}>
              <div>
                <strong>{entry.term}</strong>
                <small>{entry.city}</small>
              </div>
              <code>{count(entry.count)}</code>
            </div>
          ))}
        </div>
      </div>

      {creating ? (
        <NewItemDialog
          groups={groups.map(([group]) => group)}
          onClose={() => setCreating(false)}
          onCreated={(id) => setSelected(id)}
        />
      ) : null}
      {merging ? <MergeDialog onClose={() => setMerging(null)} suggestion={merging} /> : null}
    </div>
  );
}

function ItemEditor({ item }: { item: CatalogItem }) {
  const { data, actions } = useAdmin();
  const [name, setName] = useState(item.name);
  const [minutes, setMinutes] = useState(String(item.durationMinutes));
  const [synonyms, setSynonyms] = useState(item.synonyms);
  const [term, setTerm] = useState("");
  const [adding, setAdding] = useState(false);
  const save = useRun();
  const cities = new Set(data.establishments.map((e) => e.cityId)).size;

  const dirty =
    name.trim() !== item.name ||
    Number(minutes) !== item.durationMinutes ||
    synonyms.join("|") !== item.synonyms.join("|");

  const addTerm = () => {
    const clean = term.trim().toLowerCase();
    if (clean && !synonyms.includes(clean) && clean !== name.trim().toLowerCase()) {
      setSynonyms((list) => [...list, clean]);
    }
    setTerm("");
    setAdding(false);
  };

  return (
    <div className="card">
      <div className="detail-head">
        <div>
          <p className="field-group-label">{item.group}</p>
          <h2 className="item-title">{item.name}</h2>
          <p className="detail-sub">
            Oferecido por <code>{count(item.establishments)}</code>{" "}
            {item.establishments === 1 ? "estabelecimento" : "estabelecimentos"} em {cities}{" "}
            {cities === 1 ? "cidade" : "cidades"}
          </p>
        </div>
        <button
          className="primary"
          disabled={!dirty || save.pending}
          onClick={() =>
            void save.run(
              () =>
                actions.saveCatalogItem(item.id, {
                  name,
                  durationMinutes: Number(minutes),
                  synonyms,
                }),
              {
                title: "Item salvo",
                sub: `A busca do app passa a reconhecer ${synonyms.length} nomes alternativos.`,
              },
            )
          }
          type="button"
        >
          {save.pending ? "Salvando…" : "Salvar item"}
        </button>
      </div>
      <div className="item-body">
        <FormError message={save.error} />
        <div className="row-fields">
          <label className="field-grow">
            <span>Nome no catálogo</span>
            <input
              id="catalog-name"
              onChange={(event) => setName(event.target.value)}
              value={name}
            />
          </label>
          <label className="field-fixed">
            <span>Duração sugerida (min)</span>
            <input
              className="mono"
              id="catalog-minutes"
              inputMode="numeric"
              onChange={(event) => setMinutes(event.target.value.replace(/\D/g, ""))}
              value={minutes}
            />
          </label>
        </div>

        <div>
          <span className="field-label">Nomes alternativos reconhecidos pela busca</span>
          <div className="tag-row">
            {synonyms.map((synonym) => (
              <span className="tag removable" key={synonym}>
                {synonym}
                <button
                  aria-label={`Remover ${synonym}`}
                  className="tag-remove"
                  onClick={() => setSynonyms((list) => list.filter((s) => s !== synonym))}
                  type="button"
                >
                  <svg
                    fill="none"
                    height="11"
                    strokeLinecap="round"
                    strokeWidth="2.2"
                    viewBox="0 0 24 24"
                    width="11"
                  >
                    <path d="M6 6l12 12M18 6L6 18" />
                  </svg>
                </button>
              </span>
            ))}
            {adding ? (
              <form
                className="term-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  addTerm();
                }}
              >
                <input
                  aria-label="Novo nome alternativo"
                  autoFocus
                  id="catalog-term"
                  onBlur={addTerm}
                  onChange={(event) => setTerm(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Escape") {
                      setTerm("");
                      setAdding(false);
                    }
                  }}
                  placeholder="nome alternativo"
                  value={term}
                />
              </form>
            ) : (
              <button
                className="dashed-button inline-pair"
                onClick={() => setAdding(true)}
                type="button"
              >
                + termo
              </button>
            )}
          </div>
        </div>

        <div className="mini-stats">
          <div>
            <p className="kpi-label">Buscas no mês</p>
            <code>{count(item.searchesMonth)}</code>
          </div>
          <div>
            <p className="kpi-label">Agendamentos no mês</p>
            <code>{count(item.appointmentsMonth)}</code>
          </div>
          <div>
            <p className="kpi-label">Preço médio</p>
            <code>{item.averagePriceCents !== null ? brl(item.averagePriceCents) : "—"}</code>
          </div>
        </div>
      </div>
    </div>
  );
}

function Suggestions({ onMerge }: { onMerge: (s: Suggestion) => void }) {
  const { data, actions } = useAdmin();
  const { error, run } = useRun();
  const [busy, setBusy] = useState<string | null>(null);

  const resolve = (s: Suggestion, resolution: "approve" | "reject") => {
    setBusy(s.id);
    void run(() => actions.resolveSuggestion(s.id, resolution), {
      title: resolution === "approve" ? "Sugestão aprovada" : "Sugestão recusada",
      sub:
        resolution === "approve"
          ? `${s.name} entrou no catálogo, em Sugeridos.`
          : `${s.name} não entra no catálogo; a decisão ficou registrada.`,
    }).finally(() => setBusy(null));
  };

  return (
    <div className="card clip">
      <div className="list-head">
        <span>Sugestões pendentes</span>
        <code className="amber">{data.suggestions.length}</code>
      </div>
      <FormError message={error} />
      {data.suggestions.length === 0 ? (
        <p className="table-empty">Nenhuma sugestão esperando.</p>
      ) : null}
      {data.suggestions.map((s) => (
        <div className="suggest" key={s.id}>
          <div className="inline-head">
            <strong>{s.name}</strong>
            <code>
              {s.requests} {s.requests === 1 ? "pedido" : "pedidos"}
            </code>
          </div>
          <small>
            {s.group} · {s.establishment} · {s.city}
          </small>
          <div className="suggest-actions">
            <button
              className="primary tiny"
              disabled={busy === s.id}
              onClick={() => resolve(s, "approve")}
              type="button"
            >
              Aprovar
            </button>
            <button
              className="ghost tiny"
              disabled={busy === s.id}
              onClick={() => onMerge(s)}
              type="button"
            >
              Mesclar
            </button>
            <button
              className="ghost tiny danger"
              disabled={busy === s.id}
              onClick={() => resolve(s, "reject")}
              type="button"
            >
              Recusar
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

function NewItemDialog({
  groups,
  onClose,
  onCreated,
}: {
  groups: string[];
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const { actions } = useAdmin();
  const [group, setGroup] = useState(groups[0] ?? "Barbearia");
  const [name, setName] = useState("");
  const { pending, error, run } = useRun(onClose);

  return (
    <Modal labelledBy="new-item-title" onClose={onClose} width={440}>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void run(
            async () => {
              const id = await actions.createCatalogItem(group, name);
              onCreated(id);
            },
            {
              title: "Item criado",
              sub: `${name.trim()} entrou em ${group}. Complete os nomes alternativos.`,
            },
          );
        }}
      >
        <div className="modal-head">
          <h3 id="new-item-title">Novo item de catálogo</h3>
          <p>O item organiza a busca: as lojas continuam com o próprio nome, preço e duração.</p>
        </div>
        <div className="modal-body">
          <label>
            <span>Categoria</span>
            <select
              id="new-item-group"
              onChange={(event) => setGroup(event.target.value)}
              value={group}
            >
              {groups.map((g) => (
                <option key={g}>{g}</option>
              ))}
            </select>
          </label>
          <label>
            <span>Nome</span>
            <input
              autoFocus
              id="new-item-name"
              onChange={(event) => setName(event.target.value)}
              placeholder="Ex.: Corte infantil"
              value={name}
            />
          </label>
          <FormError message={error} />
        </div>
        <div className="modal-foot">
          <button className="ghost" onClick={onClose} type="button">
            Cancelar
          </button>
          <button className="primary" disabled={pending || name.trim().length < 2} type="submit">
            {pending ? "Criando…" : "Criar item"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function MergeDialog({ suggestion, onClose }: { suggestion: Suggestion; onClose: () => void }) {
  const { data, actions } = useAdmin();
  const targets = data.catalog.filter((item) => item.group === suggestion.group);
  const [target, setTarget] = useState(targets[0]?.id ?? "");
  const { pending, error, run } = useRun(onClose);
  const targetName = data.catalog.find((c) => c.id === target)?.name ?? "";

  return (
    <Modal labelledBy="merge-title" onClose={onClose} width={440}>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void run(() => actions.resolveSuggestion(suggestion.id, "merge", target), {
            title: "Sugestão mesclada",
            sub: `“${suggestion.name.toLowerCase()}” virou nome alternativo de ${targetName}.`,
          });
        }}
      >
        <div className="modal-head">
          <h3 id="merge-title">Mesclar {suggestion.name}</h3>
          <p>
            O nome vira um termo alternativo de um item que já existe — a busca passa a encontrá-lo.
          </p>
        </div>
        <div className="modal-body">
          <label>
            <span>Mesclar em</span>
            <select
              id="merge-target"
              onChange={(event) => setTarget(event.target.value)}
              value={target}
            >
              {targets.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.group} · {c.name}
                </option>
              ))}
            </select>
          </label>
          <FormError message={error} />
        </div>
        <div className="modal-foot">
          <button className="ghost" onClick={onClose} type="button">
            Cancelar
          </button>
          <button className="primary" disabled={pending || !target} type="submit">
            {pending ? "Mesclando…" : "Mesclar"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
