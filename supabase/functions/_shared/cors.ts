/**
 * Cabeçalhos de CORS.
 *
 * O app nativo não faz preflight, mas o portal e o admin (Next, no navegador)
 * fazem. Uma função que responde só ao app quebra silenciosamente na web.
 */
export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/** Erro com código estável — o app traduz pelo código, nunca pela mensagem. */
export function fail(code: string, message: string, status = 400): Response {
  return json({ error: { code, message } }, status);
}
