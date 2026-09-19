"use client";

import { useMemo, useState } from "react";

import { EmptyBox, minutesLabel, money, useSave } from "./cadastro-ui";
import type { PortalService } from "./model";
import { ServiceDialog } from "./service-dialog";
import { usePortal } from "./store";
import { AMBER, GREEN_DARK, MUTED } from "./tokens";

type Filter = "all" | "active" | "orphan" | "paused";

const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "Todos" },
  { id: "active", label: "No ar" },
  { id: "orphan", label: "Sem profissional" },
  { id: "paused", label: "Pausados" },
];

/**
 * Catálogo da loja.
 *
 * "No ar" não é o mesmo que ativo: um serviço ativo sem ninguém que o execute
 * não gera horário nenhum no app do cliente, e essa é a falha silenciosa mais
 * comum do cadastro. Por isso ela tem coluna e filtro próprios.
 */
export function Services() {
  const { data, actions } = usePortal();
  const { run, pending } = useSave();
  const [filter, setFilter] = useState<Filter>("all");
  const [editing, setEditing] = useState<PortalService | null | undefined>(undefined);

  const services = useMemo(() => data?.services ?? [], [data?.services]);
  const professionals = useMemo(() => data?.professionals ?? [], [data?.professionals]);
  const nameOf = useMemo(
    () => new Map(professionals.map((item) => [item.id, item.displayName])),
    [professionals],
  );

  const live = (service: PortalService) =>
    service.isActive &&
    service.professionalIds.some((id) => professionals.find((p) => p.id === id)?.isActive);

  const shown = services.filter((service) => {
    if (filter === "active") return live(service);
    if (filter === "paused") return !service.isActive;
    if (filter === "orphan") return service.isActive && !live(service);
    return true;
  });

  if (!data) return null;
  const canWrite = data.establishment.role !== "staff";
  const activeCount = services.filter((service) => service.isActive).length;
  const ticket =
    activeCount === 0
      ? 0
      : Math.round(
          services
            .filter((service) => service.isActive)
            .reduce((sum, service) => sum + service.priceCents, 0) / activeCount,
        );

  return (
    <div className="page">
      <div className="chipbar">
        {FILTERS.map((item) => (
          <button
            aria-pressed={filter === item.id}
            className={filter === item.id ? "chip active" : "chip"}
            key={item.id}
            onClick={() => setFilter(item.id)}
            style={{ borderRadius: "8px" }}
            type="button"
          >
            {item.label}
          </button>
        ))}
        <code>
          {services.length === 0
            ? "nenhum serviço cadastrado"
            : `${services.length} ${services.length === 1 ? "serviço" : "serviços"} · ${activeCount} ${
                activeCount === 1 ? "ativo" : "ativos"
              } · preço médio ${money(ticket)}`}
        </code>
        {canWrite ? (
          <button className="primary" onClick={() => setEditing(null)} type="button">
            Novo serviço
          </button>
        ) : null}
      </div>

      <section className="panel">
        <header className="panel-head">
          <h2>Serviços da loja</h2>
          <span>A duração de cada um é o que fatia a agenda.</span>
        </header>

        {services.length === 0 ? (
          <div style={{ padding: 20 }}>
            <EmptyBox
              body="Um nome, um preço, uma duração e quem executa. Sem serviço não existe horário para vender."
              title="Nenhum serviço cadastrado"
            />
          </div>
        ) : shown.length === 0 ? (
          <div style={{ padding: 20 }}>
            <EmptyBox body="Troque o filtro acima." title="Nada neste filtro" />
          </div>
        ) : (
          <div className="table-scroll">
            <div
              className="table-head block-table"
              style={{ "--gc": "2fr .9fr .8fr 1.6fr 1fr 1.2fr" } as React.CSSProperties}
            >
              <div>SERVIÇO</div>
              <div style={{ textAlign: "right" }}>PREÇO</div>
              <div style={{ textAlign: "right" }}>DURAÇÃO</div>
              <div>QUEM EXECUTA</div>
              <div style={{ textAlign: "right" }}>SITUAÇÃO</div>
              <div style={{ textAlign: "right" }}>{canWrite ? "AÇÕES" : ""}</div>
            </div>
            {shown.map((service) => {
              const who = service.professionalIds
                .map((id) => nameOf.get(id))
                .filter(Boolean)
                .join(" · ");
              const booked = data.commitments.byService[service.id] ?? 0;
              return (
                <div
                  className="table-row block-table"
                  key={service.id}
                  style={{ "--gc": "2fr .9fr .8fr 1.6fr 1fr 1.2fr" } as React.CSSProperties}
                >
                  <div className="table-cell">
                    <div style={{ fontWeight: 600 }}>{service.name}</div>
                    <div className="cell-sub">{service.description ?? "sem descrição"}</div>
                  </div>
                  <div className="table-cell" style={{ textAlign: "right" }}>
                    <div>{money(service.priceCents)}</div>
                  </div>
                  <div className="table-cell" style={{ textAlign: "right" }}>
                    <div>{minutesLabel(service.durationMinutes)}</div>
                    {booked > 0 ? (
                      <div className="cell-sub">
                        {booked} {booked === 1 ? "reserva futura" : "reservas futuras"}
                      </div>
                    ) : null}
                  </div>
                  <div className="table-cell">
                    <div style={{ color: who ? undefined : AMBER }}>{who || "ninguém ainda"}</div>
                  </div>
                  <div className="table-cell" style={{ textAlign: "right" }}>
                    <div
                      style={{
                        color: live(service) ? GREEN_DARK : service.isActive ? AMBER : MUTED,
                        fontWeight: 600,
                        fontSize: 12,
                      }}
                    >
                      {live(service) ? "no ar" : service.isActive ? "sem quem execute" : "pausado"}
                    </div>
                  </div>
                  <div className="table-cell" style={{ textAlign: "right" }}>
                    {canWrite ? (
                      <div className="row-actions">
                        <button
                          className="ghost small"
                          onClick={() => setEditing(service)}
                          type="button"
                        >
                          Editar
                        </button>
                        <button
                          className="ghost small"
                          disabled={pending}
                          onClick={() =>
                            void run(
                              () => actions.setServiceActive(service.id, !service.isActive),
                              service.isActive ? "Serviço pausado." : "Serviço no ar.",
                            )
                          }
                          type="button"
                        >
                          {service.isActive ? "Pausar" : "Ativar"}
                        </button>
                      </div>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <footer className="card-foot">
          Serviço sai de circulação pausado, nunca apagado: as reservas já feitas continuam sabendo
          o que foi vendido.
        </footer>
      </section>

      {editing !== undefined ? (
        <ServiceDialog
          onClose={() => setEditing(undefined)}
          professionals={professionals}
          service={editing}
        />
      ) : null}
    </div>
  );
}
