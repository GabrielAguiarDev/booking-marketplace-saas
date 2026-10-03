import type { Metadata } from "next";
import Link from "next/link";

import { DocPage } from "@/components/doc";
import { CompanyCard, ContactLinks, LEGAL_UPDATED_AT } from "@/components/legal";
import { ROUTES } from "@/components/site";

export const metadata: Metadata = {
  title: "Termos de uso — Vez",
  description:
    "As regras de uso do Vez para estabelecimentos e para quem agenda: cadastro, aprovação, planos, reservas, fila e avaliações.",
};

export default function TermsPage() {
  return (
    <DocPage
      eyebrow="Legal"
      title="Termos de uso"
      lead="O que você pode esperar do Vez e o que o Vez espera de você — para o estabelecimento que publica a agenda e para quem agenda pelo app."
      meta={`Versão em vigor desde ${LEGAL_UPDATED_AT}`}
    >
      <CompanyCard />

      <h2 id="o-que-e">1. O que é o Vez</h2>
      <p>
        O Vez é uma plataforma de agendamento. Estabelecimentos (barbearias, salões, clínicas de
        estética, petshops e similares) publicam serviços, preços, equipe e horários. Clientes
        encontram horário livre, reservam e entram em fila de espera pelo app. O Vez intermedeia a
        reserva; quem presta o serviço é sempre o estabelecimento.
      </p>

      <h2 id="conta">2. Conta e acesso</h2>
      <ul>
        <li>
          Para usar o portal, o app da loja ou reservar pelo app, é preciso ter conta com e-mail
          válido.
        </li>
        <li>Você responde pelo sigilo da sua senha e pelo que é feito com a sua conta.</li>
        <li>
          No estabelecimento, o dono define quem da equipe tem acesso e com qual papel (dono,
          gerência ou equipe). Cada papel vê e altera só o que lhe cabe.
        </li>
      </ul>

      <h2 id="estabelecimento">3. Cadastro e aprovação do estabelecimento</h2>
      <ul>
        <li>
          O cadastro pede dados verdadeiros: razão social, CNPJ, responsável, contato e endereço. O
          estabelecimento só aparece para clientes depois de aprovado pela equipe do Vez.
        </li>
        <li>
          A equipe pode aprovar, recusar com motivo ou pedir correção. Pedida a correção, o dono
          ajusta os dados e reenvia pelo portal.
        </li>
        <li>
          O estabelecimento é responsável pelo que publica (serviços, preços, fotos, descrição) e
          por cumprir as reservas que aceita.
        </li>
        <li>
          Dados falsos, uso para fraude ou descumprimento reiterado destes termos podem levar à
          suspensão, com aviso e motivo registrados.
        </li>
      </ul>

      <h2 id="planos">4. Planos e cobrança</h2>
      <p>
        Há dois planos com as mesmas funções: mensalidade fixa ou comissão por agendamento concluído
        (ver <Link href={ROUTES.plans}>Planos</Link>). O plano é definido na aprovação da loja e
        trocado pela equipe do Vez, a pedido do estabelecimento.
      </p>
      <p>
        Nenhuma cobrança é feita sem que o valor, o plano e a forma de pagamento estejam informados
        ao estabelecimento com antecedência. O pagamento do cliente ao estabelecimento continua
        acontecendo do jeito que o estabelecimento já recebe, salvo quando ele optar por receber
        pelo app — e aí as taxas aparecem separadas. Nesse caso o valor pago pelo cliente cai direto
        na conta do estabelecimento no provedor de pagamento (Mercado Pago); o Vez não guarda nem
        repassa esse dinheiro, e retém apenas a taxa do plano. A mensalidade é cobrada por fatura
        mensal, paga por Pix no portal; fatura em atraso além da carência informada no portal
        suspende a loja até o pagamento.
      </p>

      <h2 id="reservas">5. Reservas, cancelamentos e fila</h2>
      <ul>
        <li>
          Cada estabelecimento define suas regras: aprovação automática ou manual, antecedência
          mínima, prazo para cancelar e, se houver, sinal. Elas aparecem antes de você confirmar.
        </li>
        <li>
          O preço e a duração ficam congelados no momento da reserva. Mudanças posteriores do
          estabelecimento não alteram o que já foi reservado.
        </li>
        <li>
          Na fila de espera, a vez é chamada por ordem. Quem não comparece quando chamado pode
          perder a posição, conforme a regra do estabelecimento.
        </li>
        <li>Faltas repetidas podem limitar novas reservas pela conta.</li>
      </ul>

      <h2 id="avaliacoes">6. Avaliações</h2>
      <p>
        Só quem foi atendido avalia. O estabelecimento pode responder e pedir revisão de uma
        avaliação; a equipe do Vez decide com motivo registrado. Não removemos avaliação só por ser
        negativa.
      </p>

      <h2 id="uso">7. Uso aceitável</h2>
      <p>
        Não é permitido usar o Vez para enviar conteúdo ilegal, ofensivo ou enganoso, fazer reservas
        falsas, tentar acessar dados de outras contas ou sobrecarregar o serviço.
      </p>

      <h2 id="disponibilidade">8. Disponibilidade e responsabilidade</h2>
      <p>
        Trabalhamos para o Vez ficar no ar, mas pode haver interrupções para manutenção ou por
        falhas de terceiros. O Vez não responde pela qualidade do serviço prestado pelo
        estabelecimento, que é de responsabilidade dele, sem prejuízo dos direitos do consumidor
        previstos em lei.
      </p>

      <h2 id="dados">9. Dados pessoais</h2>
      <p>
        Como tratamos seus dados está na <Link href={ROUTES.privacy}>Política de Privacidade</Link>.
      </p>

      <h2 id="mudancas">10. Mudanças e encerramento</h2>
      <p>
        Se estes termos mudarem, a nova versão é publicada nesta página com a data de vigência, e
        mudanças relevantes são avisadas antes. Você pode encerrar sua conta a qualquer momento
        falando com a gente. Aplica-se a lei brasileira; para o consumidor, vale o foro do seu
        domicílio.
      </p>

      <h2 id="contato">11. Contato</h2>
      <p>
        Dúvidas sobre estes termos: <ContactLinks />.
      </p>
    </DocPage>
  );
}
