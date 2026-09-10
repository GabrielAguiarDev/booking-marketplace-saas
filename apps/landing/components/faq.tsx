import { FAQ } from "./data";
import { SectionHead } from "./ui";

export function Faq() {
  return (
    <section id="duvidas" className="wrap faq">
      <SectionHead eyebrow="06 — dúvidas" title="O que a gente mais escuta." />
      <div data-reveal className="faq__list">
        {FAQ.map((item) => (
          <details key={item.q}>
            <summary>
              {item.q}
              <span className="mono" aria-hidden>
                +
              </span>
            </summary>
            <p>{item.a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
