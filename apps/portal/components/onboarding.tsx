"use client";

import { useState } from "react";

import { SignOutButton } from "./auth";
import { EstablishmentPicker } from "./establishment-picker";
import {
  CATEGORY_LABEL,
  ROLE_LABEL,
  type ApplicationInput,
  type ApplicationService,
  type EstablishmentCategory,
  type PortalData,
} from "./model";
import { usePortal } from "./store";

const CATEGORIES = Object.entries(CATEGORY_LABEL) as [EstablishmentCategory, string][];

const blankService = (): ApplicationService => ({
  name: "",
  duration_minutes: 30,
  price_cents: 0,
});

function initialApplication(
  existing?: PortalData["establishment"],
  contactEmail = "",
  responsibleName = "",
): ApplicationInput {
  return existing
    ? {
        name: existing.name,
        category: existing.category,
        cnpj: existing.cnpj,
        legal_name: existing.legal_name,
        responsible_name: existing.responsible_name,
        contact_email: existing.contact_email,
        phone: existing.phone,
        address_line: existing.address_line,
        neighborhood: existing.neighborhood,
        services: existing.services.length ? existing.services : [blankService()],
      }
    : {
        name: "",
        category: "barbershop",
        cnpj: "",
        legal_name: "",
        responsible_name: responsibleName,
        contact_email: contactEmail,
        phone: "",
        address_line: "",
        neighborhood: "",
        services: [blankService()],
      };
}

export function ApplicationForm({
  existing,
  contactEmail,
  responsibleName,
  correctionMessage,
}: {
  existing?: PortalData["establishment"];
  contactEmail?: string;
  responsibleName?: string;
  correctionMessage?: string | null;
}) {
  const { actions } = usePortal();
  const [application, setApplication] = useState(() =>
    initialApplication(existing, contactEmail, responsibleName),
  );
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  const field = <K extends keyof Omit<ApplicationInput, "services">>(
    key: K,
    value: ApplicationInput[K],
  ) => setApplication((current) => ({ ...current, [key]: value }));
  const service = (index: number, patch: Partial<ApplicationService>) =>
    setApplication((current) => ({
      ...current,
      services: current.services.map((item, itemIndex) =>
        itemIndex === index ? { ...item, ...patch } : item,
      ),
    }));

  return (
    <main className="onboarding-shell">
      <header className="onboarding-header">
        <div><b>V</b><strong>Vez</strong><span>PORTAL</span></div>
        <SignOutButton />
      </header>
      <section className="onboarding-card wide" aria-labelledby="application-title">
        <p className="auth-eyebrow">{existing ? "Correção do cadastro" : "Cadastro da loja"}</p>
        <h1 id="application-title">
          {existing ? "Revise os dados e reenvie" : "Conte sobre o seu estabelecimento"}
        </h1>
        <p className="auth-copy">
          A equipe do Vez confere estes dados antes de publicar a loja. A localidade é resolvida
          automaticamente nesta fase do produto.
        </p>
        {correctionMessage ? (
          <aside className="correction-message">
            <strong>O que precisa ser corrigido</strong>
            <p>{correctionMessage}</p>
          </aside>
        ) : null}

        <form
          className="application-form"
          onSubmit={async (event) => {
            event.preventDefault();
            setPending(true);
            setError("");
            try {
              if (existing) await actions.resubmitApplication(existing.id, application);
              else await actions.createApplication(application);
            } catch (cause) {
              setError(cause instanceof Error ? cause.message : "Não foi possível enviar o cadastro.");
              setPending(false);
            }
          }}
        >
          <div className="form-grid">
            <label><span>Nome da loja</span><input required value={application.name} onChange={(e) => field("name", e.target.value)} /></label>
            <label><span>Categoria</span><select value={application.category} onChange={(e) => field("category", e.target.value as EstablishmentCategory)}>{CATEGORIES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            <label><span>CNPJ</span><input inputMode="text" placeholder="00.000.000/0000-00" required value={application.cnpj} onChange={(e) => field("cnpj", e.target.value)} /></label>
            <label><span>Razão social</span><input required value={application.legal_name} onChange={(e) => field("legal_name", e.target.value)} /></label>
            <label><span>Responsável</span><input required value={application.responsible_name} onChange={(e) => field("responsible_name", e.target.value)} /></label>
            <label><span>E-mail de contato</span><input required type="email" value={application.contact_email} onChange={(e) => field("contact_email", e.target.value)} /></label>
            <label><span>Telefone com DDD</span><input inputMode="tel" required value={application.phone} onChange={(e) => field("phone", e.target.value)} /></label>
            <label className="span-2"><span>Endereço (rua e número)</span><input required value={application.address_line} onChange={(e) => field("address_line", e.target.value)} /></label>
            <label><span>Bairro</span><input required value={application.neighborhood} onChange={(e) => field("neighborhood", e.target.value)} /></label>
          </div>

          <fieldset className="services-fieldset">
            <legend>Serviços pretendidos</legend>
            <p>Inclua ao menos um serviço. Você poderá completar o catálogo depois da aprovação.</p>
            {application.services.map((item, index) => (
              <div className="service-row" key={item.id ?? index}>
                <label><span>Serviço</span><input required value={item.name} onChange={(e) => service(index, { name: e.target.value })} /></label>
                <label><span>Duração (min)</span><input min={5} max={480} required type="number" value={item.duration_minutes} onChange={(e) => service(index, { duration_minutes: Number(e.target.value) })} /></label>
                <label><span>Preço (R$)</span><input min={0} max={100000} step="0.01" required type="number" value={(item.price_cents / 100).toFixed(2)} onChange={(e) => service(index, { price_cents: Math.round(Number(e.target.value) * 100) })} /></label>
                {application.services.length > 1 ? <button className="ghost red" onClick={() => setApplication((current) => ({ ...current, services: current.services.filter((_, itemIndex) => itemIndex !== index) }))} type="button">Remover</button> : null}
              </div>
            ))}
            <button className="ghost" onClick={() => setApplication((current) => ({ ...current, services: [...current.services, blankService()] }))} type="button">+ Adicionar serviço</button>
          </fieldset>

          <p className="form-note">Fotos ficam para a edição do perfil público: o onboarding ainda não envia arquivos.</p>
          {error ? <p className="auth-error" role="alert">{error}</p> : null}
          <button className="primary" disabled={pending} type="submit">
            {pending ? "Enviando…" : existing ? "Reenviar para análise" : "Enviar cadastro para análise"}
          </button>
        </form>
      </section>
    </main>
  );
}

export function ApplicationStatus({ data }: { data: PortalData }) {
  const decision = data.latestDecision;
  const isCorrection =
    data.establishment.status === "pending" &&
    decision?.kind === "correction" &&
    new Date(decision.decidedAt).getTime() >= new Date(data.establishment.submittedAt).getTime();
  const canCorrect = isCorrection && data.establishment.role === "owner";

  if (canCorrect) {
    return (
      <ApplicationForm
        correctionMessage={decision.message}
        existing={data.establishment}
      />
    );
  }

  const title =
    data.establishment.status === "rejected"
      ? "Cadastro recusado"
      : data.establishment.status === "suspended"
        ? "Acesso suspenso"
        : isCorrection
          ? "Correção aguardando o dono"
          : "Cadastro em análise";
  const message =
    decision?.message || data.establishment.statusReason ||
    "A equipe do Vez está conferindo os dados. A loja ainda não aparece para clientes.";

  return (
    <main className="onboarding-shell">
      <header className="onboarding-header">
        <div><b>V</b><strong>Vez</strong><span>PORTAL</span></div>
        <div className="header-actions">
          <EstablishmentPicker establishments={data.establishments} value={data.establishment.id} />
          <SignOutButton />
        </div>
      </header>
      <section className={`status-card ${data.establishment.status === "rejected" ? "danger" : ""}`}>
        <span className="status-mark" aria-hidden="true">{data.establishment.status === "rejected" ? "×" : "✓"}</span>
        <p className="auth-eyebrow">{data.establishment.name} · {ROLE_LABEL[data.establishment.role]}</p>
        <h1>{title}</h1>
        <p>{message}</p>
        {isCorrection && data.establishment.role !== "owner" ? (
          <small>Só uma conta com papel de dono pode corrigir e reenviar este cadastro.</small>
        ) : null}
        {data.establishment.status === "pending" && !isCorrection ? (
          <small>Enviado em {new Intl.DateTimeFormat("pt-BR", { dateStyle: "long", timeStyle: "short" }).format(new Date(data.establishment.submittedAt))}.</small>
        ) : null}
      </section>
    </main>
  );
}
