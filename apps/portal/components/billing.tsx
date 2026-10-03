"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";

import { money, useSave } from "./cadastro-ui";
import type { InvoiceCharge, PortalInvoice, PortalPlan } from "./model";
import { usePortal } from "./store";
import { AMBER_DARK, GREEN_DARK, INK, MONO, MUTED, RED } from "./tokens";

/** Nome de vitrine do provedor. Provedor novo sem nome aqui aparece pelo id. */
const PROVIDER_LABEL: Record<string, string> = { mercadopago: "Mercado Pago" };

const longDate = (iso: string) =>
  new Intl.DateTimeFormat("pt-BR", { dateStyle: "long" }).format(new Date(iso));

const monthLabel = (date: string) =>
  new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(
    new Date(`${date}T12:00:00`),
  );

function invoiceState(invoice: PortalInvoice): { label: string; tone: string } {
  if (invoice.status === "paid") return { label: "paga", tone: GREEN_DARK };
  if (invoice.status === "void") return { label: "cancelada", tone: MUTED };
  const overdue = new Date(`${invoice.dueDate}T23:59:59`).getTime() < Date.now();
  return overdue ? { label: "vencida", tone: RED } : { label: "em aberto", tone: AMBER_DARK };
}

const KIND_LABEL: Record<PortalPlan["kind"], string> = {
  monthly: "Mensalidade fixa",
  commission: "Comissão por atendimento",
};

function planLines(plan: PortalPlan): string[] {
  const lines: string[] = [];
  lines.push(
    plan.kind === "commission"
      ? `${(plan.commissionPercent ?? 0).toString().replace(".", ",")}% sobre cada atendimento concluído`
      : "Valor fixo por mês, combinado com o Vez",
  );
  lines.push(
    plan.maxProfessionals === null
      ? "Profissionais sem limite"
      : `Até ${plan.maxProfessionals} profissionais`,
  );
  lines.push(
    plan.maxBranches === null ? "Unidades sem limite" : `Até ${plan.maxBranches} unidades`,
  );
  lines.push(plan.queueIncluded ? "Fila de espera incluída" : "Sem fila de espera");
  lines.push(
    plan.integratedPayment === "required"
      ? "Pagamento pelo app obrigatório"
      : "Pagamento pelo app opcional",
  );
  if (plan.searchHighlight) lines.push("Destaque na busca do app do cliente");
  return lines;
}

/** Quantos dias faltam para a carência da fatura vencida acabar. */
function daysUntilSuspension(invoice: PortalInvoice, graceDays: number): number {
  const late = Math.floor(
    (Date.now() - new Date(`${invoice.dueDate}T00:00:00`).getTime()) / 86_400_000,
  );
  return graceDays - late;
}

/**
 * Plano e assinatura.
 *
 * O plano é só leitura, e não por preguiça: o gatilho
 * `guard_establishment_status` recusa qualquer mudança de plano, desconto ou
 * situação que não venha de admin da plataforma.
 *
 * O que o dono faz aqui é o que só ele pode fazer com dinheiro: conectar a
 * conta em que a loja recebe o sinal pelo app, e pagar a mensalidade. Tudo o
 * que aparece vem do banco — conta conectada de `payment_accounts`, fatura de
 * `billing_invoices`. Sem linha, a tela diz que não há, e não inventa (R7).
 */
export function Billing() {
  const { data, actions } = usePortal();
  const searchParams = useSearchParams();
  const { run, pending } = useSave();
  const [charge, setCharge] = useState<InvoiceCharge | null>(null);
  const [copied, setCopied] = useState(false);
  if (!data) return null;

  const {
    plan,
    catalog,
    planChangedAt,
    discountPercent,
    discountUntil,
    receiving,
    invoices,
    graceDays,
  } = data.business;
  // Fatura mais antiga em atraso: é ela que conta o prazo da suspensão.
  const overdue = invoices.filter((invoice) => invoiceState(invoice).label === "vencida").at(-1);
  const daysLeft = overdue ? daysUntilSuspension(overdue, graceDays) : null;
  const professionals = data.professionals.filter((item) => item.isActive).length;
  const isOwner = data.establishment.role === "owner";
  const establishmentId = data.establishment.id;
  // Como o dono voltou do provedor depois de autorizar (ou não) a conexão.
  const returned = searchParams.get("recebimento");

  const connect = () =>
    run(async () => {
      window.location.assign(await actions.connectReceiving(establishmentId));
    }, "Abrindo o provedor de pagamento…");

  const pay = (invoiceId: string) =>
    run(async () => {
      setCopied(false);
      setCharge(await actions.payInvoice(invoiceId));
    }, "Fatura conferida.");

  return (
    <div className="page">
      <section
        className="kpis"
        style={{ "--gc": "repeat(3,minmax(0,1fr))" } as React.CSSProperties}
      >
        <article>
          <span>Plano atual</span>
          <strong>{plan ? plan.name : "sem plano"}</strong>
          <div>
            <b style={{ color: MUTED }}>{plan ? KIND_LABEL[plan.kind] : "—"}</b>
            <small>
              {planChangedAt
                ? `desde ${new Intl.DateTimeFormat("pt-BR", { dateStyle: "long" }).format(new Date(planChangedAt))}`
                : "definido na aprovação da loja"}
            </small>
          </div>
        </article>
        <article>
          <span>O que você paga</span>
          <strong>
            {plan?.kind === "commission"
              ? `${(plan.commissionPercent ?? 0).toString().replace(".", ",")}%`
              : plan
                ? "mensalidade"
                : "—"}
          </strong>
          <div>
            <b style={{ color: MUTED }}>
              {plan?.kind === "commission" ? "por atendimento concluído" : "valor combinado"}
            </b>
            <small>
              {plan?.kind === "commission"
                ? "Retida na hora, sobre o que o cliente paga pelo app."
                : plan
                  ? "Fatura no dia 1º, vencimento no dia 10, por Pix."
                  : "Definido na aprovação da loja."}
            </small>
          </div>
        </article>
        <article>
          <span>Desconto</span>
          <strong>{discountPercent ? `${discountPercent}%` : "nenhum"}</strong>
          <div>
            <b style={{ color: discountPercent ? GREEN_DARK : MUTED }}>
              {discountPercent ? "concedido pelo Vez" : "—"}
            </b>
            <small>
              {discountUntil
                ? `vale até ${new Intl.DateTimeFormat("pt-BR", { dateStyle: "long" }).format(new Date(`${discountUntil}T12:00:00`))}`
                : "sem prazo registrado"}
            </small>
          </div>
        </article>
      </section>

      <section className="panel">
        <header className="panel-head stacked">
          <h2>O que muda em cada plano</h2>
          <p>
            Os dois modelos coexistem. A troca de plano é feita pela equipe do Vez: fale com o
            suporte para mudar.
          </p>
        </header>
        {catalog.length === 0 ? (
          <div className="list-row">
            <div>
              <strong>Nenhum plano ativo</strong>
              <small>Fale com o suporte do Vez.</small>
            </div>
          </div>
        ) : (
          catalog.map((item) => {
            const current = item.id === plan?.id;
            const overLimit =
              item.maxProfessionals !== null && professionals > item.maxProfessionals;
            return (
              <div className="list-row" key={item.id}>
                <div>
                  <strong style={{ color: current ? INK : undefined }}>
                    {item.name}
                    {current ? " · o seu" : ""}
                  </strong>
                  <small>{planLines(item).join(" · ")}</small>
                  {overLimit ? (
                    <small style={{ color: AMBER_DARK }}>
                      A loja tem {professionals} profissionais na agenda; este plano cabe{" "}
                      {item.maxProfessionals}.
                    </small>
                  ) : null}
                </div>
                <code style={{ color: current ? GREEN_DARK : MUTED }}>
                  {current ? "em uso" : KIND_LABEL[item.kind]}
                </code>
              </div>
            );
          })
        )}
      </section>

      <section className="panel">
        <header className="panel-head stacked">
          <h2>Recebimento pelo app</h2>
          <p>
            O que o cliente paga pelo app, por Pix ou cartão, cai direto na conta da loja. O Vez não
            segura o dinheiro: só a taxa do plano é separada na hora do pagamento.
          </p>
        </header>
        {returned === "erro" ? (
          <div className="list-row">
            <div>
              <strong style={{ color: RED }}>A conexão não foi concluída</strong>
              <small>
                O provedor não confirmou a autorização, ou o prazo de 15 minutos passou. Tente de
                novo.
              </small>
            </div>
          </div>
        ) : null}
        {receiving ? (
          <div className="list-row">
            <div>
              <strong>
                Conta {PROVIDER_LABEL[receiving.provider] ?? receiving.provider} conectada
              </strong>
              <small>
                Desde {longDate(receiving.connectedAt)}.{" "}
                {data.establishment.depositPercent > 0
                  ? "O cliente já pode pagar o sinal ou o valor inteiro pelo app."
                  : "O cliente já pode pagar pelo app, se quiser. Para tornar o sinal obrigatório, ligue-o em Configurações."}
              </small>
            </div>
            {isOwner ? (
              <button
                className="ghost small"
                disabled={pending}
                onClick={() =>
                  run(
                    () => actions.disconnectReceiving(establishmentId),
                    "Conta desconectada. O sinal volta a ser pago no balcão.",
                  )
                }
                type="button"
              >
                Desconectar
              </button>
            ) : (
              <code style={{ color: GREEN_DARK }}>ativa</code>
            )}
          </div>
        ) : (
          <div className="list-row">
            <div>
              <strong>Nenhuma conta conectada</strong>
              <small>
                {isOwner
                  ? "Conecte a conta em que a loja vai receber. Enquanto isso o cliente vê o valor do sinal e paga no estabelecimento."
                  : "Só o dono da loja conecta a conta de recebimento."}
              </small>
            </div>
            {isOwner ? (
              <button className="primary small" disabled={pending} onClick={connect} type="button">
                Conectar conta
              </button>
            ) : (
              <code style={{ color: MUTED }}>pendente</code>
            )}
          </div>
        )}
      </section>

      <section className="panel">
        <header className="panel-head stacked">
          <h2>Faturas</h2>
          <p>
            {plan?.kind === "commission"
              ? "No plano de comissão não há mensalidade: a parte do Vez é separada em cada pagamento pelo app."
              : "A mensalidade do mês, paga por Pix. O mês em que a loja entrou não é cobrado."}
          </p>
        </header>
        {overdue ? (
          <div className="list-row">
            <div>
              <strong style={{ color: RED }}>
                {data.establishment.status === "suspended"
                  ? "Loja suspensa por mensalidade em atraso"
                  : daysLeft !== null && daysLeft > 0
                    ? `Mensalidade em atraso: faltam ${daysLeft} ${daysLeft === 1 ? "dia" : "dias"} para a suspensão`
                    : "Mensalidade em atraso: a loja pode ser suspensa a qualquer momento"}
              </strong>
              <small>
                A loja sai do app {graceDays} dias depois do vencimento e volta sozinha assim que a
                fatura é paga. A agenda e os dados ficam preservados.
              </small>
            </div>
          </div>
        ) : null}
        {invoices.length === 0 ? (
          <div className="list-row">
            <div>
              <strong>Nenhuma fatura emitida</strong>
              <small>
                {isOwner
                  ? "Quando houver mensalidade a pagar, ela aparece aqui."
                  : "As faturas ficam visíveis só para o dono da loja."}
              </small>
            </div>
            <code style={{ color: GREEN_DARK }}>sem pendência</code>
          </div>
        ) : (
          invoices.map((invoice) => {
            const state = invoiceState(invoice);
            const open = charge?.id === invoice.id && charge.status === "open" ? charge : null;
            return (
              <div key={invoice.id}>
                <div className="list-row">
                  <div>
                    <strong>Mensalidade de {monthLabel(invoice.periodStart)}</strong>
                    <small>
                      {money(invoice.amountCents)}
                      {invoice.discountCents > 0
                        ? ` · ${money(invoice.discountCents)} de desconto sobre ${money(invoice.listPriceCents)}`
                        : ""}
                      {invoice.status === "paid" && invoice.paidAt
                        ? ` · paga em ${longDate(invoice.paidAt)}`
                        : ` · vence em ${longDate(`${invoice.dueDate}T12:00:00`)}`}
                    </small>
                  </div>
                  {invoice.status === "open" ? (
                    <button
                      className="primary small"
                      disabled={pending}
                      onClick={() => pay(invoice.id)}
                      type="button"
                    >
                      {open ? "Já paguei" : "Pagar com Pix"}
                    </button>
                  ) : null}
                  <code style={{ color: state.tone }}>{state.label}</code>
                </div>
                {open?.pixCopyPaste ? (
                  <div className="list-row">
                    <div>
                      <strong>Pix copia e cola</strong>
                      <small style={{ fontFamily: MONO, wordBreak: "break-all" }}>
                        {open.pixCopyPaste}
                      </small>
                      <small>
                        Cole no app do seu banco
                        {open.chargeExpiresAt
                          ? ` até ${new Intl.DateTimeFormat("pt-BR", { timeStyle: "short" }).format(new Date(open.chargeExpiresAt))}`
                          : ""}
                        . Depois de pagar, toque em “Já paguei”.
                      </small>
                    </div>
                    <button
                      className="ghost small"
                      onClick={async () => {
                        await navigator.clipboard.writeText(open.pixCopyPaste ?? "");
                        setCopied(true);
                      }}
                      type="button"
                    >
                      {copied ? "Copiado" : "Copiar código"}
                    </button>
                  </div>
                ) : null}
              </div>
            );
          })
        )}
      </section>
    </div>
  );
}
