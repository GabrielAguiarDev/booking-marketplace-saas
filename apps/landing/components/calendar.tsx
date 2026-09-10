import type { CalendarBlock } from "./data";

/**
 * Corpo de uma maquete de agenda: régua de horas à esquerda, uma coluna por dia
 * ou profissional, e os blocos posicionados na grade. O cabeçalho fica com quem
 * chama, porque cada maquete tem o seu.
 */
export function CalendarGrid({
  hours,
  columns,
  blocks,
  variant,
}: {
  hours: string[];
  columns: number;
  blocks: CalendarBlock[];
  variant: "week" | "day";
}) {
  const lastRow = hours.length + 1;

  return (
    <div
      className={`cal cal--${variant}`}
      style={{ gridTemplateRows: `repeat(${hours.length}, var(--row))` }}
    >
      {hours.map((hour, i) => (
        <div key={hour} className="cal__hour" style={{ gridRow: i + 1 }}>
          {hour}:00
        </div>
      ))}
      {Array.from({ length: columns }, (_, i) => (
        <div key={i} className="cal__line" style={{ gridColumn: i + 2, gridRow: `1/${lastRow}` }} />
      ))}
      {blocks.map((block) => (
        <div
          key={`${block.col}-${block.rows}`}
          className={`cal__block tone-${block.tone}`}
          style={{ gridColumn: block.col, gridRow: block.rows }}
        >
          {block.title && <div className="cal__title">{block.title}</div>}
          {block.meta && <div className="cal__meta">{block.meta}</div>}
        </div>
      ))}
    </div>
  );
}
