"use client";

import { useEffect, useRef, useState } from "react";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Teclado e foco de um diálogo ou gaveta.
 *
 * Esc fecha, Tab circula só dentro do painel e, ao fechar, o foco volta para
 * quem abriu. Sem isto, quem usa teclado ou leitor de tela fica navegando na
 * página que está atrás do painel. O foco inicial respeita o `autoFocus` do
 * formulário; quando não há, vai para o primeiro campo ou botão.
 */
export function useDialog<T extends HTMLElement>(onClose: () => void) {
  const ref = useRef<T>(null);
  // Lido na primeira renderização: quando o efeito roda, o `autoFocus` do
  // formulário já tirou o foco do botão que abriu o painel.
  const [opener] = useState(() =>
    typeof document !== "undefined" && document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null,
  );
  const close = useRef(onClose);
  useEffect(() => {
    close.current = onClose;
  });

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const controls = () =>
      Array.from(node.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (item) => item.getClientRects().length > 0,
      );
    if (!node.contains(document.activeElement)) {
      // Com formulário, o primeiro campo; sem, o primeiro botão. Em desenvolvimento o
      // StrictMode remonta o efeito e desfaz o `autoFocus`, e este é o mesmo destino.
      const items = controls();
      const field = items.find((item) => item.matches("input, select, textarea"));
      (field ?? items[0] ?? node).focus();
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        close.current();
        return;
      }
      if (event.key !== "Tab") return;
      const items = controls();
      const first = items[0];
      const last = items[items.length - 1];
      if (!first || !last) return;
      const current = document.activeElement;
      if (!node.contains(current)) {
        event.preventDefault();
        first.focus();
      } else if (event.shiftKey && current === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && current === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      if (opener?.isConnected) opener.focus();
    };
  }, [opener]);

  return ref;
}
