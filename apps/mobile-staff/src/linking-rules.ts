/**
 * Para onde vai um link que abre o app da loja.
 *
 * Chega aqui tanto o esquema próprio (`vezstaff://agendamento/<id>`) quanto o
 * link universal (`https://<domínio da loja>/agendamento/<id>`, quando
 * `EXPO_PUBLIC_STAFF_LINK_HOST` está configurado — ver `app.config.ts`). A
 * resposta é sempre uma rota que existe: link velho, digitado errado ou de
 * outra versão cai na tela Hoje, nunca na tela de "não encontrado".
 *
 * Puro, sem React Native, para rodar com `node --test`.
 */

export const STAFF_SCHEME = "vezstaff";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Rotas sem parâmetro que um link pode abrir, com os apelidos aceitos. */
const STATIC: Record<string, string> = {
  "": "/",
  hoje: "/",
  agenda: "/agenda",
  fila: "/fila",
  loja: "/loja",
  mais: "/mais",
  entrar: "/entrar",
  recuperar: "/recuperar",
  "nova-senha": "/nova-senha",
  "novo-agendamento": "/novo-agendamento",
  bloquear: "/bloquear",
  "fila-config": "/fila-config",
  servicos: "/servicos",
  profissionais: "/profissionais",
  equipe: "/profissionais",
  horarios: "/horarios",
  regras: "/regras",
  "perfil-publico": "/perfil-publico",
  perfil: "/perfil-publico",
  avaliacoes: "/avaliacoes",
  financeiro: "/financeiro",
  assinatura: "/assinatura",
  plano: "/assinatura",
  ajustes: "/ajustes",
  comecar: "/comecar",
  suporte: "/suporte",
};

/** Rotas com id, e os nomes pelos quais elas chegam de fora. */
const WITH_ID: Record<string, string> = {
  agendamento: "/agendamento",
  reserva: "/agendamento",
  chamado: "/chamado",
  servico: "/servico",
};

/** Só estes parâmetros passam adiante; o resto do link é descartado. */
const KEPT_PARAMS = ["email"];

function splitUrl(raw: string): { segments: string[]; search: URLSearchParams } {
  const text = raw.trim();
  let path = text;
  let query = "";

  const scheme = /^([a-z][a-z0-9+.-]*):\/\/(.*)$/i.exec(text);
  if (scheme) {
    const protocol = scheme[1]!.toLowerCase();
    const rest = scheme[2]!;
    // `https://host/caminho`: o host é domínio. `vezstaff://agendamento/1`: o
    // "host" já é o primeiro pedaço da rota. Expo Go manda `exp://ip:porta/--/rota`.
    path =
      protocol === "http" || protocol === "https" || protocol === "exp"
        ? rest.slice(rest.indexOf("/") === -1 ? rest.length : rest.indexOf("/"))
        : rest;
  }

  const hash = path.indexOf("#");
  if (hash !== -1) path = path.slice(0, hash);
  const question = path.indexOf("?");
  if (question !== -1) {
    query = path.slice(question + 1);
    path = path.slice(0, question);
  }

  const segments = path
    .split("/")
    .map((part) => {
      try {
        return decodeURIComponent(part);
      } catch {
        return part;
      }
    })
    .filter((part) => part !== "" && part !== "--");
  return { segments, search: new URLSearchParams(query) };
}

function withParams(route: string, search: URLSearchParams): string {
  const kept = new URLSearchParams();
  for (const name of KEPT_PARAMS) {
    const value = search.get(name);
    if (value) kept.set(name, value);
  }
  const query = kept.toString();
  return query ? `${route}?${query}` : route;
}

export function resolveIncomingPath(raw: string): string {
  const { segments, search } = splitUrl(raw);
  // Grupos do Expo Router, como `(tabs)`, não fazem parte do endereço público.
  const parts = segments.filter((part) => !/^\(.*\)$/.test(part)).map((part) => part.toLowerCase());

  if (parts.length === 0) return "/";

  const [head, id, ...extra] = parts;
  if (head && head in WITH_ID) {
    const original = segments.filter((part) => !/^\(.*\)$/.test(part))[1];
    return id && extra.length === 0 && original && UUID.test(original)
      ? `${WITH_ID[head]}/${original.toLowerCase()}`
      : "/";
  }

  if (parts.length === 1 && head !== undefined && head in STATIC) {
    return withParams(STATIC[head]!, search);
  }

  return "/";
}
