"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

/**
 * Menu das seções em tela estreita, onde a fileira de links do cabeçalho não
 * cabe. Sem JavaScript o botão não abre, e os mesmos destinos continuam no
 * rodapé.
 */
export function MobileNav({
  items,
  loginHref,
}: {
  items: { href: string; label: string }[];
  /** Em telas muito estreitas o "Entrar" do cabeçalho não cabe e passa para cá. */
  loginHref: string;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <div className="header__menu">
      <button
        aria-controls="header-menu"
        aria-expanded={open}
        aria-label={open ? "Fechar menu" : "Abrir menu"}
        className="header__menu-button"
        onClick={() => setOpen((value) => !value)}
        type="button"
      >
        <svg aria-hidden="true" fill="none" height="20" viewBox="0 0 24 24" width="20">
          <path
            d={open ? "M6 6l12 12M18 6L6 18" : "M4 7h16M4 12h16M4 17h16"}
            stroke="currentColor"
            strokeLinecap="round"
            strokeWidth="1.8"
          />
        </svg>
      </button>
      <nav
        aria-label="Seções da página"
        className="header__menu-panel"
        hidden={!open}
        id="header-menu"
      >
        {items.map((item) => (
          <Link href={item.href} key={item.href} onClick={() => setOpen(false)}>
            {item.label}
          </Link>
        ))}
        <a className="header__menu-login" href={loginHref}>
          Entrar no portal
        </a>
      </nav>
    </div>
  );
}
