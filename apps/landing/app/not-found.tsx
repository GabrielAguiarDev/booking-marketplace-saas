import Link from "next/link";
import { DocPage } from "@/components/doc";
import { ROUTES } from "@/components/site";

export default function NotFound() {
  return (
    <DocPage
      eyebrow="Erro 404"
      title="Esta página não existe."
      lead="O endereço pode ter mudado ou estar digitado errado."
    >
      <div className="doc__actions">
        <Link href={ROUTES.home} className="btn btn--primary btn--lg">
          Voltar para a página inicial
        </Link>
        <Link href={ROUTES.customerApp} className="btn btn--ghost btn--lg">
          Sou cliente
        </Link>
      </div>
    </DocPage>
  );
}
