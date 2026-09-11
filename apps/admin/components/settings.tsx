"use client";

import { useState } from "react";

import { Tabs } from "./blocks";
import { SETTINGS_TABS, type SettingsTab } from "./data";
import { FormError, Modal, useRun } from "./dialogs";
import {
  ago,
  paramText,
  ROLE_LABEL,
  ROLE_SCOPE,
  stamp,
  type AuditEntry,
  type Param,
  type PlatformRole,
  type TeamMember,
} from "./model";
import { useAdmin } from "./store";
import { AMBER, AMBER_DARK, AMBER_SOFT, LINE_DARK, MUTED, NEUTRAL_SOFT } from "./tokens";

type Kind = "" | "access" | "approvals" | "billing" | "team";

/** Em que grupo do filtro cada linha da auditoria cai. */
function kindOf(a: AuditEntry): Exclude<Kind, ""> | "other" {
  if (a.accountAccess) return "access";
  if (/^(Aprovou|Recusou|Pediu correção)/.test(a.action)) return "approvals";
  if (/cobrança|desconto|plano|cota/i.test(a.action)) return "billing";
  if (/ equipe$| da equipe /.test(a.action)) return "team";
  return "other";
}

export function Settings() {
  const { data } = useAdmin();
  const [tab, setTab] = useState<SettingsTab>("Registro de auditoria");
  const [kind, setKind] = useState<Kind>("");
  const [who, setWho] = useState("");

  const audit = data.audit.filter((a) => (!kind || kindOf(a) === kind) && (!who || a.who === who));
  const people = [...new Set(data.audit.map((a) => a.who))].sort();

  return (
    <div className="stack detail">
      <Tabs active={tab} onSelect={setTab} tabs={SETTINGS_TABS} />

      {tab === "Equipe e acessos" ? <TeamTab /> : null}

      {tab === "Parâmetros da plataforma" ? (
        <div className="card params">
          {data.params.map((param) => (
            <ParamRow key={param.key} param={param} />
          ))}
          <MfaParamRow />
        </div>
      ) : null}

      {tab === "Registro de auditoria" ? (
        <div className="stack tight">
          <div className="filter-bar">
            <select
              aria-label="Tipo de ação"
              id="audit-kind"
              onChange={(e) => setKind(e.target.value as Kind)}
              value={kind}
            >
              <option value="">Todas as ações</option>
              <option value="access">Acessos a contas</option>
              <option value="approvals">Aprovações</option>
              <option value="billing">Cobranças e planos</option>
              <option value="team">Equipe</option>
            </select>
            <select
              aria-label="Pessoa"
              id="audit-who"
              onChange={(e) => setWho(e.target.value)}
              value={who}
            >
              <option value="">Toda a equipe</option>
              {people.map((p) => (
                <option key={p}>{p}</option>
              ))}
            </select>
            <span className="hint">Acessos a contas de estabelecimentos aparecem destacados.</span>
          </div>

          <div className="card clip">
            {audit.length === 0 ? (
              <p className="table-empty">Nenhuma ação com esses filtros.</p>
            ) : null}
            {audit.map((entry) => (
              <div
                className="audit-row"
                key={entry.id}
                style={{
                  background: entry.accountAccess ? "#FFFBF2" : "#FFFFFF",
                  borderLeftColor: entry.accountAccess ? AMBER : LINE_DARK,
                }}
              >
                <div>
                  <div className="audit-title">
                    <strong>{entry.action}</strong>
                    <b
                      style={{
                        background: entry.accountAccess ? AMBER_SOFT : NEUTRAL_SOFT,
                        color: entry.accountAccess ? AMBER_DARK : MUTED,
                      }}
                    >
                      {entry.accountAccess ? "Acesso a conta" : "Ação administrativa"}
                    </b>
                  </div>
                  <small>{entry.meta}</small>
                </div>
                <div className="audit-side">
                  <strong>{entry.who}</strong>
                  <code>{stamp(entry.at)}</code>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function MfaParamRow() {
  const { data, actions } = useAdmin();
  const { pending, error, run } = useRun();
  const manages = data.me.roleKey === "admin";

  return (
    <div className="param-row">
      <span>
        Segundo fator no painel
        <small className="param-help">TOTP exigido pelo banco em todas as ações administrativas.</small>
      </span>
      <code>{data.mfaRequired ? "Obrigatório" : "Desligado"}</code>
      {manages ? (
        <button
          className="ghost small"
          disabled={pending}
          onClick={() => {
            const required = !data.mfaRequired;
            void run(() => actions.setMfaRequired(required), {
              title: required ? "Segundo fator ativado" : "Segundo fator desativado",
              sub: required
                ? "Novas sessões administrativas precisarão confirmar o TOTP."
                : "O painel voltou a aceitar login simples.",
            });
          }}
          type="button"
        >
          {pending ? "Salvando…" : data.mfaRequired ? "Desativar" : "Ativar"}
        </button>
      ) : null}
      <FormError message={error} />
    </div>
  );
}

function ParamRow({ param }: { param: Param }) {
  const { actions } = useAdmin();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(String(param.value));
  const { pending, error, run } = useRun(() => setEditing(false));

  if (!editing) {
    return (
      <div className="param-row">
        <span>{param.label}</span>
        <code>{paramText(param)}</code>
        <button
          className="ghost small"
          onClick={() => {
            setValue(String(param.value));
            setEditing(true);
          }}
          type="button"
        >
          Editar
        </button>
      </div>
    );
  }

  return (
    <form
      className="param-row editing"
      onSubmit={(event) => {
        event.preventDefault();
        void run(() => actions.updateParam(param.key, Number(value)), {
          title: "Parâmetro salvo",
          sub: `${param.label}: ${paramText({ ...param, value: Number(value) })}.`,
        });
      }}
    >
      <span>{param.label}</span>
      <label className="param-input">
        <input
          aria-label={param.label}
          autoFocus
          className="mono-input"
          id={`param-${param.key}`}
          inputMode="numeric"
          onChange={(event) => setValue(event.target.value.replace(/[^\d]/g, ""))}
          onKeyDown={(event) => event.key === "Escape" && setEditing(false)}
          value={value}
        />
        <small>{param.unit}</small>
      </label>
      <button className="ghost small" onClick={() => setEditing(false)} type="button">
        Cancelar
      </button>
      <button className="primary small" disabled={pending || value === ""} type="submit">
        {pending ? "Salvando…" : "Salvar"}
      </button>
      <FormError message={error} />
    </form>
  );
}

const ROLES = Object.keys(ROLE_LABEL) as PlatformRole[];

type TeamDialog =
  | { kind: "invite" }
  | { kind: "role"; member: TeamMember }
  | { kind: "remove"; member: TeamMember };

/**
 * Quem é da equipe e com que papel. Só o papel `admin` convida, troca papel e
 * remove — o banco confere de novo; a tela só esconde o que não vai passar.
 */
function TeamTab() {
  const { data } = useAdmin();
  const [dialog, setDialog] = useState<TeamDialog | null>(null);
  const manages = data.me.roleKey === "admin";

  return (
    <div className="card clip">
      <div className="card-head">
        <div>
          <h3>Equipe da plataforma</h3>
          <p>
            {manages
              ? "O convite chega por e-mail; a pessoa define a senha ao aceitar."
              : "Só quem é administrador da plataforma convida, muda papel ou remove pessoas."}
          </p>
        </div>
        {manages ? (
          <div className="head-actions">
            <button
              className="primary small"
              onClick={() => setDialog({ kind: "invite" })}
              type="button"
            >
              Convidar pessoa
            </button>
          </div>
        ) : null}
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Pessoa</th>
              <th>Nível de acesso</th>
              <th>Alcance</th>
              <th className="right">Última atividade</th>
              {manages ? <th aria-label="Ações" className="right" /> : null}
            </tr>
          </thead>
          <tbody>
            {data.team.map((member) => {
              const self = member.id === data.me.id;
              return (
                <tr key={member.id}>
                  <td>
                    <strong className="cell-title">
                      {member.name}
                      {self ? <span className="tag-strong team-tag">você</span> : null}
                      {member.pending ? (
                        <span className="tag-strong amber team-tag">convite pendente</span>
                      ) : null}
                    </strong>
                    <small className="cell-sub">{member.email}</small>
                  </td>
                  <td className="strong">{member.role}</td>
                  <td className="muted">{member.scope}</td>
                  <td className="right mono muted">
                    {self ? "agora" : member.pending ? "ainda não entrou" : ago(member.lastSeen)}
                  </td>
                  {manages ? (
                    <td className="right">
                      {self ? (
                        <span className="hint">peça a outra pessoa administradora</span>
                      ) : (
                        <div className="team-actions">
                          <button
                            className="ghost small"
                            onClick={() => setDialog({ kind: "role", member })}
                            type="button"
                          >
                            Mudar papel
                          </button>
                          <button
                            className="ghost small danger"
                            onClick={() => setDialog({ kind: "remove", member })}
                            type="button"
                          >
                            Remover
                          </button>
                        </div>
                      )}
                    </td>
                  ) : null}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {dialog?.kind === "invite" ? <InviteDialog onClose={() => setDialog(null)} /> : null}
      {dialog?.kind === "role" ? (
        <RoleDialog member={dialog.member} onClose={() => setDialog(null)} />
      ) : null}
      {dialog?.kind === "remove" ? (
        <RemoveDialog member={dialog.member} onClose={() => setDialog(null)} />
      ) : null}
    </div>
  );
}

function RoleSelect({
  id,
  value,
  onChange,
}: {
  id: string;
  value: PlatformRole;
  onChange: (role: PlatformRole) => void;
}) {
  return (
    <label>
      <span>Papel</span>
      <select
        id={id}
        onChange={(event) => onChange(event.target.value as PlatformRole)}
        value={value}
      >
        {ROLES.map((role) => (
          <option key={role} value={role}>
            {ROLE_LABEL[role]}
          </option>
        ))}
      </select>
      <small className="hint team-scope">Alcance: {ROLE_SCOPE[value]}.</small>
    </label>
  );
}

function InviteDialog({ onClose }: { onClose: () => void }) {
  const { actions } = useAdmin();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<PlatformRole>("support");
  const { pending, error, run } = useRun(onClose);
  const ready = name.trim().length >= 2 && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim());

  return (
    <Modal labelledBy="invite-title" onClose={onClose} width={480}>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (!ready) return;
          const clean = email.trim().toLowerCase();
          void run(
            () => actions.inviteTeamMember({ email: clean, name: name.trim(), role }),
            ({ invited }) =>
              invited
                ? {
                    title: "Convite enviado",
                    sub: `${name.trim()} recebe o convite em ${clean} e entra como ${ROLE_LABEL[role]}.`,
                  }
                : {
                    title: "Pessoa incluída na equipe",
                    sub: `${clean} já tinha conta no Vez: entra no painel com a senha que já usa.`,
                  },
          );
        }}
      >
        <div className="modal-head">
          <h3 id="invite-title">Convidar pessoa para a equipe</h3>
          <p>
            A pessoa recebe um e-mail para aceitar o convite e definir a senha. Se o e-mail já tem
            conta no Vez, ela só ganha o papel e entra com a senha que já usa.
          </p>
        </div>
        <div className="modal-body">
          <label>
            <span>
              Nome <b className="required">obrigatório</b>
            </span>
            <input
              autoComplete="off"
              autoFocus
              id="invite-name"
              onChange={(event) => setName(event.target.value)}
              value={name}
            />
          </label>
          <label>
            <span>
              E-mail <b className="required">obrigatório</b>
            </span>
            <input
              autoComplete="off"
              id="invite-email"
              onChange={(event) => setEmail(event.target.value)}
              placeholder="nome@empresa.com"
              type="email"
              value={email}
            />
          </label>
          <RoleSelect id="invite-role" onChange={setRole} value={role} />
          <FormError message={error} />
        </div>
        <div className="modal-foot">
          <button className="ghost" onClick={onClose} type="button">
            Cancelar
          </button>
          <button className="primary" disabled={!ready || pending} type="submit">
            {pending ? "Enviando…" : "Enviar convite"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function RoleDialog({ member, onClose }: { member: TeamMember; onClose: () => void }) {
  const { actions } = useAdmin();
  const [role, setRole] = useState<PlatformRole>(member.roleKey);
  const { pending, error, run } = useRun(onClose);

  return (
    <Modal labelledBy="team-role-title" onClose={onClose} width={440}>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void run(() => actions.setTeamRole(member.id, role), {
            title: "Papel alterado",
            sub: `${member.name} agora é ${ROLE_LABEL[role]}.`,
          });
        }}
      >
        <div className="modal-head">
          <h3 id="team-role-title">Mudar o papel de {member.name}</h3>
          <p>
            Hoje: {member.role}. Vale a partir da próxima ação da pessoa no painel; a mudança fica
            no registro de auditoria.
          </p>
        </div>
        <div className="modal-body">
          <RoleSelect id="team-role" onChange={setRole} value={role} />
          <FormError message={error} />
        </div>
        <div className="modal-foot">
          <button className="ghost" onClick={onClose} type="button">
            Cancelar
          </button>
          <button className="primary" disabled={pending || role === member.roleKey} type="submit">
            {pending ? "Salvando…" : "Mudar papel"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function RemoveDialog({ member, onClose }: { member: TeamMember; onClose: () => void }) {
  const { actions } = useAdmin();
  const { pending, error, run } = useRun(onClose);

  return (
    <Modal labelledBy="team-remove-title" onClose={onClose} width={460}>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void run(() => actions.removeTeamMember(member.id), {
            title: "Pessoa removida da equipe",
            sub: `${member.name} não acessa mais o painel.`,
          });
        }}
      >
        <div className="modal-head">
          <h3 id="team-remove-title">Remover {member.name} da equipe?</h3>
          <p>
            {member.pending
              ? "O convite deixa de dar acesso ao painel: se a pessoa aceitar depois, entra sem papel nenhum."
              : `${member.name} perde o acesso ao painel na próxima ação.`}{" "}
            A conta em {member.email} continua existindo — se a pessoa também usa o Vez como cliente
            ou numa loja, nada muda lá.
          </p>
        </div>
        {error ? (
          <div className="modal-body">
            <FormError message={error} />
          </div>
        ) : null}
        <div className="modal-foot">
          <button className="ghost" onClick={onClose} type="button">
            Cancelar
          </button>
          <button className="danger-solid" disabled={pending} type="submit">
            {pending ? "Removendo…" : "Remover da equipe"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
