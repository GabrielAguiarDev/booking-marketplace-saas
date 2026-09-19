import type { Metadata } from "next";
import Link from "next/link";

import { DocPage } from "@/components/doc";
import { CompanyCard, ContactLinks, LEGAL_UPDATED_AT } from "@/components/legal";
import { ROUTES } from "@/components/site";

export const metadata: Metadata = {
  title: "Privacidade — Vez",
  description:
    "Quais dados o Vez trata, para quê, com quem compartilha e como exercer seus direitos pela LGPD.",
};

/**
 * A lista abaixo segue o que o banco guarda de fato (ver `supabase/migrations`).
 * Se uma tabela nova passar a guardar dado pessoal, este texto muda junto.
 */
export default function PrivacyPage() {
  return (
    <DocPage
      eyebrow="Legal · LGPD"
      title="Política de Privacidade"
      lead="Quais dados pessoais o Vez trata, por quê, com quem compartilha e como você exerce seus direitos pela Lei Geral de Proteção de Dados (Lei 13.709/2018)."
      meta={`Versão em vigor desde ${LEGAL_UPDATED_AT}`}
    >
      <h2 id="controlador">1. Quem é o controlador</h2>
      <p>
        O controlador dos dados tratados na plataforma é a empresa identificada abaixo. Cada
        estabelecimento também é controlador dos dados dos próprios clientes que ele registra (por
        exemplo, um atendimento marcado no balcão).
      </p>
      <CompanyCard />

      <h2 id="dados">2. Quais dados e para quê</h2>
      <ul>
        <li>
          <b>Interessados pela página inicial:</b> nome, nome do estabelecimento, WhatsApp e, se
          você quiser, tipo de negócio e mensagem. Usamos só para entrar em contato sobre o Vez.
        </li>
        <li>
          <b>Conta:</b> e-mail, nome e, se informado, telefone. Servem para entrar, recuperar a
          senha e identificar você nas reservas.
        </li>
        <li>
          <b>Estabelecimento:</b> razão social, CNPJ, responsável, e-mail e telefone de contato,
          endereço, serviços, preços, horários, equipe e fotos. O que é público (nome, descrição,
          endereço, fotos, serviços e horários livres) aparece no app do cliente depois da
          aprovação.
        </li>
        <li>
          <b>Reservas e fila:</b> serviço, profissional, horário, situação (confirmada, concluída,
          cancelada, falta) e posição na fila. São o próprio serviço que você pediu.
        </li>
        <li>
          <b>Avaliações e suporte:</b> nota, comentário, resposta do estabelecimento e as mensagens
          de chamados de ajuda.
        </li>
        <li>
          <b>Registro de segurança:</b> ações administrativas da equipe do Vez ficam registradas com
          autor e data, para auditoria.
        </li>
      </ul>
      <p>
        Não pedimos sua localização e não vendemos dados pessoais. Pagamentos pelo app ainda não são
        processados pelo Vez; quando forem, esta política dirá qual provedor recebe quais dados.
      </p>

      <h2 id="bases">3. Bases legais</h2>
      <ul>
        <li>Execução do contrato: conta, reservas, fila, cadastro e operação da loja.</li>
        <li>Procedimentos preliminares a pedido do titular: contato com interessados.</li>
        <li>Legítimo interesse: segurança, prevenção a fraude, moderação e melhoria do serviço.</li>
        <li>Cumprimento de obrigação legal: guarda de registros exigidos por lei.</li>
      </ul>

      <h2 id="compartilhamento">4. Com quem compartilhamos</h2>
      <ul>
        <li>
          Com o estabelecimento em que você reserva ou entra na fila: seu nome, contato e os dados
          da reserva, para ele poder atender você.
        </li>
        <li>
          Com fornecedores de infraestrutura que hospedam o banco de dados, os arquivos e o envio de
          e-mails, sob contrato e só para operar o serviço.
        </li>
        <li>Com autoridades, quando houver obrigação legal ou ordem judicial.</li>
      </ul>

      <h2 id="retencao">5. Por quanto tempo</h2>
      <p>
        Mantemos os dados enquanto a conta estiver ativa ou enquanto forem necessários para a
        finalidade acima. Contatos de interessados que não viram cliente são descartados quando
        deixam de ser úteis. Registros que a lei obriga a guardar ficam pelo prazo legal.
      </p>

      <h2 id="seguranca">6. Segurança</h2>
      <p>
        O acesso aos dados é controlado por regra no próprio banco: cada pessoa vê só o que o seu
        papel permite, e cada loja só vê os próprios dados. A conexão é criptografada e o acesso da
        equipe do Vez aos dados de uma loja exige autorização registrada.
      </p>

      <h2 id="direitos">7. Seus direitos</h2>
      <p>
        Você pode pedir confirmação de tratamento, acesso, correção, anonimização, portabilidade,
        eliminação dos dados tratados com base no consentimento, informação sobre compartilhamento e
        revisão de decisões automatizadas. Também pode reclamar à Autoridade Nacional de Proteção de
        Dados (ANPD).
      </p>
      <p>
        Para exercer qualquer um deles, fale com a gente por <ContactLinks privacy />. Respondemos
        em até 15 dias.
      </p>

      <h2 id="mudancas">8. Mudanças</h2>
      <p>
        Quando esta política mudar, a nova versão fica nesta página com a data de vigência. Veja
        também os <Link href={ROUTES.terms}>Termos de uso</Link>.
      </p>
    </DocPage>
  );
}
