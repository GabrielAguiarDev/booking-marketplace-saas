"use client";

import { useEffect, useRef, useState } from "react";

import {
  CUSTOMERS,
  findService,
  freeSlots,
  hourLabel,
  initials,
  occupancy,
  pro,
  SERVICE_CATEGORIES,
  serviceCategory,
  WEEK_DAYS,
  weekDay,
  type Created,
  type Customer,
} from "./data";
import { AMBER, CORAL, FAINT, FAINT_SOFT, GREEN, INK, RED } from "./tokens";
import type { NewAppointmentSeed } from "./agenda";

type Simulation = "ok" | "conflict" | "error";

function Dot({ done, n }: { done: boolean; n: string }) {
  return (
    <i
      className="step-dot"
      style={{
        background: done ? GREEN : "#fff",
        borderColor: done ? GREEN : CORAL,
        color: done ? "#fff" : CORAL,
      }}
    >
      {done ? "✓" : n}
    </i>
  );
}

export function NewAppointment({
  seed,
  created,
  onClose,
  onCreate,
  onGoServices,
}: {
  seed: NewAppointmentSeed;
  created: Created[];
  onClose: () => void;
  onCreate: (appointment: Created) => void;
  onGoServices: () => void;
}) {
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [customerQuery, setCustomerQuery] = useState("");
  const [registering, setRegistering] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [serviceName, setServiceName] = useState<string | null>(null);
  const [serviceQuery, setServiceQuery] = useState("");
  const [proSel, setProSel] = useState<number | null>(seed.pro);
  const [day, setDay] = useState(seed.day);
  const [hour, setHour] = useState<number | null>(seed.hour);
  const [payment, setPayment] = useState("balcao");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [conflict, setConflict] = useState<number | null>(null);
  const [discarding, setDiscarding] = useState(false);
  const [simulation, setSimulation] = useState<Simulation>("ok");

  const calcTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const service = findService(serviceName);
  const hasData = !!(customer || serviceName || hour !== null || notes || customerQuery || newName);

  const tryClose = () => {
    if (hasData) setDiscarding(true);
    else onClose();
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") tryClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  useEffect(
    () => () => {
      if (calcTimer.current) clearTimeout(calcTimer.current);
      if (saveTimer.current) clearTimeout(saveTimer.current);
    },
    [],
  );

  /** Toda troca que muda a disponibilidade recalcula os horários com um respiro. */
  const recalculate = (apply: () => void) => {
    if (calcTimer.current) clearTimeout(calcTimer.current);
    setConflict(null);
    setLoading(true);
    apply();
    calcTimer.current = setTimeout(() => setLoading(false), 700);
  };

  const proIndex = proSel === -1 ? 0 : (proSel ?? 0);
  const hasPro = !!service && proSel !== null;
  const duration = service ? service.dur : 1;
  const slots = hasPro ? freeSlots(day, proIndex, duration, created) : [];
  const listed =
    conflict !== null && !slots.includes(conflict)
      ? slots.concat([conflict]).sort((a, b) => a - b)
      : slots;

  const missing: string[] = [];
  if (!customer) missing.push("cliente");
  if (!service) missing.push("serviço");
  if (proSel === null) missing.push("profissional");
  if (hour === null) missing.push("horário");
  const complete = missing.length === 0;

  const create = () => {
    if (!complete || saving || !service || !customer || hour === null) return;
    setSaving(true);
    setError("");
    setConflict(null);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      if (simulation === "conflict") {
        setSaving(false);
        setConflict(hour);
        setHour(null);
        return;
      }
      if (simulation === "error") {
        setSaving(false);
        setError(
          "A conexão caiu no meio do envio. Nada foi salvo e seu preenchimento continua aqui.",
        );
        return;
      }
      onCreate({
        day,
        pro: proIndex,
        start: hour,
        dur: service.dur,
        customer: customer.name,
        service: service.name,
      });
    }, 1100);
  };

  const query = customerQuery.trim().toLowerCase();
  const found =
    query.length >= 2
      ? CUSTOMERS.filter((c) => c.name.toLowerCase().includes(query) || c.phone.includes(query))
      : [];
  const noMatch = !customer && !registering && query.length >= 2 && found.length === 0;
  const canSaveCustomer = newName.trim().length > 2 && newPhone.trim().length >= 8;

  const serviceFilter = serviceQuery.trim().toLowerCase();
  const categories = SERVICE_CATEGORIES.map((c) => ({
    name: c.name,
    items: c.items.filter((i) => !serviceFilter || i.name.toLowerCase().includes(serviceFilter)),
  })).filter((c) => c.items.length);

  const enabled = service ? service.pros : [];
  const proOptions = enabled.length
    ? [
        {
          i: -1,
          name: "Qualquer disponível",
          initial: "★",
          note: "quem tiver o horário livre primeiro",
        },
        ...enabled.map((pi) => ({
          i: pi,
          name: pro(pi).name,
          initial: pro(pi).initial,
          note: occupancy(pi, day)
            ? `${occupancy(pi, day)}% da agenda ocupada`
            : pi === 2
              ? "de férias nesta data"
              : "de folga nesta data",
        })),
      ]
    : [];

  const needsDeposit = !!service && service.price > 100;
  const deposit = needsDeposit && service ? Math.round(service.price * 0.3) : 0;
  const paymentOptions: [string, string, string][] = needsDeposit
    ? [
        ["cobrar", "Cobrar sinal agora", "Link de pagamento enviado no app; expira em 2 horas."],
        [
          "pendente",
          "Registrar sinal como pendente",
          "Fica marcado como não pago e o cliente é lembrado.",
        ],
      ]
    : [
        ["app", "Pagar pelo app", "A Vez recebe e repassa em até 2 dias úteis, taxa de 4%."],
        ["balcao", "Pagar no balcão", "Você recebe direto, sem taxa."],
      ];

  const dayIsFull = hasPro && !loading && listed.length === 0;
  const suggestions = dayIsFull
    ? WEEK_DAYS.map((d, di) => ({ di, d }))
        .filter((x) => x.di !== day && freeSlots(x.di, proIndex, duration, created).length)
        .slice(0, 3)
    : [];

  const summary =
    complete && customer && service && hour !== null
      ? `${customer.name} · ${service.name} · ${
          proSel === -1 ? "qualquer disponível" : pro(proIndex).name
        } · ${weekDay(day).dow} ${weekDay(day).day}, ${hourLabel(hour)} — ${hourLabel(
          hour + service.dur,
        )}`
      : "Preencha as seções acima para montar o agendamento.";

  return (
    <div className="drawer-overlay">
      <button aria-label="Fechar painel" className="scrim" onClick={tryClose} type="button" />
      <aside
        className="drawer"
        style={{ opacity: saving ? 0.72 : 1, pointerEvents: saving ? "none" : "auto" }}
      >
        <header className="drawer-head">
          <div>
            <code>NOVO AGENDAMENTO</code>
            <strong>{seed.origin}</strong>
          </div>
          <button aria-label="Fechar" className="drawer-close" onClick={tryClose} type="button">
            ×
          </button>
        </header>

        {discarding ? (
          <div className="discard">
            <strong>Descartar este agendamento?</strong>
            <p>Você já preencheu alguns campos. Fechar agora apaga tudo.</p>
            <div>
              <button className="dark small" onClick={onClose} type="button">
                Descartar
              </button>
              <button className="ghost small" onClick={() => setDiscarding(false)} type="button">
                Continuar preenchendo
              </button>
            </div>
          </div>
        ) : null}

        <div className="drawer-body">
          <section className="step">
            <header>
              <Dot done={!!customer} n="1" />
              <h3>Cliente</h3>
              {customer ? (
                <button
                  className="link"
                  onClick={() => {
                    setCustomer(null);
                    setCustomerQuery("");
                  }}
                  type="button"
                >
                  Trocar
                </button>
              ) : null}
            </header>

            {customer ? (
              <div className="customer-card">
                <div className="customer-head">
                  <i>{initials(customer.name)}</i>
                  <div>
                    <strong>{customer.name}</strong>
                    <code>{customer.phone}</code>
                  </div>
                  <div className="customer-stats">
                    <div>
                      <code>{customer.visits}</code>
                      <small>visitas</small>
                    </div>
                    <div>
                      <code
                        style={{
                          color: customer.misses >= 2 ? RED : customer.misses === 1 ? AMBER : INK,
                        }}
                      >
                        {customer.misses}
                      </code>
                      <small>faltas</small>
                    </div>
                  </div>
                </div>
                {customer.history.length ? (
                  <div className="customer-history">
                    <p>Histórico recente</p>
                    {customer.history.map((h) => (
                      <div key={h.date}>
                        <code>{h.date}</code>
                        <span>{h.service}</span>
                        <code>{h.value}</code>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}

            {!customer && !registering ? (
              <div className="step-body">
                <input
                  className="search"
                  onChange={(event) => setCustomerQuery(event.target.value)}
                  placeholder="Buscar por nome ou telefone"
                  value={customerQuery}
                />

                {found.length ? (
                  <div className="options">
                    {found.map((c) => (
                      <button
                        className="option"
                        key={c.phone}
                        onClick={() => {
                          setCustomer(c);
                          setCustomerQuery("");
                        }}
                        type="button"
                      >
                        <i>{initials(c.name)}</i>
                        <div>
                          <strong>{c.name}</strong>
                          <code>{c.phone}</code>
                        </div>
                        <code className="option-meta">
                          {c.visits} visitas · {c.misses} {c.misses === 1 ? "falta" : "faltas"}
                        </code>
                      </button>
                    ))}
                  </div>
                ) : null}

                {noMatch ? (
                  <div className="empty-box">
                    <strong>Nenhum cliente com “{customerQuery}”</strong>
                    <p>Pode cadastrar agora mesmo, sem sair daqui.</p>
                    <button
                      className="primary small"
                      onClick={() => {
                        setRegistering(true);
                        setNewName(customerQuery);
                      }}
                      type="button"
                    >
                      Cadastrar “{customerQuery}”
                    </button>
                  </div>
                ) : (
                  <button
                    className="link add"
                    onClick={() => {
                      setRegistering(true);
                      setNewName(query.length >= 2 ? customerQuery : "");
                    }}
                    type="button"
                  >
                    <span>+</span> Cadastrar novo cliente
                  </button>
                )}
              </div>
            ) : null}

            {registering ? (
              <div className="register">
                <strong>Cadastrar novo cliente</strong>
                <label>
                  Nome completo
                  <input
                    onChange={(event) => setNewName(event.target.value)}
                    placeholder="Nome e sobrenome"
                    value={newName}
                  />
                </label>
                <label>
                  Telefone com WhatsApp
                  <input
                    className="mono"
                    onChange={(event) => setNewPhone(event.target.value)}
                    placeholder="(11) 90000-0000"
                    value={newPhone}
                  />
                </label>
                <div className="register-actions">
                  <button
                    className="small"
                    disabled={!canSaveCustomer}
                    onClick={() => {
                      if (!canSaveCustomer) return;
                      setCustomer({
                        name: newName.trim(),
                        phone: newPhone.trim(),
                        visits: 0,
                        misses: 0,
                        history: [],
                      });
                      setRegistering(false);
                      setCustomerQuery("");
                    }}
                    style={{ background: canSaveCustomer ? CORAL : "#DCDCDE", color: "#fff" }}
                    type="button"
                  >
                    Salvar cliente
                  </button>
                  <button
                    className="ghost small"
                    onClick={() => {
                      setRegistering(false);
                      setNewName("");
                      setNewPhone("");
                    }}
                    type="button"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            ) : null}
          </section>

          {customer ? (
            <section className="step bordered">
              <header>
                <Dot done={!!service} n="2" />
                <h3>Serviço</h3>
                {service ? (
                  <button
                    className="link"
                    onClick={() =>
                      recalculate(() => {
                        setServiceName(null);
                        setProSel(null);
                        setHour(null);
                      })
                    }
                    type="button"
                  >
                    Trocar
                  </button>
                ) : null}
              </header>

              {service ? (
                <div className="picked-service">
                  <div>
                    <strong>{service.name}</strong>
                    <small>{serviceCategory(service.name)}</small>
                  </div>
                  <div className="picked-price">
                    <code>R$ {service.price}</code>
                    <code className="muted">{service.durLabel}</code>
                  </div>
                </div>
              ) : (
                <div className="step-body">
                  <input
                    className="search"
                    onChange={(event) => setServiceQuery(event.target.value)}
                    placeholder="Buscar serviço"
                    value={serviceQuery}
                  />
                  <div className="options">
                    {categories.map((category) => (
                      <div key={category.name}>
                        <p className="option-group">{category.name}</p>
                        {category.items.map((item) => (
                          <button
                            className="option service"
                            key={item.name}
                            onClick={() =>
                              recalculate(() => {
                                setServiceName(item.name);
                                setServiceQuery("");
                                setProSel(item.pros.length === 1 ? (item.pros[0] ?? null) : null);
                                setHour(null);
                              })
                            }
                            type="button"
                          >
                            <strong>{item.name}</strong>
                            <code className="muted">{item.durLabel}</code>
                            <code className="price">R$ {item.price}</code>
                          </button>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </section>
          ) : null}

          {service ? (
            <section className="step bordered">
              <header>
                <Dot done={proSel !== null} n="3" />
                <h3>Profissional</h3>
                <span className="step-note">
                  {enabled.length ? `${enabled.length} habilitados` : "nenhum habilitado"}
                </span>
              </header>

              {enabled.length === 0 ? (
                <div className="danger-box">
                  <strong>Nenhum profissional habilitado para {service.name}</strong>
                  <p>
                    Esse serviço está ativo, mas não tem ninguém marcado para executá-lo. Sem isso o
                    horário não pode ser vendido.
                  </p>
                  <button className="danger-button" onClick={onGoServices} type="button">
                    Corrigir em Serviços
                  </button>
                </div>
              ) : (
                <div className="radios">
                  {proOptions.map((option) => {
                    const on = proSel === option.i;
                    return (
                      <button
                        className={on ? "radio active" : "radio"}
                        key={option.i}
                        onClick={() =>
                          recalculate(() => {
                            setProSel(option.i);
                            setHour(null);
                          })
                        }
                        type="button"
                      >
                        <i className="avatar">{option.initial}</i>
                        <div>
                          <strong>{option.name}</strong>
                          <small>{option.note}</small>
                        </div>
                        <span className="mark">{on ? <b /> : null}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </section>
          ) : null}

          {service && proSel !== null ? (
            <section className="step bordered">
              <header>
                <Dot done={hour !== null} n="4" />
                <h3>Data e horário</h3>
                <code className="step-note">{service.durLabel} · buffer 10min</code>
              </header>

              <div className="days">
                {WEEK_DAYS.map((d, di) => {
                  const on = day === di;
                  const value = occupancy(proIndex, di);
                  return (
                    <button
                      className={on ? "day active" : "day"}
                      key={d.day}
                      onClick={() =>
                        recalculate(() => {
                          setDay(di);
                          setHour(null);
                        })
                      }
                      type="button"
                    >
                      <small>{d.dow}</small>
                      <code>{d.day}</code>
                      <small>{value ? `${value}%` : "folga"}</small>
                    </button>
                  );
                })}
              </div>

              <header className="slots-head">
                <strong>Horários livres</strong>
                <span>
                  {loading || !listed.length
                    ? ""
                    : `${listed.length} vagas para ${
                        proSel === -1 ? "quem estiver livre" : pro(proIndex).name
                      }`}
                </span>
              </header>

              {loading ? (
                <>
                  <div className="slot-skeletons">
                    {Array.from({ length: 8 }, (_, i) => (
                      <i key={i} />
                    ))}
                  </div>
                  <p className="calculating">
                    <i className="spinner" />
                    Calculando o que sobra depois da escala e do que já está agendado…
                  </p>
                </>
              ) : null}

              {!loading && listed.length ? (
                <>
                  <div className="hours">
                    {listed.map((t) => {
                      const clash = conflict === t;
                      const on = hour === t;
                      return (
                        <button
                          className={clash ? "hour clash" : on ? "hour active" : "hour"}
                          key={t}
                          onClick={() => {
                            if (clash) return;
                            setHour(t);
                            setError("");
                          }}
                          title={`${hourLabel(t)} — ${hourLabel(t + duration)}`}
                          type="button"
                        >
                          {hourLabel(t)}
                        </button>
                      );
                    })}
                  </div>
                  {conflict !== null ? (
                    <div className="danger-box">
                      <strong>Esse horário acabou de ser ocupado</strong>
                      <p>
                        Enquanto você preenchia, alguém marcou {hourLabel(conflict)} com{" "}
                        {pro(proIndex).name} pelo app. Escolha outro horário — o resto continua
                        preenchido.
                      </p>
                    </div>
                  ) : null}
                </>
              ) : null}

              {dayIsFull ? (
                <div className="empty-box left">
                  <strong>
                    {occupancy(proIndex, day)
                      ? `Dia sem vaga para ${service.durLabel}`
                      : proIndex === 2
                        ? `${pro(proIndex).name} está de férias neste dia`
                        : `${pro(proIndex).name} não está na escala neste dia`}
                  </strong>
                  <p>
                    {occupancy(proIndex, day)
                      ? `A agenda está ${occupancy(proIndex, day)}% ocupada e os vãos livres são menores que a duração deste serviço, contando o buffer de 10 minutos.`
                      : "Fora da escala não existe vaga, mesmo com o estabelecimento aberto."}
                  </p>
                  {suggestions.length ? (
                    <>
                      <p className="suggestions-label">Próximos dias com vaga</p>
                      <div className="suggestions">
                        {suggestions.map((s) => (
                          <button
                            key={s.d.day}
                            onClick={() =>
                              recalculate(() => {
                                setDay(s.di);
                                setHour(null);
                              })
                            }
                            type="button"
                          >
                            <strong>
                              {s.d.dow} {s.d.day}
                            </strong>
                            <code>{freeSlots(s.di, proIndex, duration, created).length} vagas</code>
                          </button>
                        ))}
                      </div>
                    </>
                  ) : (
                    <p className="warn">
                      Nenhum dia desta semana tem vaga para {service.durLabel}
                      {proSel === -1 ? "" : ` com ${pro(proIndex).name}`}. Tente outro profissional
                      ou avance para a semana seguinte.
                    </p>
                  )}
                </div>
              ) : null}
            </section>
          ) : null}

          {hour !== null && service ? (
            <section className="step bordered">
              <header>
                <i className="step-dot plain">5</i>
                <h3>Pagamento</h3>
                <span className="step-note">
                  {needsDeposit
                    ? "sinal de 30% para serviços acima de R$ 100"
                    : "sem sinal para este valor"}
                </span>
              </header>

              <div className="totals">
                <div>
                  <span>Total do serviço</span>
                  <code>R$ {service.price},00</code>
                </div>
                <div>
                  <span>{needsDeposit ? "Sinal (30%)" : "Sinal"}</span>
                  <code style={{ color: needsDeposit ? GREEN : FAINT }}>
                    {needsDeposit ? `R$ ${deposit},00` : "não exigido"}
                  </code>
                </div>
                <div>
                  <span>Restante no balcão</span>
                  <code>R$ {service.price - deposit},00</code>
                </div>
              </div>

              <div className="radios">
                {paymentOptions.map(([id, label, note]) => {
                  const on = payment === id;
                  return (
                    <button
                      className={on ? "radio active" : "radio"}
                      key={id}
                      onClick={() => setPayment(id)}
                      type="button"
                    >
                      <div>
                        <strong>{label}</strong>
                        <small>{note}</small>
                      </div>
                      <span className="mark">{on ? <b /> : null}</span>
                    </button>
                  );
                })}
              </div>
            </section>
          ) : null}

          {hour !== null ? (
            <section className="step bordered">
              <header>
                <i className="step-dot plain">6</i>
                <h3>Observação interna</h3>
              </header>
              <p className="step-hint">
                Só a equipe vê. O cliente não recebe e não enxerga esta anotação em nenhum lugar do
                app.
              </p>
              <textarea
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Ex.: máquina 2 nas laterais, costuma chegar antes"
                value={notes}
              />
            </section>
          ) : null}
        </div>

        <footer className="drawer-foot">
          {error ? (
            <div className="danger-box row">
              <div>
                <strong>Não foi possível salvar</strong>
                <p>{error}</p>
              </div>
              <button className="danger-button" onClick={create} type="button">
                Tentar de novo
              </button>
            </div>
          ) : null}

          <p className="summary" style={{ color: complete ? INK : FAINT }}>
            {summary}
          </p>

          <div className="drawer-actions">
            <button
              className="create"
              onClick={create}
              style={{
                background: complete && !saving ? CORAL : "#EDEDEF",
                color: complete || saving ? "#fff" : FAINT,
                cursor: complete ? "pointer" : "not-allowed",
              }}
              title={complete ? "Criar agendamento" : `Ainda falta: ${missing.join(", ")}`}
              type="button"
            >
              {saving ? <i className="spinner light" /> : null}
              {saving ? "Salvando…" : complete ? "Criar agendamento" : `Falta ${missing[0]}`}
            </button>
            <button className="ghost" onClick={tryClose} type="button">
              Cancelar
            </button>
          </div>

          {complete ? null : <p className="missing">Ainda falta escolher: {missing.join(", ")}.</p>}

          <div className="simulate">
            <code style={{ color: FAINT_SOFT }}>SIMULAR RESPOSTA DO SERVIDOR</code>
            {(
              [
                ["ok", "SUCESSO"],
                ["conflict", "CONFLITO"],
                ["error", "ERRO"],
              ] as [Simulation, string][]
            ).map(([id, label]) => (
              <button
                key={id}
                onClick={() => {
                  setSimulation(id);
                  setError("");
                  setConflict(null);
                }}
                style={{ color: simulation === id ? CORAL : FAINT_SOFT }}
                type="button"
              >
                {label}
              </button>
            ))}
          </div>
        </footer>
      </aside>
    </div>
  );
}
