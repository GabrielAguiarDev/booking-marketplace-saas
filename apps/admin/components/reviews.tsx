"use client";

import { useMemo, useState } from "react";

import { Check, Stars, Toggle, TriangleAlert } from "./blocks";
import { MOTIVES_KEEP, MOTIVES_REMOVE, REVIEW_TABS, decimal, signed, type ReviewTab } from "./data";
import { FormError, TextDialog, useRun } from "./dialogs";
import { brl, isLate, stamp, waited, type Report } from "./model";
import { useAdmin } from "./store";
import {
  AMBER,
  FAINT,
  GREEN,
  GREEN_SOFT,
  MUTED,
  NEUTRAL_SOFT,
  RED,
  RED_DARK,
  RED_SOFT,
} from "./tokens";

export function Reviews({ onOpenEstablishment }: { onOpenEstablishment: (id: string) => void }) {
  const { data } = useAdmin();
  const [tab, setTab] = useState<ReviewTab>("Denúncias");
  const queue = data.reports.slice().sort((a, b) => a.openedAt.localeCompare(b.openedAt));

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
          <EmptyQueue
            decidedToday={countToday(data.audit)}
            onGoPanorama={() => setTab("Panorama")}
          />
        ) : (
          <ReportQueue queue={queue} />
        )
      ) : (
        <Panorama onOpenEstablishment={onOpenEstablishment} />
      )}
    </div>
  );
}

/** Denúncias decididas hoje, contadas no registro de auditoria. */
function countToday(audit: { action: string; at: string }[]): number {
  const today = new Date().toDateString();
  return audit.filter(
    (a) => /avaliação denunciada/.test(a.action) && new Date(a.at).toDateString() === today,
  ).length;
}

function EmptyQueue({
  decidedToday,
  onGoPanorama,
}: {
  decidedToday: number;
  onGoPanorama: () => void;
}) {
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
          <code>{decidedToday}</code>
          <small>Decididas hoje</small>
        </div>
      </div>
      <button className="primary" onClick={onGoPanorama} type="button">
        Ver panorama das notas
      </button>
    </div>
  );
}

function ReportQueue({ queue }: { queue: Report[] }) {
  const { actions } = useAdmin();
  const [reason, setReason] = useState("");
  const [city, setCity] = useState("");
  const [rating, setRating] = useState("");
  const [selected, setSelected] = useState(queue[0]?.id ?? "");
  const [motive, setMotive] = useState("");
  const [note, setNote] = useState("");
  const [notify, setNotify] = useState(true);
  const [clarifying, setClarifying] = useState(false);

  const reasons = [...new Set(queue.map((r) => r.reason))].sort();
  const cities = [...new Set(queue.map((r) => r.city))].sort();
  const visible = queue.filter(
    (r) =>
      (!reason || r.reason === reason) &&
      (!city || r.city === city) &&
      (!rating || r.rating === Number(rating)),
  );
  const report = visible.find((r) => r.id === selected) ?? visible[0];

  const reset = () => {
    setMotive("");
    setNote("");
    setNotify(true);
  };
  const { pending, error, run, setError } = useRun(reset);

  const canKeep = MOTIVES_KEEP.includes(motive);
  const canRemove = MOTIVES_REMOVE.includes(motive);

  const decide = (kind: "keep" | "remove") => {
    if (!report || (kind === "keep" ? !canKeep : !canRemove)) return;
    // o próximo caso abre sozinho; no fim da fila, volta para o anterior
    const i = Math.max(
      0,
      visible.findIndex((r) => r.id === report.id),
    );
    const next = visible[i + 1] ?? visible[i - 1];
    void run(
      async () => {
        await actions.decideReport(report.id, kind, motive, note, kind === "remove" && notify);
        if (next) setSelected(next.id);
      },
      {
        title: kind === "remove" ? "Avaliação removida" : "Avaliação mantida",
        sub:
          kind === "remove"
            ? `A nota foi recalculada${notify ? "; o autor ficou marcado para aviso" : ""}.`
            : "A decisão de manter a avaliação ficou registrada.",
      },
    );
  };

  const newAvg =
    report && report.establishmentReviews > 1
      ? (report.establishmentAverage * report.establishmentReviews - report.rating) /
        (report.establishmentReviews - 1)
      : (report?.establishmentAverage ?? 0);
  const delta = report ? newAvg - report.establishmentAverage : 0;

  return (
    <div className="reports-grid">
      <div className="stack tight">
        <div className="filter-triple">
          <select
            aria-label="Motivo"
            id="report-reason"
            onChange={(e) => setReason(e.target.value)}
            value={reason}
          >
            <option value="">Motivo</option>
            {reasons.map((r) => (
              <option key={r}>{r}</option>
            ))}
          </select>
          <select
            aria-label="Cidade"
            id="report-city"
            onChange={(e) => setCity(e.target.value)}
            value={city}
          >
            <option value="">Cidade</option>
            {cities.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
          <select
            aria-label="Nota"
            id="report-rating"
            onChange={(e) => setRating(e.target.value)}
            value={rating}
          >
            <option value="">Nota</option>
            {[1, 2, 3, 4, 5].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>

        <div className="card clip">
          <div className="list-head">
            <span>Fila · mais antigas primeiro</span>
            <code>{visible.length}</code>
          </div>
          {visible.length === 0 ? (
            <p className="table-empty">Nenhuma denúncia com esses filtros.</p>
          ) : null}
          {visible.map((item) => (
            <button
              className={item.id === report?.id ? "report-row active" : "report-row"}
              key={item.id}
              onClick={() => {
                setSelected(item.id);
                reset();
                setError(null);
              }}
              type="button"
            >
              <div className="report-row-top">
                <strong>{item.establishment}</strong>
                <code style={{ color: isLate(item.openedAt) ? RED : AMBER }}>
                  {waited(item.openedAt)}
                </code>
              </div>
              <div className="report-row-mid">
                <small>{item.city}</small>
                <b>{item.status === "awaiting_establishment" ? "Aguardando loja" : item.reason}</b>
                <code>{decimal(item.rating)}</code>
              </div>
              <p className="report-snippet">
                {item.text.length > 84 ? `${item.text.slice(0, 84)}…` : item.text}
              </p>
            </button>
          ))}
        </div>
      </div>

      {report ? (
        <div className="card">
          <div className="detail-head">
            <div>
              <p className="field-group-label">Denúncia aberta por {report.establishment}</p>
              <h2 className="report-title">{report.reason}</h2>
              <p className="detail-sub">
                {report.city} · aguardando há <code>{waited(report.openedAt)}</code>
                {report.status === "awaiting_establishment"
                  ? " · esclarecimento pedido à loja"
                  : ""}
              </p>
            </div>
            <button className="ghost small" onClick={() => setClarifying(true)} type="button">
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
                    {report.author} · {stamp(report.reviewedAt)}
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
                    <p>{report.professional}</p>
                  </div>
                  <div>
                    <small>Data do atendimento</small>
                    <code>{stamp(report.appointmentAt)}</code>
                  </div>
                  <div>
                    <small>Valor</small>
                    <code className="strong">{brl(report.valueCents)}</code>
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
                      <code>{decimal(report.authorAverage)}</code>
                      <Stars size="sm" value={Math.round(report.authorAverage)} />
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

                {report.clarificationRequest ? (
                  <div style={{ marginTop: "16px" }}>
                    <p className="field-group-label">Esclarecimento que você pediu</p>
                    <p className="justification">{report.clarificationRequest}</p>
                    <p className="field-group-label" style={{ marginTop: "14px" }}>
                      O que a loja respondeu
                      {report.clarificationAnsweredAt
                        ? ` · ${stamp(report.clarificationAnsweredAt)}`
                        : ""}
                    </p>
                    {report.clarificationAnswer ? (
                      <p className="quote">{report.clarificationAnswer}</p>
                    ) : (
                      <p className="hint" style={{ marginTop: "8px" }}>
                        A loja ainda não respondeu. Enquanto isso, a denúncia fica como
                        &ldquo;aguardando loja&rdquo; — decidir sem a resposta continua possível.
                      </p>
                    )}
                  </div>
                ) : null}
                <div className="report-foot">
                  <span>
                    <code>{decimal(report.establishmentAverage)}</code> nota média atual
                  </span>
                  <span>
                    <code>{report.establishmentReviews}</code> avaliações
                  </span>
                  <b>
                    {report.establishmentReports === 0
                      ? "nenhuma denúncia anterior"
                      : report.establishmentReports === 1
                        ? "1 denúncia aberta antes"
                        : `${report.establishmentReports} denúncias abertas antes`}
                  </b>
                  {report.establishmentReports >= 3 ? (
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
                    <code>{decimal(report.establishmentAverage)}</code>
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
                <label className="field-group-label" htmlFor="report-motive">
                  Motivo da decisão <span className="required">obrigatório</span>
                </label>
                <select
                  id="report-motive"
                  onChange={(event) => setMotive(event.target.value)}
                  value={motive}
                >
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
                <textarea
                  aria-label="Observação interna"
                  id="report-note"
                  onChange={(event) => setNote(event.target.value)}
                  placeholder="Observação interna (opcional) — fica no registro de auditoria"
                  value={note}
                />

                {canRemove ? (
                  <div className="notify-box">
                    <button
                      aria-pressed={notify}
                      className="toggle-button"
                      onClick={() => setNotify((value) => !value)}
                      type="button"
                    >
                      <Toggle on={notify} />
                      <span>Marcar autor para notificação</span>
                    </button>
                    {notify ? (
                      <p className="notify-text">
                        Mensagem prevista quando as notificações forem conectadas: sua avaliação
                        sobre {report.establishment} foi removida pela equipe do Vez por não atender
                        às regras de publicação. O agendamento segue registrado no seu histórico.
                      </p>
                    ) : null}
                  </div>
                ) : null}

                <FormError message={error} />

                <div className="decide-buttons">
                  <button
                    className="decide"
                    disabled={!canKeep || pending}
                    onClick={() => decide("keep")}
                    style={{ background: canKeep ? "#14171A" : "#C4C6C9" }}
                    type="button"
                  >
                    Manter avaliação
                  </button>
                  <button
                    className="decide"
                    disabled={!canRemove || pending}
                    onClick={() => decide("remove")}
                    style={{ background: canRemove ? RED : "#F0AFA8" }}
                    type="button"
                  >
                    Remover avaliação
                  </button>
                </div>
                <p className="hint center">
                  Ao decidir, o próximo caso da fila abre automaticamente.
                </p>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="card pad hint">Nenhuma denúncia com esses filtros.</div>
      )}

      {clarifying && report ? (
        <TextDialog
          confirmLabel="Enviar pedido"
          description="A denúncia fica como aguardando loja e a pergunta aparece no app do estabelecimento. A resposta volta para esta tela."
          id="clarify"
          label="O que você precisa saber"
          onClose={() => setClarifying(false)}
          onConfirm={(message) => actions.requestClarification(report.id, message)}
          placeholder="Ex.: envie o registro do horário de chegada do cliente no dia 27"
          success={{
            title: "Esclarecimento pedido",
            sub: `A pergunta chegou ao app de ${report.establishment}.`,
          }}
          title={`Pedir esclarecimento a ${report.establishment}`}
        />
      ) : null}
    </div>
  );
}

type Band = "" | "low" | "mid" | "high";
type Sort = "drop" | "rise" | "lowest";

function Panorama({ onOpenEstablishment }: { onOpenEstablishment: (id: string) => void }) {
  const { data } = useAdmin();
  const [city, setCity] = useState("");
  const [band, setBand] = useState<Band>("");
  const [sort, setSort] = useState<Sort>("drop");
  const [selected, setSelected] = useState(data.panorama[0]?.id ?? "");

  const cities = [...new Set(data.panorama.map((p) => p.city))].sort();
  const rows = useMemo(
    () =>
      data.panorama
        .filter((p) => !city || p.city === city)
        .filter((p) =>
          band === "low"
            ? p.average < 4
            : band === "mid"
              ? p.average >= 4 && p.average <= 4.5
              : band === "high"
                ? p.average > 4.5
                : true,
        )
        .sort((a, b) =>
          sort === "drop"
            ? a.delta30 - b.delta30
            : sort === "rise"
              ? b.delta30 - a.delta30
              : a.average - b.average,
        ),
    [data.panorama, city, band, sort],
  );
  const pano = rows.find((p) => p.id === selected) ?? rows[0];
  const recent = pano ? (data.recentReviews[pano.id] ?? []) : [];
  const tone = (d: number) => (d <= -0.4 ? RED : d < 0 ? AMBER : d > 0 ? GREEN : FAINT);

  return (
    <div className="panorama-grid">
      <div className="stack tight">
        <div className="filter-bar">
          <select
            aria-label="Cidade"
            id="pano-city"
            onChange={(e) => setCity(e.target.value)}
            value={city}
          >
            <option value="">Todas as cidades</option>
            {cities.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
          <select
            aria-label="Faixa de nota"
            id="pano-band"
            onChange={(e) => setBand(e.target.value as Band)}
            value={band}
          >
            <option value="">Todas as faixas de nota</option>
            <option value="low">Abaixo de 4,0</option>
            <option value="mid">4,0 a 4,5</option>
            <option value="high">Acima de 4,5</option>
          </select>
          <select
            aria-label="Ordenar"
            id="pano-sort"
            onChange={(e) => setSort(e.target.value as Sort)}
            value={sort}
          >
            <option value="drop">Variação: maior queda</option>
            <option value="rise">Variação: maior alta</option>
            <option value="lowest">Nota mais baixa</option>
          </select>
          <div className="spacer" />
          <span className="hint">Últimos 30 dias</span>
        </div>

        <div className="card clip">
          <div className="table-wrap">
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
                {rows.map((item) => {
                  const drop = item.delta30 <= -0.4;
                  const thin = item.total < 15;
                  const clean = item.total >= 150 && item.reports === 0;
                  const flag = drop
                    ? "Queda relevante"
                    : thin
                      ? "Poucas avaliações"
                      : clean
                        ? "Volume alto, sem denúncia"
                        : "";
                  return (
                    <tr
                      aria-selected={item.id === pano?.id}
                      className={item.id === pano?.id ? "picked" : undefined}
                      key={item.id}
                      onClick={() => setSelected(item.id)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          setSelected(item.id);
                        }
                      }}
                      tabIndex={0}
                    >
                      <td className="marker strong">{item.name}</td>
                      <td className="muted">{item.city}</td>
                      <td className="right mono strong">{decimal(item.average)}</td>
                      <td className="right mono strong" style={{ color: tone(item.delta30) }}>
                        {signed(item.delta30)}
                      </td>
                      <td className="right mono">{item.total}</td>
                      <td className="right mono">{item.month}</td>
                      <td
                        className="right mono strong"
                        style={{
                          color: item.reports >= 3 ? RED : item.reports > 0 ? AMBER : FAINT,
                        }}
                      >
                        {item.reports}
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
          {rows.length === 0 ? (
            <p className="table-empty">Nenhuma loja com esses filtros.</p>
          ) : null}
        </div>
      </div>

      {pano ? (
        <aside className="card inspector">
          <div className="inspector-head">
            <h3>{pano.name}</h3>
            <p>{pano.city}</p>
          </div>

          <div className="stat-row three">
            <div>
              <code>{decimal(pano.average)}</code>
              <small>Nota média</small>
            </div>
            <div>
              <code style={{ color: tone(pano.delta30) }}>{signed(pano.delta30)}</code>
              <small>30 dias</small>
            </div>
            <div>
              <code>{pano.month}</code>
              <small>No mês</small>
            </div>
          </div>

          {pano.delta30 <= -0.4 ? (
            <div className="inspector-alert">
              <TriangleAlert size={15} />
              <span>
                Queda relevante nos últimos 30 dias. Vale contato do time antes de virar
                cancelamento.
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
                      <Stars size="sm" value={review.rating} />
                      <code
                        style={{
                          color: review.rating <= 2 ? RED : review.rating === 3 ? AMBER : GREEN,
                        }}
                      >
                        {decimal(review.rating)}
                      </code>
                      <small>
                        {review.who} · {stamp(review.at).slice(0, 6)}
                      </small>
                    </div>
                    <p>{review.text}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="hint">Nenhuma avaliação nos últimos 30 dias.</p>
            )}
            <button
              className="ghost full"
              disabled={!pano.establishmentId}
              onClick={() => onOpenEstablishment(pano.establishmentId)}
              type="button"
            >
              Abrir ficha completa
            </button>
          </div>
        </aside>
      ) : null}
    </div>
  );
}
