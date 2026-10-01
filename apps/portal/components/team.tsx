"use client";

import { useMemo, useState } from "react";

import { dateTimeLabel, Dialog, EmptyBox, ImpactWarning, useSave } from "./cadastro-ui";
import type {
  EstablishmentRole,
  PortalInvitation,
  PortalProfessional,
  ScheduleImpact,
} from "./model";
import { ROLE_LABEL } from "./model";
import { usePortal } from "./store";
import { AMBER, GREEN_DARK, INK, MUTED } from "./tokens";

const ROLE_HELP: Record<EstablishmentRole, string> = {
  owner: "Acesso total, inclusive plano e assinatura.",
  manager: "Muda cadastro, horários e regras. Não vê assinatura.",
  staff: "Vê a operação do dia. Não edita cadastro da loja.",
};

function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .map((part) => part[0] ?? "")
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function InviteDialog({
  invitation,
  onClose,
}: {
  invitation?: PortalInvitation;
  onClose: () => void;
}) {
  const { data, actions } = usePortal();
  const { run, pending } = useSave();
  const [name, setName] = useState(invitation?.name ?? "");
  const [email, setEmail] = useState(invitation?.email ?? "");
  const [role, setRole] = useState<"manager" | "staff">(invitation?.role ?? "staff");
  const [professionalId, setProfessionalId] = useState(invitation?.professionalId ?? "");

  if (!data) return null;
  const available = data.professionals.filter(
    (professional) => !professional.userId || professional.id === invitation?.professionalId,
  );
  const cleanEmail = email.trim().toLowerCase();
  const ready = name.trim().length >= 2 && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(cleanEmail);

  return (
    <Dialog
      onCancel={onClose}
      sub="A pessoa entra no portal e no app da loja. A cadeira é opcional: recepção e gerência podem não atender."
      title={invitation ? "Reenviar convite" : "Convidar pessoa"}
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (!ready || pending) return;
          void run(
            () =>
              actions
                .inviteMember({
                  establishmentId: data.establishment.id,
                  email: cleanEmail,
                  name: name.trim(),
                  role,
                  professionalId: professionalId || null,
                })
                .then(() => undefined),
            invitation ? "Convite reenviado." : "Convite enviado.",
          ).then((ok) => ok && onClose());
        }}
      >
        <div className="dialog-grid">
          <label className="span">
            <span>Nome</span>
            <input autoFocus onChange={(event) => setName(event.target.value)} value={name} />
          </label>
          <label className="span">
            <span>E-mail</span>
            <input
              autoComplete="email"
              disabled={Boolean(invitation)}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="nome@empresa.com"
              type="email"
              value={email}
            />
          </label>
          <label>
            <span>Acesso</span>
            <select
              onChange={(event) => setRole(event.target.value as "manager" | "staff")}
              value={role}
            >
              <option value="staff">Equipe</option>
              <option value="manager">Gerência</option>
            </select>
          </label>
          <label>
            <span>Cadeira (opcional)</span>
            <select
              onChange={(event) => setProfessionalId(event.target.value)}
              value={professionalId}
            >
              <option value="">Sem cadeira</option>
              {available.map((professional) => (
                <option key={professional.id} value={professional.id}>
                  {professional.displayName}
                </option>
              ))}
            </select>
          </label>
        </div>
        <footer>
          <button className="ghost" onClick={onClose} type="button">
            Cancelar
          </button>
          <button className="primary" disabled={!ready || pending} type="submit">
            {pending ? "Enviando…" : invitation ? "Reenviar" : "Enviar convite"}
          </button>
        </footer>
      </form>
    </Dialog>
  );
}

/* ── Cadastro de quem atende ──────────────────────────────────────────────── */

function ProfessionalDialog({
  professional,
  onClose,
}: {
  professional: PortalProfessional | null;
  onClose: () => void;
}) {
  const { data, actions } = usePortal();
  const { run, pending } = useSave();
  const [displayName, setDisplayName] = useState(professional?.displayName ?? "");
  const [title, setTitle] = useState(professional?.title ?? "");
  const [isActive, setIsActive] = useState(professional?.isActive ?? true);
  const [userId, setUserId] = useState(professional?.userId ?? "");
  const [chosen, setChosen] = useState<string[]>(professional?.serviceIds ?? []);

  if (!data) return null;

  // Uma conta só pode estar em uma cadeira: duas cadeiras com o mesmo login
  // fariam o app da loja mostrar duas agendas para a mesma pessoa.
  const taken = new Set(
    data.professionals
      .filter((item) => item.id !== professional?.id && item.userId)
      .map((item) => item.userId as string),
  );
  const available = data.members.filter((member) => !taken.has(member.userId));

  const valid = displayName.trim().length > 1;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!valid || pending) return;
    const ok = await run(
      () =>
        actions.saveProfessional({
          id: professional?.id ?? null,
          establishmentId: data.establishment.id,
          displayName: displayName.trim(),
          title: title.trim() || null,
          isActive,
          userId: userId || null,
          serviceIds: chosen,
        }),
      professional ? "Profissional atualizado." : "Profissional cadastrado.",
    );
    if (ok) onClose();
  };

  const toggle = (id: string) =>
    setChosen((list) => (list.includes(id) ? list.filter((item) => item !== id) : list.concat(id)));

  return (
    <Dialog
      onCancel={onClose}
      sub="Quem atende aparece no app do cliente e tem jornada própria em Horários."
      title={professional ? "Editar profissional" : "Novo profissional"}
    >
      <form onSubmit={submit}>
        <div className="dialog-grid">
          <label className="span">
            <span>Nome que o cliente vê</span>
            <input
              autoFocus
              onChange={(event) => setDisplayName(event.target.value)}
              placeholder="Ex.: Bruno Salvador"
              value={displayName}
            />
          </label>
          <label className="span">
            <span>Função (opcional)</span>
            <input
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Ex.: Barbeiro · sócio"
              value={title}
            />
          </label>
          <label className="span">
            <span>Conta que atende por esta cadeira</span>
            <select onChange={(event) => setUserId(event.target.value)} value={userId}>
              <option value="">Ninguém — cadeira sem login</option>
              {available.map((member) => (
                <option key={member.userId} value={member.userId}>
                  {member.name} ({ROLE_LABEL[member.role]})
                </option>
              ))}
            </select>
          </label>
        </div>

        <fieldset className="dialog-pros">
          <legend>O que esta pessoa faz</legend>
          {data.services.length === 0 ? (
            <p style={{ color: MUTED, fontSize: 12.5 }}>
              Nenhum serviço cadastrado ainda. Cadastre em Serviços e volte aqui.
            </p>
          ) : (
            data.services.map((service) => (
              <label key={service.id}>
                <input
                  checked={chosen.includes(service.id)}
                  onChange={() => toggle(service.id)}
                  type="checkbox"
                />
                {service.name}
                {service.isActive ? "" : " (pausado)"}
              </label>
            ))
          )}
        </fieldset>

        <label className="dialog-check">
          <input
            checked={isActive}
            onChange={(event) => setIsActive(event.target.checked)}
            type="checkbox"
          />
          <span>Atendendo — aparece na agenda e no app do cliente</span>
        </label>

        <footer>
          <button className="ghost" onClick={onClose} type="button">
            Cancelar
          </button>
          <button className="primary" disabled={!valid || pending} type="submit">
            {pending ? "Salvando…" : professional ? "Salvar" : "Cadastrar"}
          </button>
        </footer>
      </form>
    </Dialog>
  );
}

/* ── Pausar quem atende: regra R9 ─────────────────────────────────────────── */

function PauseDialog({
  professional,
  impact,
  onClose,
}: {
  professional: PortalProfessional;
  impact: ScheduleImpact[];
  onClose: () => void;
}) {
  const { actions } = usePortal();
  const { run, pending } = useSave();
  return (
    <Dialog
      onCancel={onClose}
      sub={`${professional.displayName} sai da agenda e do app do cliente. Dá para voltar atrás a qualquer momento.`}
      title="Tirar da agenda"
    >
      <ImpactWarning impact={impact} />
      <footer>
        <button className="ghost" onClick={onClose} type="button">
          Cancelar
        </button>
        <button
          className="primary"
          disabled={pending}
          onClick={async () => {
            const ok = await run(
              () => actions.setProfessionalActive(professional.id, false),
              "Profissional fora da agenda.",
            );
            if (ok) onClose();
          }}
          type="button"
        >
          {pending ? "Salvando…" : "Tirar mesmo assim"}
        </button>
      </footer>
    </Dialog>
  );
}

/* ── Seção ────────────────────────────────────────────────────────────────── */

export function Team() {
  const { data, actions } = usePortal();
  const { run, pending } = useSave();
  const [editing, setEditing] = useState<PortalProfessional | null | undefined>(undefined);
  const [inviting, setInviting] = useState<PortalInvitation | null | undefined>(undefined);
  const [pausing, setPausing] = useState<{
    professional: PortalProfessional;
    impact: ScheduleImpact[];
  } | null>(null);

  const serviceName = useMemo(
    () => new Map((data?.services ?? []).map((service) => [service.id, service.name])),
    [data?.services],
  );

  if (!data) return null;
  const canWrite = data.establishment.role !== "staff";
  const isOwner = data.establishment.role === "owner";
  const owners = data.members.filter((member) => member.role === "owner").length;

  const askPause = async (professional: PortalProfessional) => {
    try {
      const impact = await actions.scheduleImpact({
        establishmentId: data.establishment.id,
        professionalId: professional.id,
        weekday: null,
        windows: [],
      });
      setPausing({ professional, impact });
    } catch {
      setPausing({ professional, impact: [] });
    }
  };

  return (
    <div className="page">
      <div className="chipbar">
        <code>
          {data.professionals.length === 0
            ? "ninguém cadastrado ainda"
            : `${data.professionals.length} ${
                data.professionals.length === 1 ? "profissional" : "profissionais"
              } · ${data.professionals.filter((item) => item.isActive).length} na agenda · ${
                data.members.length
              } ${data.members.length === 1 ? "conta com acesso" : "contas com acesso"}`}
        </code>
        {canWrite ? (
          <button className="primary" onClick={() => setEditing(null)} type="button">
            Novo profissional
          </button>
        ) : null}
      </div>

      {data.professionals.length === 0 ? (
        <section className="panel padded">
          <EmptyBox
            body="Cadeira vazia não gera horário: o app do cliente só oferece o que alguém executa. Comece por quem atende hoje."
            title="Nenhum profissional cadastrado"
          />
        </section>
      ) : (
        <div className="team-cards">
          {data.professionals.map((professional) => {
            const booked = data.commitments.byProfessional[professional.id] ?? 0;
            const hours = data.schedules
              .filter((item) => item.professionalId === professional.id)
              .reduce((sum, item) => {
                const [sh = 0, sm = 0] = item.startsAt.split(":").map(Number);
                const [eh = 0, em = 0] = item.endsAt.split(":").map(Number);
                return sum + (eh * 60 + em - (sh * 60 + sm)) / 60;
              }, 0);
            return (
              <section className="team-card" key={professional.id}>
                <header>
                  <i>{initialsOf(professional.displayName)}</i>
                  <div>
                    <h2>{professional.displayName}</h2>
                    <p>{professional.title ?? "sem função definida"}</p>
                  </div>
                  <b
                    className="access"
                    style={{ color: professional.isActive ? GREEN_DARK : AMBER }}
                  >
                    {professional.isActive ? "Na agenda" : "Fora da agenda"}
                  </b>
                </header>
                <div className="team-stats">
                  <div>
                    <strong style={{ color: INK }}>
                      {hours === 0 ? "—" : `${hours.toFixed(0)}h`}
                    </strong>
                    <small>jornada na semana</small>
                  </div>
                  <div>
                    <strong style={{ color: booked > 0 ? INK : MUTED }}>{booked}</strong>
                    <small>reservas futuras</small>
                  </div>
                  <div>
                    <strong style={{ color: professional.userId ? INK : MUTED }}>
                      {professional.userId ? "sim" : "não"}
                    </strong>
                    <small>usa o app da loja</small>
                  </div>
                </div>
                <div className="team-tags">
                  {professional.serviceIds.length === 0 ? (
                    <span style={{ color: AMBER }}>não faz nenhum serviço ainda</span>
                  ) : (
                    professional.serviceIds.map((id) => (
                      <span key={id}>{serviceName.get(id) ?? "serviço removido"}</span>
                    ))
                  )}
                </div>
                {canWrite ? (
                  <div className="row-actions start" style={{ padding: "0 16px 14px" }}>
                    <button
                      className="ghost small"
                      onClick={() => setEditing(professional)}
                      type="button"
                    >
                      Editar
                    </button>
                    <button
                      className="ghost small"
                      disabled={pending}
                      onClick={() =>
                        professional.isActive
                          ? void askPause(professional)
                          : void run(
                              () => actions.setProfessionalActive(professional.id, true),
                              "Profissional de volta à agenda.",
                            )
                      }
                      type="button"
                    >
                      {professional.isActive ? "Tirar da agenda" : "Voltar à agenda"}
                    </button>
                  </div>
                ) : null}
              </section>
            );
          })}
        </div>
      )}

      <section className="panel">
        <header className="panel-head stacked">
          <div style={{ display: "flex", justifyContent: "space-between", gap: 16 }}>
            <h2>Quem entra no portal e no app da loja</h2>
            {isOwner ? (
              <button className="primary small" onClick={() => setInviting(null)} type="button">
                Convidar pessoa
              </button>
            ) : null}
          </div>
          <p>
            Cadeira e conta são coisas diferentes: existe recepção com login e sem cadeira, e
            barbeiro que aparece no app do cliente e nunca fez login.
          </p>
        </header>
        {data.members.map((member) => (
          <div className="list-row" key={member.userId}>
            <div>
              <strong>
                {member.name}
                {member.isSelf ? " (você)" : ""}
              </strong>
              <small>{ROLE_HELP[member.role]}</small>
            </div>
            {isOwner && !member.isSelf ? (
              <select
                aria-label={`Acesso de ${member.name}`}
                disabled={pending}
                onChange={(event) =>
                  void run(
                    () =>
                      actions.setMemberRole(
                        data.establishment.id,
                        member.userId,
                        event.target.value as EstablishmentRole,
                      ),
                    "Acesso atualizado.",
                  )
                }
                value={member.role}
              >
                <option value="owner">dono</option>
                <option value="manager">gerente</option>
                <option value="staff">equipe</option>
              </select>
            ) : (
              <code>{ROLE_LABEL[member.role]}</code>
            )}
          </div>
        ))}
        {data.invitations
          .filter((invitation) => invitation.status === "pending")
          .map((invitation) => (
            <div className="list-row" key={invitation.id}>
              <div>
                <strong>
                  {invitation.name} <span style={{ color: AMBER }}>· convite pendente</span>
                </strong>
                <small>
                  {invitation.email} · {ROLE_LABEL[invitation.role]} · enviado em{" "}
                  {dateTimeLabel(invitation.invitedAt)}
                </small>
              </div>
              {isOwner ? (
                <div className="row-actions start">
                  <button
                    className="ghost small"
                    onClick={() => setInviting(invitation)}
                    type="button"
                  >
                    Reenviar
                  </button>
                  <button
                    className="ghost small"
                    disabled={pending}
                    onClick={() =>
                      void run(
                        () => actions.revokeInvitation(invitation.id),
                        "Convite revogado; o acesso e a cadeira foram liberados.",
                      )
                    }
                    type="button"
                  >
                    Revogar
                  </button>
                </div>
              ) : (
                <code>pendente</code>
              )}
            </div>
          ))}
        <footer className="card-foot">
          {isOwner && owners === 1
            ? "Você é o único dono desta loja, e ela não pode ficar sem nenhum. Convites podem dar acesso de equipe ou gerência; outro dono é promovido depois que entrar."
            : "Só o dono envia ou revoga convites. Gerência acompanha quem ainda não entrou."}
        </footer>
      </section>

      {editing !== undefined ? (
        <ProfessionalDialog onClose={() => setEditing(undefined)} professional={editing} />
      ) : null}
      {pausing ? (
        <PauseDialog
          impact={pausing.impact}
          onClose={() => setPausing(null)}
          professional={pausing.professional}
        />
      ) : null}
      {inviting !== undefined ? (
        <InviteDialog invitation={inviting ?? undefined} onClose={() => setInviting(undefined)} />
      ) : null}
    </div>
  );
}
