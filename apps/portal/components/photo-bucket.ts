/**
 * Nome do bucket das fotos do perfil público.
 *
 * Fica sozinho num módulo porque as duas pontas precisam dele: o loader (que é
 * `server-only`) monta a URL pública, e a ação do navegador envia o arquivo.
 * Importar o loader do lado do cliente quebraria o build.
 */
export const PHOTO_BUCKET = "establishment-photos";
