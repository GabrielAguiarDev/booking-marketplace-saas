import type { Metadata } from "next";
import Link from "next/link";

import { DocPage } from "@/components/doc";
import { ROUTES, SITE } from "@/components/site";

export const metadata: Metadata = {
  title: "App do Vez para quem agenda",
  description:
    "Veja quem tem horário livre perto de você, reserve sem ligar e entre na fila de espera quando não houver vaga.",
};

/**
 * Destino dos links "Para o cliente". Os botões das lojas só aparecem com o
 * link público configurado (`NEXT_PUBLIC_CLIENT_*_STORE_URL`); sem ele, a
 * página diz que o app ainda não foi publicado em vez de oferecer um botão
 * que não leva a lugar nenhum.
 */
export default function CustomerAppPage() {
  const stores = [
    SITE.appStoreUrl ? { href: SITE.appStoreUrl, label: "Baixar na App Store" } : null,
    SITE.playStoreUrl ? { href: SITE.playStoreUrl, label: "Baixar no Google Play" } : null,
  ].filter((store) => store !== null);

  return (
    <DocPage
      eyebrow="Para quem agenda"
      title="O app do Vez"
      lead="Você diz o que precisa e vê quem tem horário hoje perto de você. Escolhe a hora e confirma. Sem ligar, sem esperar resposta."
    >
      <h2 id="baixar">Baixar o app</h2>
      {stores.length > 0 ? (
        <>
          <p>Disponível para celular. É grátis para quem agenda.</p>
          <div className="doc__actions">
            {stores.map((store, index) => (
              <a
                key={store.href}
                href={store.href}
                className={index === 0 ? "btn btn--primary btn--lg" : "btn btn--ghost btn--lg"}
                rel="noopener"
                target="_blank"
              >
                {store.label}
                <span className="sr-only"> (abre em nova aba)</span>
              </a>
            ))}
          </div>
        </>
      ) : (
        <div className="doc__card doc__card--warn" role="status">
          <p>
            <b>O app ainda não está nas lojas.</b>
          </p>
          <p>
            Estamos terminando a publicação na App Store e no Google Play. Quando sair, os links
            aparecem aqui. Enquanto isso, o estabelecimento que usa o Vez também marca seu horário
            pelo balcão.
          </p>
        </div>
      )}

      <h2 id="como-agendar">Como agendar</h2>
      <ol className="doc__steps">
        <li>Abra o app e diga do que você precisa: corte, unha, barba, estética, pet.</li>
        <li>
          Veja os estabelecimentos perto de você com os horários que ainda estão livres. É a agenda
          de verdade, atualizada no minuto.
        </li>
        <li>
          Escolha o serviço, o profissional e a hora. Antes de confirmar, você vê o preço, a duração
          e a regra de cancelamento da loja.
        </li>
        <li>
          Pronto: a reserva cai direto na agenda do estabelecimento e você recebe a confirmação.
          Algumas lojas aprovam cada pedido antes — o app mostra quando for o caso.
        </li>
      </ol>
      <p>
        Precisa desmarcar? Cancele pelo próprio app, dentro do prazo que a loja definiu. O horário
        volta a ficar livre para outra pessoa.
      </p>

      <h2 id="fila">Fila de espera</h2>
      <p>
        Quando não tem horário, você entra na fila do estabelecimento sem sair de casa e acompanha
        sua posição pelo app. Se alguém desmarca ou a cadeira vaga, quem está na fila é chamado por
        ordem.
      </p>
      <ul>
        <li>Sua posição e a estimativa de espera aparecem no app, atualizadas ao vivo.</li>
        <li>
          Algumas lojas pedem que você confirme a chegada. Até confirmar, você não segura a fila de
          quem já está lá.
        </li>
        <li>Mudou de ideia? Saia da fila pelo app e sua vez passa para o próximo.</li>
      </ul>

      <h2 id="loja">Tem um estabelecimento?</h2>
      <p>
        O Vez põe a sua agenda na frente de quem está procurando por perto.{" "}
        <Link href={ROUTES.home}>Veja como funciona para o estabelecimento</Link>.
      </p>
    </DocPage>
  );
}
