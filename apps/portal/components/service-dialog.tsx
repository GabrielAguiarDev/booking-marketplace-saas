"use client";

import { useState } from "react";

import { PROS } from "./data";
import type { AddedService } from "./section-data";

/** "Novo serviço" da seção Serviços: nome, categoria, duração, preço e quem faz. */
export function ServiceDialog({
  onCancel,
  onCreate,
}: {
  onCancel: () => void;
  onCreate: (service: AddedService) => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<AddedService["category"]>("haircut");
  const [minutes, setMinutes] = useState("30");
  const [price, setPrice] = useState("");
  const [pros, setPros] = useState<string[]>([]);

  const priceValue = Number(price.replace(",", "."));
  const minutesValue = Number(minutes);
  const valid =
    name.trim().length > 1 && priceValue > 0 && Number.isInteger(minutesValue) && minutesValue >= 5;

  const toggle = (pro: string) =>
    setPros((list) => (list.includes(pro) ? list.filter((p) => p !== pro) : list.concat([pro])));

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!valid) return;
    onCreate({
      category,
      row: [
        name.trim(),
        description.trim() || "sem descrição",
        `R$ ${Math.round(priceValue)}`,
        `${minutesValue}min`,
        pros.length ? pros.join(" · ") : "ninguém ainda",
        pros.length ? "ativo" : "sem profissional",
      ],
    });
  };

  return (
    <div className="dialog-scrim">
      <button aria-label="Fechar" className="dialog-backdrop" onClick={onCancel} type="button" />
      <form aria-labelledby="service-title" className="dialog" onSubmit={submit}>
        <h2 id="service-title">Novo serviço</h2>
        <p>Aparece no app assim que tiver ao menos um profissional que o faça.</p>
        <div className="dialog-grid">
          <label className="span">
            <span>Nome</span>
            <input
              autoFocus
              id="service-name"
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex.: Corte infantil"
              value={name}
            />
          </label>
          <label className="span">
            <span>Descrição</span>
            <input
              id="service-description"
              onChange={(e) => setDescription(e.target.value)}
              placeholder="O que está incluído"
              value={description}
            />
          </label>
          <label>
            <span>Categoria</span>
            <select
              id="service-category"
              onChange={(e) => setCategory(e.target.value as AddedService["category"])}
              value={category}
            >
              <option value="haircut">Cortes e barba</option>
              <option value="color">Coloração e química</option>
            </select>
          </label>
          <label>
            <span>Duração (min)</span>
            <input
              id="service-minutes"
              inputMode="numeric"
              onChange={(e) => setMinutes(e.target.value.replace(/\D/g, ""))}
              value={minutes}
            />
          </label>
          <label>
            <span>Preço (R$)</span>
            <input
              id="service-price"
              inputMode="decimal"
              onChange={(e) => setPrice(e.target.value.replace(/[^\d,]/g, ""))}
              placeholder="0,00"
              value={price}
            />
          </label>
        </div>
        <fieldset className="dialog-pros">
          <legend>Quem faz</legend>
          {PROS.map((p) => (
            <label key={p.name}>
              <input checked={pros.includes(p.name)} onChange={() => toggle(p.name)} type="checkbox" />
              {p.name}
            </label>
          ))}
        </fieldset>
        <footer>
          <button className="ghost" onClick={onCancel} type="button">
            Cancelar
          </button>
          <button className="primary" disabled={!valid} type="submit">
            Criar serviço
          </button>
        </footer>
      </form>
    </div>
  );
}
