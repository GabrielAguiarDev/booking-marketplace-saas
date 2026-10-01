"use client";

import { useId } from "react";

import styles from "./operation.module.css";
import { useDialog } from "./use-dialog";

/**
 * Gaveta lateral da operação (detalhe da reserva, recusa, novo agendamento).
 *
 * Uma casca só para as três, para que teclado e foco se comportem igual: Esc e
 * o clique fora fecham, Tab fica dentro e o foco volta para quem abriu.
 */
export function Drawer({
  label,
  title,
  onClose,
  footer,
  children,
}: {
  label: string;
  title: string;
  onClose: () => void;
  footer: React.ReactNode;
  children: React.ReactNode;
}) {
  const ref = useDialog<HTMLElement>(onClose);
  const titleId = useId();
  return (
    <div className={styles.overlay}>
      <button
        aria-label="Fechar"
        className={styles.scrim}
        onClick={onClose}
        tabIndex={-1}
        type="button"
      />
      <aside
        aria-labelledby={titleId}
        aria-modal="true"
        className={styles.drawer}
        ref={ref}
        role="dialog"
        tabIndex={-1}
      >
        <header className={styles.drawerHeader}>
          <div id={titleId}>
            <code>{label}</code>
            <strong>{title}</strong>
          </div>
          <button className={styles.iconButton} onClick={onClose} type="button">
            Fechar
          </button>
        </header>
        <div className={styles.drawerBody}>{children}</div>
        <footer className={styles.drawerFooter}>{footer}</footer>
      </aside>
    </div>
  );
}
