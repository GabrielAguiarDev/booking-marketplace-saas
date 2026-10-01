/**
 * As regras do assistente que não dependem de tela nem de rede.
 *
 * Módulo puro (sem React Native) para rodar nos testes com `node --test`. O
 * que mora aqui é o que a tela precisa decidir sem perguntar a ninguém: que
 * tipo de falha foi, o que dizer da cota, e como ler os cartões que voltam do
 * banco — que são `jsonb`, ou seja, não têm tipo nenhum até alguém conferir.
 */

export type CategoryKey =
  | "barbershop"
  | "salon"
  | "nail_salon"
  | "aesthetic_clinic"
  | "dermatology"
  | "dentistry"
  | "petshop"
  | "massage";

const CATEGORIES: readonly string[] = [
  "barbershop",
  "salon",
  "nail_salon",
  "aesthetic_clinic",
  "dermatology",
  "dentistry",
  "petshop",
  "massage",
];

/** Cartões que a resposta pode trazer — o app desenha nativo, não em texto. */
export type EstablishmentCard = {
  kind: "establishment";
  id: string;
  name: string;
  category: CategoryKey;
  neighborhood: string | null;
  rating_avg: number | null;
  rating_count: number;
  booking_mode: "scheduled" | "queue" | "both";
};

export type SlotCard = {
  kind: "slot";
  establishment_id: string;
  service_id: string;
  professional_id: string;
  slot_start: string;
  /** Opcionais: a função pode ou não mandar. A tela funciona sem os dois. */
  establishment_name?: string;
  service_name?: string;
};

export type Card = EstablishmentCard | SlotCard;

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value : null;
}

/**
 * Lê os cartões de uma resposta, vindos da função ou do histórico no banco.
 *
 * Descarta o que não reconhece em vez de falhar: um cartão de um tipo que
 * este app ainda não conhece não pode derrubar a conversa inteira, e um
 * cartão pela metade (sem loja, sem horário) não tem para onde levar.
 */
export function parseCards(raw: unknown): Card[] {
  if (!Array.isArray(raw)) return [];

  const cards: Card[] = [];
  for (const item of raw) {
    if (typeof item !== "object" || item === null) continue;
    const row = item as Record<string, unknown>;

    if (row.kind === "establishment") {
      const id = text(row.id);
      const name = text(row.name);
      const category = text(row.category);
      if (!id || !name || !category || !CATEGORIES.includes(category)) continue;

      const mode = row.booking_mode;
      cards.push({
        kind: "establishment",
        id,
        name,
        category: category as CategoryKey,
        neighborhood: text(row.neighborhood),
        rating_avg: typeof row.rating_avg === "number" ? row.rating_avg : null,
        rating_count: typeof row.rating_count === "number" ? row.rating_count : 0,
        booking_mode: mode === "queue" || mode === "both" ? mode : "scheduled",
      });
      continue;
    }

    if (row.kind === "slot") {
      const establishmentId = text(row.establishment_id);
      const serviceId = text(row.service_id);
      const professionalId = text(row.professional_id);
      const slotStart = text(row.slot_start);
      if (!establishmentId || !serviceId || !professionalId || !slotStart) continue;
      if (Number.isNaN(new Date(slotStart).getTime())) continue;

      const card: SlotCard = {
        kind: "slot",
        establishment_id: establishmentId,
        service_id: serviceId,
        professional_id: professionalId,
        slot_start: slotStart,
      };
      const establishmentName = text(row.establishment_name);
      const serviceName = text(row.service_name);
      if (establishmentName) card.establishment_name = establishmentName;
      if (serviceName) card.service_name = serviceName;
      cards.push(card);
    }
  }
  return cards;
}

export type SlotGroup = {
  /** Estável entre renders: loja + serviço. */
  key: string;
  establishmentId: string;
  serviceId: string;
  establishmentName: string | null;
  serviceName: string | null;
  slots: SlotCard[];
};

/**
 * Junta os horários por loja e serviço, na ordem em que apareceram.
 *
 * Uma resposta pode consultar duas lojas. Sem agrupar, "16:00" de uma e
 * "16:00" da outra viram dois botões iguais lado a lado, e a pessoa só
 * descobre qual tocou na tela de confirmação.
 *
 * `names` são os nomes de loja que a conversa já mostrou (id → nome): o cartão
 * de horário não é obrigado a trazer o nome, mas quase sempre a loja apareceu
 * num cartão antes.
 */
export function groupSlots(
  cards: readonly Card[],
  names: ReadonlyMap<string, string> = new Map(),
): SlotGroup[] {
  const groups = new Map<string, SlotGroup>();

  for (const card of cards) {
    if (card.kind !== "slot") continue;

    const key = `${card.establishment_id}:${card.service_id}`;
    let group = groups.get(key);
    if (!group) {
      group = {
        key,
        establishmentId: card.establishment_id,
        serviceId: card.service_id,
        establishmentName: card.establishment_name ?? names.get(card.establishment_id) ?? null,
        serviceName: card.service_name ?? null,
        slots: [],
      };
      groups.set(key, group);
    }

    const instant = new Date(card.slot_start).getTime();
    // O mesmo instante duas vezes é a mesma oferta, escreva o fuso como for.
    if (group.slots.some((slot) => new Date(slot.slot_start).getTime() === instant)) continue;
    group.slots.push(card);
  }

  for (const group of groups.values()) {
    group.slots.sort((a, b) => new Date(a.slot_start).getTime() - new Date(b.slot_start).getTime());
  }
  return [...groups.values()];
}

/** id → nome de todas as lojas que apareceram em cartão na conversa. */
export function establishmentNames(messages: readonly { cards: readonly Card[] }[]) {
  const names = new Map<string, string>();
  for (const message of messages) {
    for (const card of message.cards) {
      if (card.kind === "establishment") names.set(card.id, card.name);
    }
  }
  return names;
}

export type FailureKind =
  "offline" | "quota" | "not_configured" | "out_of_credit" | "unavailable" | "session" | "invalid";

export type Failure = {
  kind: FailureKind;
  title: string;
  message: string;
  /** Mandar a mesma pergunta de novo tem chance de funcionar. */
  retryable: boolean;
};

/**
 * Traduz o código de erro da função em o que dizer e o que oferecer.
 *
 * Seis falhas, e só duas se resolvem tentando de novo. Oferecer "tentar de
 * novo" nas outras quatro é mandar a pessoa bater na mesma porta fechada: a
 * cota não volta antes do dia virar, e conta sem crédito não passa por
 * insistência.
 *
 * `connected === false` vence o código: sem rede a resposta nem chegou, e o
 * código que a tela tem é o genérico.
 */
export function assistantFailure(code: string | null, connected: boolean | null): Failure {
  if (connected === false || code === "network") {
    return {
      kind: "offline",
      title: "Sem conexão",
      message:
        connected === false
          ? "Você está sem internet. Sua pergunta não foi enviada."
          : "Não deu para falar com o assistente. Confira sua conexão.",
      retryable: true,
    };
  }

  switch (code) {
    case "daily_limit_reached":
      return {
        kind: "quota",
        title: "Limite de hoje atingido",
        message:
          "Você usou todas as perguntas de hoje. Sua pergunta não foi enviada e a cota é renovada a cada dia.",
        retryable: false,
      };
    case "assistant_not_configured":
      return {
        kind: "not_configured",
        title: "Assistente fora do ar",
        message:
          "O assistente ainda não está ligado neste ambiente. Você pode buscar lojas e horários pela aba Explorar.",
        retryable: false,
      };
    case "assistant_out_of_credit":
      return {
        kind: "out_of_credit",
        title: "Assistente fora do ar",
        message:
          "O assistente está fora do ar e não volta sozinho: nossa equipe precisa resolver. Enquanto isso, a aba Explorar mostra as lojas e os horários.",
        retryable: false,
      };
    case "unauthorized":
      return {
        kind: "session",
        title: "Sessão encerrada",
        message: "Sua sessão expirou. Entre de novo para continuar a conversa.",
        retryable: false,
      };
    case "empty_message":
    case "message_too_long":
    case "invalid_body":
      return {
        kind: "invalid",
        title: "Pergunta não enviada",
        message:
          code === "message_too_long"
            ? "A pergunta ficou longa demais. Encurte e envie de novo."
            : "Escreva sua pergunta e envie de novo.",
        retryable: false,
      };
    default:
      return {
        kind: "unavailable",
        title: "Assistente indisponível",
        message:
          "O assistente não respondeu agora. Sua pergunta não foi enviada nem descontada da cota.",
        retryable: true,
      };
  }
}

export type QuotaView = {
  label: string;
  tone: "normal" | "low" | "empty";
  /** Zero perguntas: o campo de texto sai e dá lugar a um aviso. */
  blocked: boolean;
};

/**
 * O que mostrar sobre a cota do dia.
 *
 * Nulo enquanto o número não é conhecido: melhor não dizer nada do que
 * mostrar "0 perguntas" a quem ainda tem vinte (R7).
 */
export function quotaView(remaining: number | null, limit: number | null): QuotaView | null {
  if (remaining === null || !Number.isFinite(remaining)) return null;

  const left = Math.max(0, Math.floor(remaining));
  const total = limit !== null && Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : null;

  if (left === 0) {
    return { label: "SEM PERGUNTAS HOJE", tone: "empty", blocked: true };
  }

  const noun = left === 1 ? "PERGUNTA" : "PERGUNTAS";
  const verb = left === 1 ? "RESTA" : "RESTAM";
  return {
    label: total ? `${verb} ${left} DE ${total} HOJE` : `${verb} ${left} ${noun} HOJE`,
    tone: left <= 3 ? "low" : "normal",
    blocked: false,
  };
}

/** "HOJE · 14:20", "ONTEM · 09:05", "12/09" — a data de uma conversa na lista. */
export function conversationWhen(iso: string, now: Date = new Date()): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";

  const two = (value: number) => String(value).padStart(2, "0");
  const time = `${two(date.getHours())}:${two(date.getMinutes())}`;

  const startOf = (value: Date) =>
    new Date(value.getFullYear(), value.getMonth(), value.getDate()).getTime();
  const days = Math.round((startOf(now) - startOf(date)) / 86_400_000);

  if (days === 0) return `HOJE · ${time}`;
  if (days === 1) return `ONTEM · ${time}`;
  const dayMonth = `${two(date.getDate())}/${two(date.getMonth() + 1)}`;
  return date.getFullYear() === now.getFullYear() ? dayMonth : `${dayMonth}/${date.getFullYear()}`;
}

/** Título de uma conversa na lista; a primeira pergunta, ou um nome neutro. */
export function conversationTitle(title: string | null): string {
  const clean = (title ?? "").replace(/\s+/g, " ").trim();
  return clean === "" ? "Conversa sem título" : clean;
}
