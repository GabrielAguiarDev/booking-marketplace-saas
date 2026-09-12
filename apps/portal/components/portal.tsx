"use client";

import { useState } from "react";

import { SignOutButton } from "./auth";
import { SECTION_META, type SectionId } from "./data";
import { EstablishmentPicker } from "./establishment-picker";
import { Sidebar } from "./sidebar";
import { usePortal } from "./store";

/** Mantido para os componentes visuais legados até P5 substituir suas ações. */
export type Notify = (input: { title: string; sub: string; undo?: () => void }) => void;

const OWNER_ONLY = new Set<SectionId>(["billing"]);
const MANAGEMENT = new Set<SectionId>([
  "services",
  "team",
  "hours",
  "finance",
  "profile",
  "settings",
]);

function canOpen(section: SectionId, role: "owner" | "manager" | "staff") {
  if (OWNER_ONLY.has(section)) return role === "owner";
  if (MANAGEMENT.has(section)) return role === "owner" || role === "manager";
  return true;
}

function EmptySection({ section }: { section: SectionId }) {
  const meta = SECTION_META[section];
  const operation = ["overview", "agenda", "queue", "customers"].includes(section);
  return (
    <section className="empty-section">
      <span aria-hidden="true">○</span>
      <h2>{meta.title}</h2>
      <p>
        Esta seção ainda não está ligada ao banco. Ela não exibe os dados de exemplo do canvas
        para não transformar uma demonstração em informação da sua loja.
      </p>
      <small>{operation ? "A integração entra na P5 (operação)." : "A integração entra na P6 (cadastro e negócio)."}</small>
    </section>
  );
}

function SetupSection({ go }: { go: (section: SectionId) => void }) {
  const { data } = usePortal();
  if (!data) return null;
  const done = data.setup.filter((step) => step.done).length;
  return (
    <div className="setup-page">
      <section className="setup-summary">
        <p className="auth-eyebrow">Primeiros passos</p>
        <h2>
          {done === data.setup.length
            ? `${data.establishment.name} está pronta para receber clientes.`
            : `Vamos deixar ${data.establishment.name} pronta para receber clientes.`}
        </h2>
        <p>{done} de {data.setup.length} concluídos. O progresso é calculado a partir dos dados reais.</p>
        <div className="setup-progress" aria-label={`${done} de ${data.setup.length} concluídos`}>
          {data.setup.map((step) => <i className={step.done ? "done" : ""} key={step.key} />)}
        </div>
      </section>
      <section className="setup-list">
        {data.setup.map((step, index) => (
          <article className={step.done ? "done" : ""} key={step.key}>
            <b>{step.done ? "✓" : index + 1}</b>
            <div><h3>{step.title}</h3><p>{step.body}</p></div>
            {!step.done && canOpen(step.section, data.establishment.role) ? (
              <button className="ghost" onClick={() => go(step.section)} type="button">Abrir seção</button>
            ) : null}
          </article>
        ))}
      </section>
    </div>
  );
}

export function Portal() {
  const { data } = usePortal();
  const [section, setSection] = useState<SectionId>("overview");
  const [collapsed, setCollapsed] = useState(false);
  if (!data) return null;

  const meta = SECTION_META[section];
  const allowed = canOpen(section, data.establishment.role);
  return (
    <div className={collapsed ? "shell collapsed" : "shell"}>
      <Sidebar collapsed={collapsed} data={data} go={setSection} onToggle={() => setCollapsed((value) => !value)} section={section} />
      <main>
        <header className="topbar">
          <div><h1>{meta.title}</h1><code>{meta.sub}</code></div>
          <div className="topbar-end">
            <EstablishmentPicker establishments={data.establishments} value={data.establishment.id} />
            <SignOutButton />
          </div>
        </header>
        {!allowed ? (
          <section className="empty-section"><span>!</span><h2>Acesso restrito</h2><p>Esta área exige papel de {OWNER_ONLY.has(section) ? "dono" : "dono ou gerente"}.</p></section>
        ) : section === "onboarding" ? <SetupSection go={setSection} /> : <EmptySection section={section} />}
      </main>
    </div>
  );
}
