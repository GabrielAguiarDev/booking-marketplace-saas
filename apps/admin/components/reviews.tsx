"use client";

import { useState } from "react";

import { Check, Stars, Toggle, TriangleAlert } from "./blocks";
import {
  decimal,
  ESTABLISHMENTS,
  MOTIVES_KEEP,
  MOTIVES_REMOVE,
  PANORAMA,
  RECENT_REVIEWS,
  REPORTS,
  REVIEW_TABS,
  signed,
  type ReviewTab,
} from "./data";
import { AMBER, FAINT, GREEN, GREEN_SOFT, MUTED, NEUTRAL_SOFT, RED, RED_DARK, RED_SOFT } from "./tokens";

export function Reviews({
  decided,
  onDecide,
  onOpenEstablishment,
}: {
  decided: string[];
  onDecide: (id: string) => void;
  onOpenEstablishment: (id: string) => void;
}) {
  const [tab, setTab] = useState<ReviewTab>("Denúncias");
  const queue = REPORTS.filter((report) => !decided.includes(report.id));

  return (
    <div className="stack detail">
      <div className="tabs">
        {REVIEW_TABS.map((name) => (
          <button
            className={name === tab ? "tab active" : "tab"}
            key={name}
            onClick={() => setTab(name)}
            type="button"
          >
            {name}
            {name === "Denúncias" && queue.length > 0 ? (
              <b className="badge">{queue.length}</b>
            ) : null}
          </button>
        ))}
      </div>

      {tab === "Denúncias" ? (
        queue.length === 0 ? (
          <EmptyQueue onGoPanorama={() => setTab("Panorama")} />
        ) : (
          <ReportQueue onDecide={onDecide} queue={queue} />
        )
      ) : (
        <Panorama onOpenEstablishment={onOpenEstablishment} />
      )}
    </div>
  );
}

function EmptyQueue({ onGoPanorama }: { onGoPanorama: () => void }) {
  return (
    <div className="empty-queue">
      <span className="empty-mark">
        <Check />
      </span>
      <strong>Nenhuma denúncia na fila</strong>
      <p>
        Todas as denúncias abertas foram decididas. Novas entram aqui assim que um estabelecimento
        sinalizar uma avaliação.
      </p>
      <div className="empty-stats">
        <div>
          <code>5</code>
          <small>Decididas hoje</small>
        </div>
        <span className="divider" />
        <div>
          <code>6 h</code>
          <small>Espera média na fila</small>
        </div>
      </div>
      <button className="primary" onClick={onGoPanorama} type="button">
        Ver panorama das notas
      </button>
    </div>
  );
}

function ReportQueue({
  queue,
  onDecide,
}: {
  queue: typeof REPORTS;
  onDecide: (id: string) => void;
}) {
  const [selected, setSelected] = useState(queue[0]!.id);
  const [motive, setMotive] = useState("");
  const [notify, setNotify] = useState(true);

  const report = queue.find((item) => item.id === selected) ?? queue[0]!;
  // Remover a nota da média: o painel mostra o resultado antes de decidir.
  const newAvg =
    report.estTotal > 1
      ? (report.estAvg * report.estTotal - report.rating) / (report.estTotal - 1)
      : report.estAvg;
  const delta = newAvg - report.estAvg;

  const canKeep = MOTIVES_KEEP.includes(motive);
  const canRemove = MOTIVES_REMOVE.includes(motive);

  const decide = (kind: "keep" | "remove") => {
    if (kind === "keep" ? !canKeep : !canRemove) return;
    // O próximo caso da fila abre sozinho; no fim da fila, volta para o anterior.
    const i = Math.max(
      0,
      queue.findIndex((item) => item.id === report.id),
    );
    const next = queue[i + 1] ?? queue[i - 1];
    onDecide(report.id);
    if (next) setSelected(next.id);
    setMotive("");
    setNotify(true);
  };

  const notifyText = `Sua avaliação sobre ${report.est} foi removida pela equipe do Vez por não atender às regras de publicação. O agendamento segue registrado no seu histórico. Você pode avaliar novamente após um novo atendimento.`;

  return (
    <div className="reports-grid">
      <div className="stack tight">
        <div className="filter-triple">
          <select defaultValue="Motivo">
            <option>Motivo</option>
            <option>Conteúdo ofensivo</option>
            <option>Dado pessoal exposto</option>
            <option>Não é sobre este estabelecimento</option>
            <option>Retaliação injusta</option>
          </select>
          <select defaultValue="Cidade">
            <option>Cidade</option>
            <option>São Paulo</option>
            <option>Campinas</option>
            <option>Curitiba</option>
            <option>Goiânia</option>
            <option>Belo Horizonte</option>
          </select>
          <select defaultValue="Nota">
            <option>Nota</option>
            <option>1</option>
            <option>2</option>
            <option>3</option>
            <option>4</option>
            <option>5</option>
          </select>
        </div>

        <div className="card clip">
          <div className="list-head">
            <span>Fila · mais antigas primeiro</span>
            <code>{queue.length}</code>
          </div>
          {queue.map((item) => (
            <button
              className={item.id === report.id ? "report-row active" : "report-row"}
              key={item.id}
              onClick={() => {
                setSelected(item.id);
                setMotive("");
              }}
              type="button"
            >
              <div className="report-row-top">
                <strong>{item.est}</strong>
                <code style={{ color: item.late ? RED : AMBER }}>{item.wait}</code>
              </div>
              <div className="report-row-mid">
                <small>{item.city}</small>
                <b>{item.reason}</b>
                <code>{decimal(item.rating)}</code>
              </div>
              <p className="report-snippet">{`${item.text.slice(0, 84)}…`}</p>
            </button>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="detail-head">
          <div>
            <p className="field-group-label">Denúncia aberta por {report.est}</p>
            <h2 className="report-title">{report.reason}</h2>
            <p className="detail-sub">
              {report.city} · aguardando há <code>{report.wait}</code>
            </p>
          </div>
          <button className="ghost small" type="button">
            Pedir esclarecimento
          </button>
        </div>

        <div className="report-body">
          <div className="report-main">
            <section>
              <p className="field-group-label">Avaliação na íntegra</p>
              <div className="rating-line">
                <Stars value={report.rating} />
                <code>{decimal(report.rating)}</code>
                <span className="divider" />
                <small>
                  {report.author} · {report.authorDate}
                </small>
              </div>
              <p className="quote">{report.text}</p>
            </section>

            <section>
              <p className="confirmed">
                <Check size={14} width={2} />
                Atendimento confirmado
              </p>
              <div className="fields four">
                <div>
                  <small>Serviço</small>
                  <strong>{report.service}</strong>
                </div>
                <div>
                  <small>Profissional</small>
                  <p>{report.pro}</p>
                </div>
                <div>
                  <small>Data do atendimento</small>
                  <code>{report.apptDate}</code>
                </div>
                <div>
                  <small>Valor</small>
                  <code className="strong">{report.value}</code>
                </div>
              </div>
            </section>

            <section>
              <p className="field-group-label">Contexto do autor</p>
              <div className="author-context">
                <div>
                  <code>{report.authorReviews}</code>
                  <small>Avaliações escritas</small>
                </div>
                <div>
                  <div className="inline-pair">
                    <code>{report.authorAvg}</code>
                    <Stars size="sm" value={Math.round(parseFloat(report.authorAvg.replace(",", ".")))} />
                  </div>
                  <small>Nota média que costuma dar</small>
                </div>
                <div>
                  {report.authorRemoved > 0 ? (
                    <span className="pill amber">
                      <TriangleAlert size={12} />
                      {report.authorRemoved === 1
                        ? "1 avaliação já removida"
                        : `${report.authorRemoved} avaliações já removidas`}
                    </span>
                  ) : null}
                </div>
              </div>
            </section>

            <section className="last">
              <p className="field-group-label">O que o estabelecimento alegou</p>
              <span className="pill amber">{report.reason}</span>
              <p className="justification">{report.justification}</p>
              <div className="report-foot">
                <span>
                  <code>{decimal(report.estAvg)}</code> nota média atual
                </span>
                <span>
                  <code>{report.estTotal}</code> avaliações
                </span>
                <b>
                  {report.estReports === 0
                    ? "nenhuma denúncia anterior"
                    : report.estReports === 1
                      ? "1 denúncia aberta antes"
                      : `${report.estReports} denúncias abertas antes`}
                </b>
                {report.estReports >= 3 ? (
                  <span className="tag-strong amber">Denuncia com frequência</span>
                ) : null}
              </div>
            </section>
          </div>

          <div className="report-aside">
            <div className="aside-block">
              <p className="field-group-label">Impacto da decisão</p>
              <div className="impact">
                <div>
                  <code>{decimal(report.estAvg)}</code>
                  <small>Nota hoje</small>
                </div>
                <svg
                  fill="none"
                  height="18"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="1.8"
                  viewBox="0 0 24 24"
                  width="18"
                >
                  <path d="M5 12h14M13 6l6 6-6 6" />
                </svg>
                <div>
                  <div className="inline-pair">
                    <code className="green">{decimal(newAvg)}</code>
                    <code className="green small">{signed(delta)}</code>
                  </div>
                  <small>Se remover</small>
                </div>
              </div>
              <p className="hint">
                A nota média influencia a posição do estabelecimento na busca do app.
              </p>
            </div>

            <div className="aside-block">
              <p className="field-group-label">
                Motivo da decisão <span className="required">obrigatório</span>
              </p>
              <select onChange={(event) => setMotive(event.target.value)} value={motive}>
                <option value="">Selecione um motivo</option>
                <optgroup label="Manter avaliação">
                  {MOTIVES_KEEP.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="Remover avaliação">
                  {MOTIVES_REMOVE.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </optgroup>
              </select>
              <textarea placeholder="Observação interna (opcional) — fica no registro de auditoria" />

              {canRemove ? (
                <div className="notify-box">
                  <button
                    className="toggle-button"
                    onClick={() => setNotify((value) => !value)}
                    type="button"
                  >
                    <Toggle on={notify} />
                    <span>Notificar o autor da avaliação</span>
                  </button>
                  {notify ? <p className="notify-text">{notifyText}</p> : null}
                </div>
              ) : null}

              <div className="decide-buttons">
                <button
                  className="decide"
                  disabled={!canKeep}
                  onClick={() => decide("keep")}
                  style={{ background: canKeep ? "#14171A" : "#C4C6C9" }}
                  type="button"
                >
                  Manter avaliação
                </button>
                <button
                  className="decide"
                  disabled={!canRemove}
                  onClick={() => decide("remove")}
                  style={{ background: canRemove ? RED : "#F0AFA8" }}
                  type="button"
                >
                  Remover avaliação
                </button>
              </div>
              <p className="hint center">Ao decidir, o próximo caso da fila abre automaticamente.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Panorama({ onOpenEstablishment }: { onOpenEstablishment: (id: string) => void }) {
  const [selected, setSelected] = useState("p1");
  const pano = PANORAMA.find((item) => item.id === selected) ?? PANORAMA[0]!;
  const recent = RECENT_REVIEWS[pano.id] ?? [];
  const isDrop = pano.d <= -0.4;

  const open = () => {
    const match = ESTABLISHMENTS.find((est) => est.name === pano.name);
    if (match) onOpenEstablishment(match.id);
  };

  return (
    <div className="panorama-grid">
      <div className="stack tight">
        <div className="filter-bar">
          <select defaultValue="Todas as cidades">
            <option>Todas as cidades</option>
            <option>São Paulo</option>
            <option>Campinas</option>
            <option>Goiânia</option>
          </select>
          <select defaultValue="Todas as faixas de nota">
            <option>Todas as faixas de nota</option>
            <option>Abaixo de 4,0</option>
            <option>4,0 a 4,5</option>
            <option>Acima de 4,5</option>
          </select>
          <select defaultValue="Variação: maior queda">
            <option>Variação: maior queda</option>
            <option>Variação: maior alta</option>
            <option>Nota mais baixa</option>
          </select>
          <div className="spacer" />
          <span className="hint">Últimos 30 dias</span>
        </div>

        <div className="card clip">
          <table className="rows">
            <thead>
              <tr>
                <th>Estabelecimento</th>
                <th>Cidade</th>
                <th className="right">Nota</th>
                <th className="right">30 dias</th>
                <th className="right">Avaliações</th>
                <th className="right">No mês</th>
                <th className="right">Denúncias</th>
                <th>Sinal</th>
              </tr>
            </thead>
            <tbody>
              {PANORAMA.map((item) => {
                const drop = item.d <= -0.4;
                const thin = item.total < 15;
                const clean = item.total >= 150 && item.rep === 0;
                const flag = drop
                  ? "Queda relevante"
                  : thin
                    ? "Poucas avaliações"
                    : clean
                      ? "Volume alto, sem denúncia"
                      : "";
                return (
                  <tr
                    className={item.id === pano.id ? "picked" : undefined}
                    key={item.id}
                    onClick={() => setSelected(item.id)}
                  >
                    <td className="marker strong">{item.name}</td>
                    <td className="muted">{item.city}</td>
                    <td className="right mono strong">{decimal(item.avg)}</td>
                    <td
                      className="right mono strong"
                      style={{
                        color:
                          item.d <= -0.4 ? RED : item.d < 0 ? AMBER : item.d > 0 ? GREEN : FAINT,
                      }}
                    >
                      {signed(item.d)}
                    </td>
                    <td className="right mono">{item.total}</td>
                    <td className="right mono">{item.month}</td>
                    <td
                      className="right mono strong"
                      style={{ color: item.rep >= 3 ? RED : item.rep > 0 ? AMBER : FAINT }}
                    >
                      {item.rep}
                    </td>
                    <td>
                      {flag ? (
                        <span
                          className="tag-strong"
                          style={{
                            background: drop ? RED_SOFT : thin ? NEUTRAL_SOFT : GREEN_SOFT,
                            color: drop ? RED_DARK : thin ? MUTED : GREEN,
                          }}
                        >
                          {flag}
                        </span>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <aside className="card inspector">
        <div className="inspector-head">
          <h3>{pano.name}</h3>
          <p>{pano.city}</p>
        </div>

        <div className="stat-row three">
          <div>
            <code>{decimal(pano.avg)}</code>
            <small>Nota média</small>
          </div>
          <div>
            <code
              style={{
                color: pano.d <= -0.4 ? RED : pano.d < 0 ? AMBER : pano.d > 0 ? GREEN : FAINT,
              }}
            >
              {signed(pano.d)}
            </code>
            <small>30 dias</small>
          </div>
          <div>
            <code>{pano.month}</code>
            <small>No mês</small>
          </div>
        </div>

        {isDrop ? (
          <div className="inspector-alert">
            <TriangleAlert size={15} />
            <span>
              Queda relevante nos últimos 30 dias. Vale contato do time antes de virar cancelamento.
            </span>
          </div>
        ) : null}

        <div className="inspector-block last">
          <p className="field-group-label">Avaliações recentes</p>
          {recent.length > 0 ? (
            <div className="recent-list">
              {recent.map((review, i) => (
                <div key={`${review.who}-${i}`}>
                  <div className="recent-head">
                    <Stars size="sm" value={review.r} />
                    <code style={{ color: review.r <= 2 ? RED : review.r === 3 ? AMBER : GREEN }}>
                      {decimal(review.r)}
                    </code>
                    <small>
                      {review.who} · {review.when}
                    </small>
                  </div>
                  <p>{review.t}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="hint">Nenhuma avaliação nos últimos 30 dias.</p>
          )}
          <button className="ghost full" onClick={open} type="button">
            Abrir ficha completa
          </button>
        </div>
      </aside>
    </div>
  );
}
