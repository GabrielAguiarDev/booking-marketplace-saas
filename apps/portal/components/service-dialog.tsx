"use client";

import { useState } from "react";

import { Dialog, minutesLabel, money, parseMoney, useSave } from "./cadastro-ui";
import type { PortalProfessional, PortalService } from "./model";
import { usePortal } from "./store";
import { AMBER_DARK, MUTED } from "./tokens";

const DURATIONS = [15, 20, 30, 45, 60, 90, 120];

/**
 * Criar ou editar um serviço.
 *
 * A duração fica em destaque porque é ela que fatia a agenda. Quando o serviço
 * já tem reserva futura vendida, o aviso da regra R9 aparece com o número real
 * — a mesma coisa que o `mobile-staff` diz em `app/servico/[id].tsx`, mas aqui
 * dá para contar quantas.
 */
export function ServiceDialog({
  service,
  professionals,
  onClose,
}: {
  service: PortalService | null;
  professionals: PortalProfessional[];
  onClose: () => void;
}) {
  const { data, actions } = usePortal();
  const { run, pending } = useSave();

  const [name, setName] = useState(service?.name ?? "");
  const [description, setDescription] = useState(service?.description ?? "");
  const [minutes, setMinutes] = useState(String(service?.durationMinutes ?? 30));
  const [price, setPrice] = useState(
    service ? (service.priceCents / 100).toFixed(2).replace(".", ",") : "",
  );
  const [isActive, setIsActive] = useState(service?.isActive ?? true);
  const [chosen, setChosen] = useState<string[]>(service?.professionalIds ?? []);

  if (!data) return null;

  const priceCents = parseMoney(price);
  const minutesValue = Number(minutes);
  const validMinutes = Number.isInteger(minutesValue) && minutesValue >= 5 && minutesValue <= 480;
  const valid = name.trim().length > 1 && priceCents !== null && validMinutes;

  const booked = service ? (data.commitments.byService[service.id] ?? 0) : 0;
  const durationChanged = Boolean(service) && minutesValue !== service?.durationMinutes;

  const toggle = (id: string) =>
    setChosen((list) => (list.includes(id) ? list.filter((item) => item !== id) : list.concat(id)));

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!valid || pending) return;
    const ok = await run(
      () =>
        actions.saveService({
          id: service?.id ?? null,
          establishmentId: data.establishment.id,
          name: name.trim(),
          description: description.trim() || null,
          durationMinutes: minutesValue,
          priceCents: priceCents!,
          isActive,
          professionalIds: chosen,
        }),
      service ? "Serviço atualizado." : "Serviço criado.",
    );
    if (ok) onClose();
  };

  return (
    <Dialog
      onCancel={onClose}
      sub={
        chosen.length === 0
          ? "Sem ninguém que execute, o serviço não gera horário no app do cliente."
          : "Aparece no app do cliente assim que estiver ativo."
      }
      title={service ? "Editar serviço" : "Novo serviço"}
    >
      <form onSubmit={submit}>
        <div className="dialog-grid">
          <label className="span">
            <span>Nome</span>
            <input
              autoFocus
              onChange={(event) => setName(event.target.value)}
              placeholder="Ex.: Corte infantil"
              value={name}
            />
          </label>
          <label className="span">
            <span>Descrição</span>
            <input
              onChange={(event) => setDescription(event.target.value)}
              placeholder="O que está incluído"
              value={description}
            />
          </label>
          <label>
            <span>Duração (min)</span>
            <input
              inputMode="numeric"
              onChange={(event) => setMinutes(event.target.value.replace(/\D/g, ""))}
              value={minutes}
            />
          </label>
          <label>
            <span>Preço (R$)</span>
            <input
              inputMode="decimal"
              onChange={(event) => setPrice(event.target.value.replace(/[^\d,.]/g, ""))}
              placeholder="0,00"
              value={price}
            />
          </label>
        </div>

        <div className="chipbar" style={{ padding: "10px 0 0" }}>
          {DURATIONS.map((value) => (
            <button
              className={minutesValue === value ? "chip active" : "chip"}
              key={value}
              onClick={() => setMinutes(String(value))}
              style={{ borderRadius: "8px" }}
              type="button"
            >
              {minutesLabel(value)}
            </button>
          ))}
        </div>

        <fieldset className="dialog-pros">
          <legend>Quem faz</legend>
          {professionals.length === 0 ? (
            <p style={{ color: MUTED, fontSize: 12.5 }}>
              Nenhum profissional cadastrado. Cadastre em Equipe e volte aqui.
            </p>
          ) : (
            professionals.map((professional) => (
              <label key={professional.id}>
                <input
                  checked={chosen.includes(professional.id)}
                  onChange={() => toggle(professional.id)}
                  type="checkbox"
                />
                {professional.displayName}
                {professional.isActive ? "" : " (pausado)"}
              </label>
            ))
          )}
        </fieldset>

        <label style={{ display: "flex", alignItems: "center", gap: 8, paddingTop: 10 }}>
          <input
            checked={isActive}
            onChange={(event) => setIsActive(event.target.checked)}
            type="checkbox"
          />
          <span style={{ fontSize: 12.5 }}>Ativo — aparece para o cliente</span>
        </label>

        {durationChanged ? (
          <p className="dialog-warn">
            Mudar a duração muda a grade de horários daqui para a frente.{" "}
            {booked === 0
              ? "Nenhuma reserva futura usa este serviço agora."
              : `${booked} ${booked === 1 ? "reserva futura já vendida mantém" : "reservas futuras já vendidas mantêm"} a duração de ${minutesLabel(
                  service!.durationMinutes,
                )} e o preço combinado (${money(service!.priceCents)}); o horário delas não muda.`}
          </p>
        ) : null}
        {!validMinutes && minutes !== "" ? (
          <p className="dialog-warn" style={{ color: AMBER_DARK }}>
            A duração precisa ficar entre 5 e 480 minutos.
          </p>
        ) : null}

        <footer>
          <button className="ghost" onClick={onClose} type="button">
            Cancelar
          </button>
          <button className="primary" disabled={!valid || pending} type="submit">
            {pending ? "Salvando…" : service ? "Salvar" : "Criar serviço"}
          </button>
        </footer>
      </form>
    </Dialog>
  );
}
