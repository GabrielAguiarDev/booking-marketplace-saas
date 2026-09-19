import { resolveIncomingPath } from "../src/linking-rules";

/**
 * Todo link que abre o app passa por aqui antes do roteador: esquema próprio,
 * link universal e notificação. A regra de verdade mora em `linking-rules.ts`,
 * que é testada; aqui só não se deixa um link malformado derrubar o app.
 */
export function redirectSystemPath({ path }: { path: string; initial: boolean }): string {
  try {
    return resolveIncomingPath(path);
  } catch {
    return "/";
  }
}
