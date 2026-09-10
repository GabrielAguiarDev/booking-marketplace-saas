/**
 * Exportação das tabelas de uma seção para CSV.
 *
 * Separador `;` e BOM no começo: é o que o Excel em português abre sem pedir
 * para importar, com acento e vírgula decimal no lugar.
 */

import type { Block } from "./section-data";

function escape(value: string): string {
  return /[";\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export function tablesToCsv(blocks: Block[]): string {
  const lines: string[] = [];
  for (const block of blocks) {
    if (block.kind !== "table") continue;
    if (block.title) lines.push(escape(block.title));
    lines.push(block.cols.map((c) => escape(c.t)).join(";"));
    for (const row of block.rows) {
      lines.push(row.map((c) => escape([c.v, c.sub].filter(Boolean).join(" · "))).join(";"));
    }
    lines.push("");
  }
  return lines.join("\n");
}

export function downloadCsv(filename: string, csv: string) {
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
