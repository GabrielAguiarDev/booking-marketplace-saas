"use client";

import type { PortalPlan } from "./model";
import { usePortal } from "./store";
import { AMBER_DARK, GREEN_DARK, INK, MUTED } from "./tokens";

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

/**
 * Plano e assinatura.
 *
 * Só leitura, e não por preguiça: o gatilho `guard_establishment_status` recusa
 * qualquer mudança de plano, desconto ou situação que não venha de admin da
 * plataforma. E não existe fatura para mostrar — `payments` nunca recebeu uma
 * linha porque o provedor de pagamento não foi escolhido. Inventar histórico
 * de cobrança aqui seria a mentira mais cara do produto (R7).
 */
export function Billing() {
  const { data } = usePortal();
  if (!data) return null;

  const { plan, catalog, planChangedAt, discountPercent, discountUntil } = data.business;
  const professionals = data.professionals.filter((item) => item.isActive).length;

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
            <small>Cobrança ainda não roda: falta o provedor de pagamento.</small>
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
          <h2>Cobrança</h2>
          <p>O que existe hoje e o que ainda não.</p>
        </header>
        <div className="list-row">
          <div>
            <strong>Nenhuma cobrança foi emitida</strong>
            <small>
              O Vez ainda não escolheu o provedor de pagamento. Enquanto isso não acontece, não há
              fatura, cartão cadastrado nem repasse — e esta tela não mostra nenhum número inventado
              no lugar deles.
            </small>
          </div>
          <code style={{ color: AMBER_DARK }}>a definir</code>
        </div>
        <div className="list-row">
          <div>
            <strong>Sua loja continua no ar</strong>
            <small>
              Nada é suspenso por falta de pagamento enquanto a cobrança não existir. A situação da
              loja hoje é “
              {data.establishment.status === "active" ? "ativa" : data.establishment.status}”.
            </small>
          </div>
          <code style={{ color: GREEN_DARK }}>sem pendência</code>
        </div>
      </section>
    </div>
  );
}
