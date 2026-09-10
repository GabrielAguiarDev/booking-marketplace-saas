"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { Agenda, type AgendaView, type NewAppointmentSeed } from "./agenda";
import { BlockView } from "./blocks";
import { HEADINGS, pro, type Created, type SectionId } from "./data";
import { NewAppointment } from "./new-appointment";
import { Overview } from "./overview";
import { Queue } from "./queue";
import { downloadCsv, tablesToCsv } from "./csv";
import { sectionBlocks, type AddedService } from "./section-data";
import { ServiceDialog } from "./service-dialog";
import { Sidebar } from "./sidebar";

export type Toast = { title: string; sub: string; undo?: () => void };
export type Notify = (toast: Toast) => void;

const BLANK_SEED: NewAppointmentSeed = {
  origin: "Começando do zero",
  pro: null,
  day: 1,
  hour: null,
};

export function Portal() {
  const [section, setSection] = useState<SectionId>("overview");
  const [view, setView] = useState<AgendaView>("day");
  const [weekPro, setWeekPro] = useState("Bruno");
  const [brandColor, setBrandColor] = useState("#1F6FEB");
  const [seed, setSeed] = useState<NewAppointmentSeed | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const [created, setCreated] = useState<Created[]>([]);
  const [flash, setFlash] = useState<Created | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);
  const [seconds, setSeconds] = useState(5);
  const [addedServices, setAddedServices] = useState<AddedService[]>([]);
  const [newService, setNewService] = useState(false);
  const ticker = useRef<ReturnType<typeof setInterval> | null>(null);

  const go = (next: SectionId) => {
    setSection(next);
    setNavOpen(false);
    window.scrollTo(0, 0);
  };

  const openNew = useCallback((next: NewAppointmentSeed) => setSeed(next), []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const tag = (event.target as HTMLElement | null)?.tagName ?? "";
      if ((event.key === "n" || event.key === "N") && tag !== "INPUT" && tag !== "TEXTAREA") {
        setSeed((current) => current ?? BLANK_SEED);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(
    () => () => {
      if (ticker.current) clearInterval(ticker.current);
    },
    [],
  );

  /**
   * Aviso de 5 segundos no rodapé. Com `undo`, o aviso vira a chance de voltar
   * atrás — o mesmo padrão para qualquer ação da equipe, não só para criar.
   */
  const notify = useCallback((next: Toast) => {
    setToast(next);
    setSeconds(5);

    if (ticker.current) clearInterval(ticker.current);
    ticker.current = setInterval(() => {
      setSeconds((value) => {
        if (value <= 1) {
          if (ticker.current) clearInterval(ticker.current);
          setToast(null);
          setFlash(null);
          return 0;
        }
        return value - 1;
      });
    }, 1000);
  }, []);

  const create = (appointment: Created) => {
    setSeed(null);
    setCreated((list) => list.concat([appointment]));
    setFlash(appointment);
    setSection("agenda");
    setView(appointment.day === 1 ? "day" : "week");
    setWeekPro(pro(appointment.pro).name);
    window.scrollTo(0, 0);
    notify({
      title: appointment.blocked ? "Período bloqueado" : "Agendamento criado",
      sub: appointment.blocked
        ? `${appointment.customer} · ninguém consegue marcar nesse intervalo.`
        : `${appointment.customer} foi avisado pelo app.`,
      undo: () => {
        setCreated((list) => list.slice(0, -1));
        setFlash(null);
      },
    });
  };

  const undo = () => {
    if (ticker.current) clearInterval(ticker.current);
    toast?.undo?.();
    setToast(null);
    setFlash(null);
  };

  const heading = HEADINGS[section];
  const blocks = sectionBlocks(section, brandColor, addedServices);

  const onCta = (cta: string) => {
    if (cta === "Exportar CSV") {
      downloadCsv(`vez-${section}-2026-09-08.csv`, tablesToCsv(blocks));
      notify({ title: "CSV exportado", sub: `${heading[0]}: as tabelas desta seção.` });
    } else if (cta === "Novo serviço") {
      setNewService(true);
    }
  };

  const shellClass = ["shell", collapsed ? "collapsed" : "", navOpen ? "nav-open" : ""]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={shellClass}>
      <Sidebar
        collapsed={collapsed}
        go={go}
        onToggle={() => setCollapsed((value) => !value)}
        section={section}
      />
      {navOpen ? (
        <button
          aria-label="Fechar menu"
          className="nav-backdrop"
          onClick={() => setNavOpen(false)}
          type="button"
        />
      ) : null}

      <main>
        <header className="topbar">
          <button
            aria-label="Abrir menu"
            className="nav-open-button"
            onClick={() => setNavOpen(true)}
            type="button"
          >
            <svg fill="none" height="18" viewBox="0 0 24 24" width="18">
              <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" strokeWidth="1.8" />
            </svg>
          </button>
          <div>
            <h1>{heading[0]}</h1>
            <code>{heading[1]}</code>
          </div>
          <div className="topbar-end">
            <div className="clock">
              <code>14:32</code>
              <small>Terça, 8 de setembro</small>
            </div>
            <button className="primary" onClick={() => setSeed(BLANK_SEED)} type="button">
              Novo agendamento <kbd>N</kbd>
            </button>
          </div>
        </header>

        {section === "overview" ? <Overview go={go} notify={notify} /> : null}

        {section === "agenda" ? (
          <Agenda
            created={created}
            flash={flash}
            notify={notify}
            onBlock={create}
            openNew={openNew}
            setView={setView}
            setWeekPro={setWeekPro}
            view={view}
            weekPro={weekPro}
          />
        ) : null}

        {section === "queue" ? <Queue notify={notify} /> : null}

        {section !== "overview" && section !== "agenda" && section !== "queue" ? (
          <div className="page blocks">
            {blocks.map((block, i) => (
              <BlockView
                block={block}
                go={go}
                key={i}
                notify={notify}
                onColor={setBrandColor}
                onCta={onCta}
              />
            ))}
          </div>
        ) : null}
      </main>

      {toast ? (
        <div className="toast">
          <svg fill="none" height="17" stroke="#4ADE80" viewBox="0 0 24 24" width="17">
            <path
              d="M20 6.5L9.5 17 4.5 12"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
            />
          </svg>
          <div>
            <strong>{toast.title}</strong>
            <small>{toast.sub}</small>
          </div>
          {toast.undo ? (
            <button onClick={undo} type="button">
              Desfazer
            </button>
          ) : null}
          <code>{seconds}s</code>
        </div>
      ) : null}

      {newService ? (
        <ServiceDialog
          onCancel={() => setNewService(false)}
          onCreate={(service) => {
            setNewService(false);
            setAddedServices((list) => list.concat([service]));
            notify({
              title: "Serviço criado",
              sub: `${service.row[0]} entrou em ${service.category === "haircut" ? "Cortes e barba" : "Coloração e química"}.`,
              undo: () => setAddedServices((list) => list.slice(0, -1)),
            });
          }}
        />
      ) : null}

      {seed ? (
        <NewAppointment
          created={created}
          onClose={() => setSeed(null)}
          onCreate={create}
          onGoServices={() => {
            setSeed(null);
            go("services");
          }}
          seed={seed}
        />
      ) : null}
    </div>
  );
}
