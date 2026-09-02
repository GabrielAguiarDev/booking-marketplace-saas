/**
 * Next e Expo substituem `process.env.NOME_LITERAL` em tempo de build. Acesso
 * por chave dinâmica (`process.env[nome]`) não é substituído e chega vazio no
 * bundle — por isso cada entrypoint lê suas variáveis literalmente e só passa
 * o valor já resolvido para cá.
 */
export function requireEnv(value: string | undefined, name: string): string {
  if (value === undefined || value === "") {
    throw new Error(
      `Variável de ambiente ausente: ${name}. ` +
        `Copie o .env.example do app e preencha com a saída de \`pnpm db:status\`.`,
    );
  }
  return value;
}
