"use client";

import { useState } from "react";

import type { SectionId } from "./data";
import type { Notify } from "./portal";
import type { Block, Cell, Chip, ListItem } from "./section-data";

/** Cada passo do "Primeiros passos" leva à seção que ele pede. */
const STEP_TARGET: Record<string, SectionId> = {
  "Cadastrar serviços": "services",
  "Montar horários": "hours",
  "Adicionar equipe": "team",
  "Publicar o perfil público": "profile",
};

function ChipBar({
  chips,
  note,
  cta,
  onCta,
}: {
  chips: Chip[];
  note: string;
  cta?: string;
  onCta: (cta: string) => void;
}) {
  const [active, setActive] = useState(() => Math.max(0, chips.findIndex((c) => c.active)));
  return (
    <div className="chipbar">
      {chips.map((c, i) => (
        <button
          aria-pressed={i === active}
          className={i === active ? "chip active" : "chip"}
          key={c.label}
          onClick={() => setActive(i)}
          style={{ borderRadius: c.radius }}
          type="button"
        >
          {c.label}
        </button>
      ))}
      <code>{note}</code>
      {cta ? (
        <button className="primary" onClick={() => onCta(cta)} type="button">
          {cta}
        </button>
      ) : null}
    </div>
  );
}

function Switch({ item }: { item: ListItem }) {
  const [on, setOn] = useState(!!item.on);
  return (
    <button
      aria-label={item.label}
      aria-pressed={on}
      className={on ? "switch on" : "switch"}
      onClick={() => setOn((value) => !value)}
      type="button"
    >
      <i />
    </button>
  );
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function Invite({ placeholder, cta, notify }: { placeholder?: string; cta: string; notify: Notify }) {
  const [email, setEmail] = useState("");
  const valid = EMAIL.test(email.trim());
  return (
    <form
      className="team-invite"
      onSubmit={(event) => {
        event.preventDefault();
        if (!valid) return;
        notify({
          title: "Convite enviado",
          sub: `${email.trim()} recebe um link para entrar na equipe.`,
        });
        setEmail("");
      }}
    >
      <input
        aria-label="E-mail do profissional"
        onChange={(event) => setEmail(event.target.value)}
        placeholder={placeholder}
        type="email"
        value={email}
      />
      <button className="primary" disabled={!valid} type="submit">
        {cta}
      </button>
    </form>
  );
}

function TableCell({ c }: { c: Cell }) {
  return (
    <div className="table-cell" style={{ textAlign: c.a }}>
      {c.v ? (
        <div style={{ fontFamily: c.ff, fontSize: c.fs, fontWeight: c.w, color: c.fg }}>{c.v}</div>
      ) : null}
      {c.sub ? (
        <div className="cell-sub" style={{ fontFamily: c.subFf }}>
          {c.sub}
        </div>
      ) : null}
      {c.bar ? (
        <div className="cell-bar">
          <i style={{ width: `${c.bar.pct}%`, background: c.bar.c }} />
        </div>
      ) : null}
    </div>
  );
}

export function BlockView({
  block,
  onColor,
  go,
  notify,
  onCta,
}: {
  block: Block;
  onColor?: (color: string) => void;
  go: (section: SectionId) => void;
  notify: Notify;
  onCta: (cta: string) => void;
}) {
  if (block.kind === "kpis") {
    return (
      <section className="kpis" style={{ "--gc": block.gc } as React.CSSProperties}>
        {block.items.map((k) => (
          <article key={k.label}>
            <span>{k.label}</span>
            <strong>{k.value}</strong>
            <div>
              <b style={{ color: k.deltaFg }}>{k.delta}</b>
              <small>{k.note}</small>
            </div>
          </article>
        ))}
      </section>
    );
  }

  if (block.kind === "chips") {
    return <ChipBar chips={block.chips} cta={block.cta} note={block.note} onCta={onCta} />;
  }

  if (block.kind === "table") {
    return (
      <section className="panel">
        {block.title ? (
          <header className="panel-head">
            <h2>{block.title}</h2>
            {block.sub ? <span>{block.sub}</span> : null}
          </header>
        ) : null}
        <div className="table-scroll">
          <div
            className="table-head block-table"
            style={{ "--gc": block.gc } as React.CSSProperties}
          >
            {block.cols.map((c, i) => (
              <div key={`${c.t}-${i}`} style={{ textAlign: c.a }}>
                {c.t}
              </div>
            ))}
          </div>
          {block.rows.map((row, i) => (
            <div
              className="table-row block-table"
              key={i}
              style={{ "--gc": block.gc } as React.CSSProperties}
            >
              {row.map((c, j) => (
                <TableCell c={c} key={j} />
              ))}
            </div>
          ))}
        </div>
      </section>
    );
  }

  if (block.kind === "list") {
    return (
      <section className="panel">
        <header className="panel-head stacked">
          <h2>{block.title}</h2>
          {block.sub ? <p>{block.sub}</p> : null}
        </header>
        {block.items.map((item) => (
          <div className="list-row" key={item.label}>
            <div>
              <strong>{item.label}</strong>
              <small>{item.desc}</small>
            </div>
            {item.value ? <code style={{ color: item.valueFg }}>{item.value}</code> : null}
            {item.toggle ? <Switch item={item} /> : null}
          </div>
        ))}
      </section>
    );
  }

  if (block.kind === "cards") {
    return (
      <div className="team-cards">
        {block.items.map((m) => (
          <section className={m.dashed ? "team-card dashed" : "team-card"} key={m.name}>
            <header>
              {m.initial ? <i>{m.initial}</i> : null}
              <div>
                <h2>{m.name}</h2>
                <p>{m.role}</p>
              </div>
              {m.access ? (
                <b className="access" style={{ color: m.accessFg }}>
                  {m.access}
                </b>
              ) : null}
            </header>
            {m.stats ? (
              <div className="team-stats">
                {m.stats.map((s) => (
                  <div key={s.k}>
                    <strong style={{ color: s.fg }}>{s.v}</strong>
                    <small>{s.k}</small>
                  </div>
                ))}
              </div>
            ) : null}
            {m.tags ? (
              <div className="team-tags">
                {m.tags.map((t) => (
                  <span key={t}>{t}</span>
                ))}
              </div>
            ) : null}
            {m.cta ? <Invite cta={m.cta} notify={notify} placeholder={m.placeholder} /> : null}
          </section>
        ))}
      </div>
    );
  }

  if (block.kind === "schedule") {
    return (
      <section className="panel">
        <header className="panel-head">
          <h2>{block.title}</h2>
          <div className="legend">
            {block.legend.map((l) => (
              <span key={l.label}>
                <i style={{ background: l.c }} />
                {l.label}
              </span>
            ))}
          </div>
        </header>
        <div className="shift-body">
          <div className="shift-track">
            <div className="shift-days">
              <div className="shift-name" />
              {block.days.map((d) => (
                <div key={d}>{d}</div>
              ))}
            </div>
            {block.rows.map((row) => (
              <div className="shift-row" key={row.name}>
                <div className="shift-name">{row.name}</div>
                {row.days.map((d, i) => (
                  <div className="shift-slot" key={i}>
                    <div style={{ background: d.bg, borderColor: d.bd }}>
                      <span style={{ color: d.fg }}>{d.range}</span>
                      <small style={{ color: d.fg }}>{d.note}</small>
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (block.kind === "profile") {
    return (
      <div className="profile-grid">
        <section className="panel">
          <header className="panel-head stacked">
            <h2>O que o cliente vê no app</h2>
            <p>Tudo aqui aparece na hora na prévia do lado.</p>
          </header>
          <div className="profile-form">
            <div>
              <p className="field-label">Galeria</p>
              <div className="gallery">
                {block.photos.map((f) => (
                  <div key={f}>
                    <span>{f}</span>
                  </div>
                ))}
              </div>
            </div>
            {block.fields.map((f) => (
              <div key={f.label}>
                <p className="field-label">{f.label}</p>
                <div className="field-value">{f.value}</div>
              </div>
            ))}
            <div>
              <p className="field-label">Cor da sua marca no app</p>
              <div className="swatches">
                {block.colors.map((c) => (
                  <button
                    aria-label={`Usar a cor ${c}`}
                    className={c === block.current ? "swatch picked" : "swatch"}
                    key={c}
                    onClick={() => onColor?.(c)}
                    style={{ background: c }}
                    type="button"
                  />
                ))}
                <code>{block.current}</code>
              </div>
            </div>
          </div>
        </section>

        <aside className="preview">
          <code className="preview-label">PRÉVIA · APP DO CLIENTE</code>
          <div className="phone">
            <div className="phone-hero">
              <i style={{ background: block.current }} />
            </div>
            <div className="phone-body">
              <strong>Barbearia Corte Reto</strong>
              <p className="phone-rating">
                <code style={{ color: block.current }}>4,9</code>
                <span>· 212 avaliações · Vila Mariana</span>
              </p>
              <p className="phone-desc">
                Corte clássico e barba feita à navalha. Sem enrolação, no horário.
              </p>
              <div className="phone-slots">
                {block.slots.map((v) => (
                  <code key={v}>{v}</code>
                ))}
              </div>
              <div className="phone-cta" style={{ background: block.current }}>
                Agendar
              </div>
              <div className="phone-alt">Entrar na fila · espera 21min</div>
            </div>
          </div>
        </aside>
      </div>
    );
  }

  if (block.kind === "checklist") {
    return (
      <section className="panel">
        <header className="checklist-head">
          <div>
            <h2>{block.title}</h2>
            <code>{block.progress}</code>
          </div>
          <p>{block.sub}</p>
          <div className="checklist-progress">
            {block.steps.map((s) => (
              <i className={s.done ? "done" : undefined} key={s.title} />
            ))}
          </div>
        </header>
        {block.steps.map((s) => (
          <div className={s.done ? "checklist-step" : "checklist-step todo"} key={s.title}>
            <i>{s.n}</i>
            <div>
              <strong>{s.title}</strong>
              <small>{s.desc}</small>
              {s.empty ? <p className="empty-state">{s.empty}</p> : null}
            </div>
            <button
              className={s.done ? "ghost" : "primary"}
              onClick={() => go(STEP_TARGET[s.title] ?? "profile")}
              type="button"
            >
              {s.cta}
            </button>
          </div>
        ))}
      </section>
    );
  }

  if (block.kind === "chart") {
    return (
      <section className="chart-card">
        <header>
          <h2>{block.title}</h2>
          <code>{block.sub}</code>
        </header>
        <div className="chart-bars">
          {block.bars.map((b, i) => (
            <div key={i} title={b.t}>
              <i style={{ height: b.h, background: b.c }} />
            </div>
          ))}
        </div>
        <footer>
          {block.axis.map((e) => (
            <span key={e}>{e}</span>
          ))}
        </footer>
      </section>
    );
  }

  return (
    <section className="layers-card">
      <h2>{block.title}</h2>
      <p>{block.sub}</p>
      <div className="layers-scroll">
        <div className="layers">
          {block.layers.map((l) => (
            <div className="layer" key={l.label}>
              <div className="layer-label">
                <strong style={{ color: l.labelFg }}>{l.label}</strong>
                <code>{l.note}</code>
              </div>
              <div className="layer-blocks">
                {l.blocks.map((c, i) => (
                  <i key={i} style={{ height: l.h, background: c }} />
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="layers-ruler">
          {block.ruler.map((h) => (
            <span key={h}>{h}</span>
          ))}
        </div>
      </div>
      <footer className="layers-footer">
        <strong>Amanhã, quarta 9</strong>
        <div>
          {block.slots.map((v) => (
            <code key={v}>{v}</code>
          ))}
        </div>
        <small>
          É isso que aparece
          <br />
          no app do cliente.
        </small>
      </footer>
    </section>
  );
}
