/**
 * O portal do estabelecimento é outro app (porta 3001 no ambiente local) e em
 * produção vai viver em outro domínio — por isso a URL vem do ambiente. O
 * padrão local existe para a landing abrir sem ninguém precisar preencher
 * `.env` antes.
 *
 * O acesso é a `process.env.NOME_LITERAL`: chave dinâmica não é substituída
 * pelo Next em tempo de build e chegaria vazia no bundle (ver
 * `packages/supabase/src/env.ts`).
 */
const base = (process.env.NEXT_PUBLIC_PORTAL_URL ?? "http://localhost:3001").replace(/\/+$/, "");

/** "Entrar": sem sessão, o portal abre no login. */
export const PORTAL_LOGIN = `${base}/`;

/**
 * "Cadastrar minha loja": abre o portal já na criação de conta. Depois de
 * confirmar o e-mail, quem não tem loja cai no formulário de cadastro, que é o
 * onboarding da P2.
 */
export const PORTAL_SIGNUP = `${base}/?mode=signup`;
