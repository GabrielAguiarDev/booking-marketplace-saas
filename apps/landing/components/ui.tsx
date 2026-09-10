/** Rótulo numerado, título e linha de apoio que abrem cada seção. */
export function SectionHead({
  eyebrow,
  title,
  lead,
  wide,
}: {
  eyebrow: string;
  title: string;
  lead?: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <div data-reveal className={wide ? "section-head section-head--wide" : "section-head"}>
      <span className="eyebrow">{eyebrow}</span>
      <h2>{title}</h2>
      {lead && <p>{lead}</p>}
    </div>
  );
}

/** Janela de maquete: barra de título clara e o conteúdo embaixo. */
export function Mock({
  title,
  aside,
  children,
  raised,
}: {
  title: React.ReactNode;
  aside?: React.ReactNode;
  children: React.ReactNode;
  raised?: boolean;
}) {
  return (
    <div className={raised ? "mock mock--raised" : "mock"}>
      <div className="mock__bar">
        <span>{title}</span>
        {aside}
      </div>
      {children}
    </div>
  );
}

export function Check({ children }: { children: React.ReactNode }) {
  return <p className="mono check">✓ {children}</p>;
}
