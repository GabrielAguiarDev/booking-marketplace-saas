"use client";

import { useEffect } from "react";

/**
 * Sobe cada `[data-reveal]` quando ele entra na tela. É a única parte da página
 * que precisa de JavaScript; o resto é renderizado no servidor.
 */
export function Reveal() {
  useEffect(() => {
    const els = Array.from(document.querySelectorAll<HTMLElement>("[data-reveal]"));
    const show = (el: Element) => el.setAttribute("data-shown", "");

    if (!("IntersectionObserver" in window)) {
      els.forEach(show);
      return;
    }

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          show(entry.target);
          io.unobserve(entry.target);
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.05 },
    );
    els.forEach((el) => io.observe(el));

    // Quem já está na primeira dobra não espera o observer.
    const first = setTimeout(() => {
      for (const el of els) {
        if (el.getBoundingClientRect().top < window.innerHeight) show(el);
      }
    }, 400);

    return () => {
      clearTimeout(first);
      io.disconnect();
    };
  }, []);

  return null;
}
