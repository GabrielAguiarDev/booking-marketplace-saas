"use client";

import { useState } from "react";

import { Approvals } from "./approvals";
import { SearchIcon } from "./blocks";
import { Cities } from "./cities";
import { Customers } from "./customers";
import { REPORTS, TITLES, type NavId, type ScreenId } from "./data";
import { EstablishmentDetail, Establishments } from "./establishments";
import { Finance } from "./finance";
import { AccessModal, CityModal, PlanImpactModal } from "./modals";
import { Overview } from "./overview";
import { Quotas } from "./quotas";
import { Reviews } from "./reviews";
import { Services } from "./services";
import { Settings } from "./settings";
import { Sidebar } from "./sidebar";

export type ModalId = "access" | "city" | "impact" | null;

export function Admin() {
  const [screen, setScreen] = useState<ScreenId>("overview");
  const [estabId, setEstabId] = useState("e5");
  const [modal, setModal] = useState<ModalId>(null);
  // A fila de denúncias encolhe conforme o time decide; o distintivo do menu segue ela.
  const [decided, setDecided] = useState<string[]>([]);

  const queue = REPORTS.filter((report) => !decided.includes(report.id));
  const [title, subtitle] = TITLES[screen];

  const go = (id: NavId) => {
    setScreen(id);
    setModal(null);
    window.scrollTo(0, 0);
  };

  const openEstablishment = (id: string) => {
    setEstabId(id);
    setScreen("estabDetail");
    window.scrollTo(0, 0);
  };

  const isStub = screen === "support" || screen === "showcase";

  return (
    <div className="shell">
      <Sidebar go={go} reviewCount={queue.length} screen={screen} />

      <main>
        <header className="topbar">
          <div className="topbar-title">
            <h1>{title}</h1>
            <span>{subtitle}</span>
          </div>
          <div className="spacer" />
          <div className="search">
            <SearchIcon />
            <input placeholder="Buscar estabelecimento, cidade, chamado" />
          </div>
          <div className="clock">
            <i />
            <code>31 ago 2026</code>
          </div>
        </header>

        <div className="page">
          {screen === "overview" ? <Overview go={go} queueCount={queue.length} /> : null}
          {screen === "approvals" ? <Approvals /> : null}
          {screen === "estab" ? <Establishments onOpen={openEstablishment} /> : null}
          {screen === "estabDetail" ? (
            <EstablishmentDetail
              estabId={estabId}
              onAccess={() => setModal("access")}
              onBack={() => setScreen("estab")}
            />
          ) : null}
          {screen === "cities" ? <Cities onNewCity={() => setModal("city")} /> : null}
          {screen === "quotas" ? <Quotas onEditPlan={() => setModal("impact")} /> : null}
          {screen === "finance" ? <Finance /> : null}
          {screen === "services" ? <Services /> : null}
          {screen === "reviews" ? (
            <Reviews
              decided={decided}
              onDecide={(id) => setDecided((list) => list.concat([id]))}
              onOpenEstablishment={openEstablishment}
            />
          ) : null}
          {screen === "customers" ? <Customers /> : null}
          {screen === "settings" ? <Settings /> : null}
          {isStub ? <Stub title={title} /> : null}
        </div>
      </main>

      {modal === "access" ? (
        <AccessModal estabId={estabId} onClose={() => setModal(null)} />
      ) : null}
      {modal === "city" ? <CityModal onClose={() => setModal(null)} /> : null}
      {modal === "impact" ? <PlanImpactModal onClose={() => setModal(null)} /> : null}
    </div>
  );
}

/** Suporte e Vitrine ficaram fora desta rodada do canvas. */
function Stub({ title }: { title: string }) {
  return (
    <div className="stub">
      <svg fill="none" height="34" strokeWidth="1.4" viewBox="0 0 24 24" width="34">
        <rect height="16" rx="2" width="18" x="3" y="4" />
        <path d="M7 9h10M7 13h6" />
      </svg>
      <strong>{title}</strong>
      <p>
        Fora do escopo desta rodada. A tela reusa os mesmos componentes de fila, tabela e painel de
        inspeção já definidos aqui.
      </p>
    </div>
  );
}
