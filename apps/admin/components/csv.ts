/**
 * CSV para o Excel em português: separador `;` e BOM no começo, para abrir
 * com acento e vírgula decimal sem passar pelo assistente de importação.
 */

function escape(value: string): string {
  // Excel executa células iniciadas por estes caracteres como fórmula. O
  // apóstrofo força texto e evita que nomes controlados por usuário virem CSV injection.
  const safe = /^[=+\-@]/.test(value) ? `'${value}` : value;
  return /[";\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export function toCsv(header: string[], rows: string[][]): string {
  return [header, ...rows].map((row) => row.map(escape).join(";")).join("\n");
}

export function downloadCsv(filename: string, csv: string) {
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
