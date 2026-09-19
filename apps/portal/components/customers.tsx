"use client";

import { useMemo, useState } from "react";

import { dateTimeLabel, money, phoneLabel } from "./operation-format";
import styles from "./operation.module.css";
import { usePortal } from "./store";

export function Customers() {
  const { data } = usePortal();
  const operation = data?.operation;
  const [query, setQuery] = useState("");

  const customers = useMemo(() => {
    if (!operation) return [];
    const normalized = query.trim().toLocaleLowerCase("pt-BR");
    if (!normalized) return operation.customers;
    const digits = normalized.replace(/\D/g, "");
    return operation.customers.filter(
      (customer) =>
        customer.name.toLocaleLowerCase("pt-BR").includes(normalized) ||
        (digits && (customer.phone ?? "").replace(/\D/g, "").includes(digits)),
    );
  }, [operation, query]);

  if (!operation) return null;

  const completed = operation.customers.reduce((sum, customer) => sum + customer.completed, 0);
  const spent = operation.customers.reduce((sum, customer) => sum + customer.spentCents, 0);
  const withAccount = operation.customers.filter((customer) => customer.hasAccount).length;

  return (
    <div className={styles.page}>
      <section className={styles.kpis}>
        <article className={styles.kpi}>
          <span>Clientes identificados</span>
          <strong>{operation.customers.length}</strong>
          <small>Conta ou contato/visita de balcão</small>
        </article>
        <article className={styles.kpi}>
          <span>Com conta no app</span>
          <strong>{withAccount}</strong>
          <small>{operation.customers.length - withAccount} sem conta</small>
        </article>
        <article className={styles.kpi}>
          <span>Atendimentos concluídos</span>
          <strong>{completed}</strong>
          <small>Histórico completo desta loja</small>
        </article>
        <article className={styles.kpi}>
          <span>Valor concluído acumulado</span>
          <strong>{money(spent)}</strong>
          <small>Preço registrado em atendimentos concluídos</small>
        </article>
      </section>

      <section className={styles.panel}>
        <header className={styles.toolbar}>
          <h2>Histórico de clientes</h2>
          <input
            aria-label="Buscar cliente"
            className={styles.search}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar por nome ou telefone"
            value={query}
          />
          <span className={styles.subtle}>{customers.length} resultados</span>
        </header>
        <div className={styles.tableWrap}>
          <div className={`${styles.customerGrid} ${styles.tableHead}`}>
            <span>CLIENTE</span>
            <span>CONTATO</span>
            <span className={styles.right}>AGENDAMENTOS</span>
            <span className={styles.right}>CONCLUÍDOS</span>
            <span className={styles.right}>FILA</span>
            <span className={styles.right}>FALTAS</span>
            <span className={styles.right}>ACUMULADO</span>
          </div>
          {customers.length === 0 ? (
            <p className={styles.empty}>Nenhum cliente encontrado.</p>
          ) : (
            customers.map((customer) => (
              <div className={styles.customerGrid} key={customer.key}>
                <div className={styles.rowMain}>
                  <strong>{customer.name}</strong>
                  <code>
                    {customer.hasAccount ? "Com conta" : "Sem conta"} · visto por último{" "}
                    {dateTimeLabel(customer.lastSeenAt, operation.summary.timezone)}
                  </code>
                </div>
                <code>{phoneLabel(customer.phone)}</code>
                <code className={styles.right}>{customer.appointments}</code>
                <code className={styles.right}>{customer.completed}</code>
                <code className={styles.right}>{customer.queueVisits}</code>
                <code className={styles.right}>{customer.noShows}</code>
                <strong className={styles.right}>{money(customer.spentCents)}</strong>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
