"use client";

import { useState } from "react";

import { StatusChip, Tabs } from "./blocks";
import { downloadCsv, toCsv } from "./csv";
import { FINANCE_TABS, STATUS, type Chip, type FinanceTab } from "./data";
import { FormError, useRun } from "./dialogs";
import { brl, brlWhole, competence, day, type Invoice } from "./model";
import { useAdmin } from "./store";
import { AMBER, GREEN, MUTED, RED } from "./tokens";

const INVOICE_CHIP: Record<Invoice["status"], Chip> = {
  paid: STATUS.paga,
  pending: STATUS.pend,
  overdue: { ...STATUS.vencido, label: "Vencida" },
};

const DAY_MS = 24 * 3600 * 1000;

/** Dias de atraso de uma cobrança vencida. */
const lateDays = (i: Invoice, now = Date.now()) =>
  i.status === "overdue"
    ? Math.max(0, Math.floor((now - new Date(i.dueDate).getTime()) / DAY_MS))
    : 0;

/** As etapas do fluxo de carência, contadas a partir do vencimento. A última vem do parâmetro. */
const BASE_STEPS = [
  { d: 0, label: "Vencimento", meta: "cobrança marcada como vencida", tone: MUTED },
  { d: 3, label: "Primeiro aviso", meta: "e-mail + push no app do estabelecimento", tone: AMBER },
  { d: 7, label: "Segundo aviso", meta: "aviso no painel + contato do time", tone: AMBER },
  { d: 10, label: "Perde o destaque", meta: "perfil sai do destaque na busca", tone: RED },
];

function stepsFor(graceDays: number) {
  return [
    ...BASE_STEPS.filter((step) => step.d < graceDays),
    {
      d: graceDays,
      label: "Suspensão automática",
      meta: "perfil sai do app, agenda preservada",
      tone: RED,
    },
  ];
}

export function Finance({ onOpen }: { onOpen: (id: string) => void }) {
  const { data, actions } = useAdmin();
  const [tab, setTab] = useState<FinanceTab>("Cobranças");
  const resend = useRun();
  const [sending, setSending] = useState<string | null>(null);

  const paid = data.invoices.filter((i) => i.status === "paid");
  const pending = data.invoices.filter((i) => i.status === "pending");
  const overdue = data.invoices.filter((i) => i.status === "overdue");
  const sum = (list: Invoice[]) => list.reduce((total, i) => total + i.amountCents, 0);
  const worst = Math.max(0, ...overdue.map((i) => lateDays(i)));
  const STEPS = stepsFor(data.params.find((p) => p.key === "delinquency_grace_days")?.value ?? 15);
  const revenueRows = data.overview.series.map((point, index, all) => {
    const total = point.monthlyCents + point.commissionCents;
    const previous = index > 0 ? all[index - 1]!.monthlyCents + all[index - 1]!.commissionCents : 0;
    const delta = previous ? ((total - previous) / previous) * 100 : null;
    return { ...point, total, delta };
  });

  // cada loja em atraso conta na etapa mais avançada que já alcançou
  const stepCounts = STEPS.map((step, index) => {
    const next = STEPS[index + 1];
    return overdue.filter((i) => {
      const late = lateDays(i);
      return late >= step.d && (!next || late < next.d);
    }).length;
  });

  const exportCsv = () => {
    const stamp = new Date().toISOString().slice(0, 10);
    if (tab === "Receita") {
      downloadCsv(
        `vez-receita-${stamp}.csv`,
        toCsv(
          ["Competência", "Mensalidade", "Comissão", "Total", "Variação"],
          revenueRows.map((row) => [
            competence(row.month),
            brl(row.monthlyCents),
            brl(row.commissionCents),
            brl(row.total),
            row.delta === null ? "—" : `${row.delta >= 0 ? "+" : ""}${row.delta.toFixed(1)}%`,
          ]),
        ),
      );
    } else if (tab === "Repasses") {
      downloadCsv(
        `vez-repasses-${stamp}.csv`,
        toCsv(
          [
            "Estabelecimento",
            "Cidade",
            "Recebido no app",
            "Comissão retida",
            "A repassar",
            "Situação",
            "Quando",
          ],
          data.transfers.map((t) => [
            t.establishment,
            t.city,
            brl(t.grossCents),
            brl(t.feeCents),
            brl(t.grossCents - t.feeCents),
            t.status === "sent" ? "Enviado" : "Retido",
            day(t.at),
          ]),
        ),
      );
    } else {
      downloadCsv(
        `vez-cobrancas-${stamp}.csv`,
        toCsv(
          [
            "Estabelecimento",
            "Cidade",
            "Competência",
            "Situação",
            "Valor",
            "Vencimento",
            "Dias de atraso",
          ],
          data.invoices.map((i) => [
            i.establishment,
            i.city,
            competence(i.competence),
            INVOICE_CHIP[i.status].label,
            brl(i.amountCents),
            day(i.dueDate),
            String(lateDays(i)),
          ]),
        ),
      );
    }
  };

  return (
    <div className="stack detail">
      <Tabs
        active={tab}
        end={
          <button className="ghost small" onClick={exportCsv} type="button">
            Exportar CSV
          </button>
        }
        onSelect={setTab}
        tabs={FINANCE_TABS}
      />

      {tab === "Receita" ? (
        <div className="card clip">
          <p className="hint finance-estimate">
            Estimativa reconstruída com o plano atual; o histórico contábil virá do provedor de
            cobrança.
          </p>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Competência</th>
                  <th className="right">Mensalidade</th>
                  <th className="right">Comissão</th>
                  <th className="right">Total</th>
                  <th className="right">Variação</th>
                </tr>
              </thead>
              <tbody>
                {revenueRows.map((row) => (
                  <tr key={row.month}>
                    <td className="strong">{competence(row.month)}</td>
                    <td className="right mono">{brl(row.monthlyCents)}</td>
                    <td className="right mono coral">{brl(row.commissionCents)}</td>
                    <td className="right mono strong">{brl(row.total)}</td>
                    <td
                      className={
                        row.delta !== null && row.delta < 0
                          ? "right mono strong danger"
                          : "right mono strong green"
                      }
                    >
                      {row.delta === null
                        ? "—"
                        : `${row.delta >= 0 ? "+" : ""}${row.delta.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {tab === "Cobranças" ? (
        <div className="stack tight">
          <div className="kpi-grid three">
            <div className="card pad">
              <p className="kpi-label">Pagas no mês</p>
              <code className="kpi-number xs">{brlWhole(sum(paid))}</code>
              <small className="kpi-note green">
                {paid.length} {paid.length === 1 ? "cobrança" : "cobranças"}
              </small>
            </div>
            <div className="card pad">
              <p className="kpi-label">Pendentes</p>
              <code className="kpi-number xs">{brlWhole(sum(pending))}</code>
              <small className="kpi-note amber">
                {pending.length} {pending.length === 1 ? "cobrança a vencer" : "cobranças a vencer"}
              </small>
            </div>
            <div className="card pad danger">
              <p className="kpi-label danger">Vencidas</p>
              <code className="kpi-number xs danger">{brlWhole(sum(overdue))}</code>
              <small className="kpi-note danger">
                {overdue.length
                  ? `${overdue.length} cobranças · até ${worst} dias`
                  : "nada em atraso"}
              </small>
            </div>
          </div>

          <FormError message={resend.error} />
          <div className="card clip">
            <div className="table-wrap">
              <table className="rows">
                <thead>
                  <tr>
                    <th>Estabelecimento</th>
                    <th>Cidade</th>
                    <th>Competência</th>
                    <th>Situação</th>
                    <th className="right">Valor</th>
                    <th className="right">Vencimento</th>
                    <th className="right">Atraso</th>
                    <th className="right">Ação</th>
                  </tr>
                </thead>
                <tbody>
                  {data.invoices.map((row) => {
                    const late = lateDays(row);
                    return (
                      <tr key={row.id}>
                        <td>
                          <button
                            className="row-link"
                            disabled={!row.establishmentId}
                            onClick={() => onOpen(row.establishmentId)}
                            type="button"
                          >
                            {row.establishment}
                          </button>
                        </td>
                        <td className="muted">{row.city}</td>
                        <td className="mono">{competence(row.competence)}</td>
                        <td>
                          <StatusChip chip={INVOICE_CHIP[row.status]} />
                        </td>
                        <td className="right mono strong">{brl(row.amountCents)}</td>
                        <td className="right mono muted">{day(row.dueDate)}</td>
                        <td className="right mono strong danger">
                          {row.status === "overdue"
                            ? `${late} ${late === 1 ? "dia" : "dias"}`
                            : "—"}
                        </td>
                        <td className="right">
                          {row.status === "overdue" ? (
                            <button
                              className="ghost small"
                              disabled={resend.pending && sending === row.id}
                              onClick={() => {
                                setSending(row.id);
                                void resend.run(() => actions.resendInvoice(row.id), {
                                  title: "Cobrança reenviada",
                                  sub: `${row.establishment} recebe o boleto e o Pix de novo por e-mail.`,
                                });
                              }}
                              type="button"
                            >
                              {resend.pending && sending === row.id
                                ? "Enviando…"
                                : "Reenviar cobrança"}
                            </button>
                          ) : null}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {data.invoices.length === 0 ? (
              <p className="table-empty">Nenhuma cobrança emitida ainda.</p>
            ) : null}
          </div>
        </div>
      ) : null}

      {tab === "Repasses" ? (
        <div className="stack tight">
          <p className="lede">
            Só aparecem aqui os estabelecimentos que aceitam pagamento pelo app. Agendamentos sem
            pagamento integrado não geram repasse.
          </p>
          <div className="card clip">
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Estabelecimento</th>
                    <th>Cidade</th>
                    <th className="right">Recebido no app</th>
                    <th className="right">Comissão retida</th>
                    <th className="right">A repassar</th>
                    <th>Situação</th>
                    <th className="right">Quando</th>
                  </tr>
                </thead>
                <tbody>
                  {data.transfers.map((row) => (
                    <tr key={row.id}>
                      <td className="strong">{row.establishment}</td>
                      <td className="muted">{row.city}</td>
                      <td className="right mono">{brl(row.grossCents)}</td>
                      <td className="right mono coral">{brl(row.feeCents)}</td>
                      <td className="right mono strong">{brl(row.grossCents - row.feeCents)}</td>
                      <td
                        className="strong"
                        style={{ color: row.status === "sent" ? GREEN : AMBER, fontSize: "12px" }}
                      >
                        {row.status === "sent" ? "Enviado" : "Retido"}
                      </td>
                      <td className="right mono muted">
                        {row.status === "sent" ? day(row.at) : `libera ${day(row.at).slice(0, 6)}`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {data.transfers.length === 0 ? (
              <p className="table-empty">Nenhum repasse ainda.</p>
            ) : null}
          </div>
        </div>
      ) : null}

      {tab === "Inadimplência" ? (
        <div className="card pad wide-pad">
          <h3 className="card-title tight">Fluxo de carência e suspensão automática</h3>
          <p className="lede spaced">
            Contagem a partir do vencimento da cobrança. O número indica quantos estabelecimentos
            estão em cada etapa agora. As automações entram junto com o provedor de cobrança.
          </p>
          <div className="steps">
            {STEPS.map((step, i) => (
              <div className="step" key={step.d} style={{ borderLeftColor: step.tone }}>
                <code style={{ color: step.tone }}>D+{step.d}</code>
                <strong>{step.label}</strong>
                <small>{step.meta}</small>
                <span className="step-count">
                  <code>{stepCounts[i]}</code>
                  <small>estab.</small>
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
