/**
 * Endereço do portal web da loja. É lá que ficam o cadastro da loja, a equipe,
 * a escala e a correção pedida pela aprovação — o app abre no navegador.
 *
 * Acesso literal a `process.env.EXPO_PUBLIC_…`: o Metro só substitui o nome
 * escrito por extenso.
 */
const base = (process.env.EXPO_PUBLIC_PORTAL_URL ?? "http://localhost:3001").replace(/\/+$/, "");

export function portalUrl(options: { establishmentId?: string | null; signup?: boolean } = {}) {
  if (options.signup) return `${base}/?mode=signup`;
  return options.establishmentId
    ? `${base}/?establishment=${encodeURIComponent(options.establishmentId)}`
    : `${base}/`;
}
