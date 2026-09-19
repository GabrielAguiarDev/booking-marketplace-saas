/**
 * Regras puras dos avisos no aparelho, sem React Native, para rodar com
 * `node --test`.
 *
 * O contrato do banco está em `docs/notificacoes.md`: o app grava o token Expo
 * com `register_push_device`, desliga com `unregister_push_device` ao sair da
 * conta e lê os próprios avisos em `notification_outbox`.
 */

export type PushApp = "cliente" | "staff";
export type PushPlatform = "ios" | "android" | "web";

/**
 * Situação do aviso neste aparelho, do jeito que a tela precisa explicar.
 *
 * `unconfigured` é configuração de fora do app (o build não tem o projectId do
 * EAS): a pessoa não resolve, e a tela não pode oferecer um botão que não
 * funciona. `unsupported` é aparelho que não recebe push (web, simulador).
 */
export type PushState =
  | { kind: "checking" }
  | { kind: "unsupported"; reason: "web" | "simulator" }
  | { kind: "unconfigured" }
  | { kind: "off"; canAsk: boolean }
  | { kind: "registering" }
  | { kind: "on" }
  | { kind: "error"; message: string };

const TOKEN = /^(ExponentPushToken|ExpoPushToken)\[[A-Za-z0-9_-]+\]$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** O mesmo formato que a restrição `push_devices_token_format` aceita. */
export function isExpoPushToken(token: unknown): token is string {
  return typeof token === "string" && TOKEN.test(token.trim());
}

/** A plataforma no formato de `push_devices.platform`; nulo para o resto. */
export function pushPlatform(os: string): PushPlatform | null {
  return os === "ios" || os === "android" || os === "web" ? os : null;
}

/** O primeiro projectId do EAS válido entre os lugares onde ele pode estar. */
export function resolveProjectId(...candidates: unknown[]): string | null {
  for (const candidate of candidates) {
    if (typeof candidate === "string" && UUID.test(candidate.trim())) return candidate.trim();
  }
  return null;
}

/**
 * Antes de pedir permissão: o que impede o push de existir aqui, se algo.
 * A ordem importa — web e simulador não têm o que configurar.
 */
export function pushBlocker(input: {
  os: string;
  isDevice: boolean;
  projectId: string | null;
}): PushState | null {
  if (input.os === "web") return { kind: "unsupported", reason: "web" };
  if (!input.isDevice) return { kind: "unsupported", reason: "simulator" };
  if (!input.projectId) return { kind: "unconfigured" };
  return null;
}

/** Permissão do sistema → situação, quando nada bloqueia. */
export function permissionState(status: string, canAskAgain: boolean): PushState {
  if (status === "granted") return { kind: "on" };
  return { kind: "off", canAsk: status === "undetermined" || canAskAgain };
}

export type PushAction = "ask" | "settings" | "retry" | null;

/** O texto e o botão de cada situação. Nenhum promete o que não acontece. */
export function pushStateCopy(state: PushState): {
  title: string;
  text: string;
  action: PushAction;
  tone: "ok" | "warn" | "muted";
} {
  switch (state.kind) {
    case "checking":
    case "registering":
      return { title: "Conferindo este aparelho…", text: "", action: null, tone: "muted" };
    case "on":
      return {
        title: "Avisos ligados neste aparelho",
        text: "O que estiver ligado nas preferências chega como notificação.",
        action: null,
        tone: "ok",
      };
    case "off":
      return state.canAsk
        ? {
            title: "Avisos desligados neste aparelho",
            text: "Permita as notificações para receber os avisos aqui.",
            action: "ask",
            tone: "warn",
          }
        : {
            title: "Notificações bloqueadas",
            text: "O sistema bloqueou as notificações do app. Libere nos ajustes do aparelho.",
            action: "settings",
            tone: "warn",
          };
    case "unsupported":
      return {
        title: "Este aparelho não recebe avisos",
        text:
          state.reason === "web"
            ? "Notificações só chegam no app instalado no celular."
            : "Simuladores não recebem notificações. Use um celular de verdade.",
        action: null,
        tone: "muted",
      };
    case "unconfigured":
      return {
        title: "Avisos ainda não disponíveis",
        text: "Esta versão do app foi gerada sem o envio de notificações configurado. Os avisos voltam numa próxima versão.",
        action: null,
        tone: "muted",
      };
    case "error":
      return {
        title: "Não foi possível ligar os avisos",
        text: state.message,
        action: "retry",
        tone: "warn",
      };
  }
}

// ── entrega ──────────────────────────────────────────────────────────────

export type DeliveryStatus = "pending" | "sending" | "sent" | "failed" | "unconfigured" | "skipped";
export type DeliveryChannel = "push" | "email" | "sms" | "whatsapp";

export type DeliveryRow = {
  id: string;
  channel: DeliveryChannel;
  status: DeliveryStatus;
  title: string;
  created_at: string;
  sent_at: string | null;
};

/** O status da caixa de saída, dito para quem recebe. */
export function deliveryLabel(status: DeliveryStatus): {
  label: string;
  tone: "ok" | "wait" | "warn" | "muted";
} {
  switch (status) {
    case "sent":
      return { label: "Entregue", tone: "ok" };
    case "pending":
    case "sending":
      return { label: "Na fila de envio", tone: "wait" };
    case "unconfigured":
      return { label: "Aguardando o envio ser ligado", tone: "warn" };
    case "failed":
      return { label: "Não entregue", tone: "warn" };
    case "skipped":
      return { label: "Sem aparelho para receber", tone: "muted" };
  }
}

export const CHANNEL_LABEL: Record<DeliveryChannel, string> = {
  push: "Notificação",
  email: "E-mail",
  sms: "SMS",
  whatsapp: "WhatsApp",
};

/**
 * Um resumo honesto dos últimos avisos: se o envio está parado por
 * configuração da plataforma, isso aparece antes da lista.
 */
export function deliveryNotice(rows: DeliveryRow[]): string | null {
  if (rows.some((row) => row.status === "unconfigured")) {
    return "Parte dos avisos está parada porque o envio ainda não foi ligado pela plataforma. Eles saem sozinhos quando for.";
  }
  if (rows.length > 0 && rows.every((row) => row.status === "skipped")) {
    return "Os últimos avisos não tinham um aparelho para chegar. Ligue os avisos neste aparelho.";
  }
  return null;
}

// ── toque na notificação ─────────────────────────────────────────────────

function str(value: unknown): string | null {
  return typeof value === "string" && UUID.test(value) ? value : null;
}

/**
 * Para onde vai o toque numa notificação, pelo `data` que o banco grava
 * (`type` e os ids do evento). Nulo quando o aviso não tem tela própria: o app
 * só abre.
 */
export function pushRoute(app: PushApp, data: unknown): string | null {
  if (!data || typeof data !== "object") return null;
  const d = data as Record<string, unknown>;
  const appointment = str(d.appointment_id);
  const ticket = str(d.ticket_id);
  const establishment = str(d.establishment_id);

  if (app === "cliente") {
    switch (d.type) {
      case "appointment":
        return appointment ? `/reserva/${appointment}` : "/agenda";
      case "review_request":
        return appointment ? `/avaliacao?appointmentId=${appointment}` : null;
      case "queue":
        return establishment ? `/fila?id=${establishment}` : "/fila";
      case "support_ticket":
        return ticket ? `/ajuda/${ticket}` : "/ajuda";
      default:
        return null;
    }
  }

  switch (d.type) {
    case "appointment":
      return appointment ? `/agendamento/${appointment}` : "/agenda";
    case "queue":
      return "/fila";
    case "support_ticket":
      return ticket ? `/chamado/${ticket}` : "/suporte";
    case "review_report":
      return "/avaliacoes";
    case "daily_summary":
    case "team_added":
      return "/";
    default:
      return null;
  }
}
