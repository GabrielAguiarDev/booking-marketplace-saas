/**
 * Validação de formulário do lado do cliente.
 *
 * Ela existe para dar resposta imediata, não para garantir nada: quem garante é
 * o Supabase (e `minimum_password_length` no `config.toml`). Se as duas regras
 * divergirem, a do servidor vence e o usuário vê o erro traduzido em
 * `authErrorMessage`.
 */

/** Espelha `auth.minimum_password_length` em `supabase/config.toml`. */
export const MIN_PASSWORD_LENGTH = 8;

/**
 * Deliberadamente frouxo. Validar e-mail por regex estrita rejeita endereços
 * válidos e não aceita nenhum inválido a mais que importe — quem decide se o
 * e-mail existe é a caixa de entrada, que precisa receber o código.
 */
export function isEmail(value: string): boolean {
  const trimmed = value.trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
}

export function emailError(value: string): string | null {
  if (!value.trim()) return "Informe seu e-mail.";
  if (!isEmail(value)) return "E-mail inválido.";
  return null;
}

export function passwordError(value: string): string | null {
  if (!value) return "Informe sua senha.";
  if (value.length < MIN_PASSWORD_LENGTH) {
    return `Use ao menos ${MIN_PASSWORD_LENGTH} caracteres.`;
  }
  return null;
}

export function nameError(value: string): string | null {
  if (!value.trim()) return "Informe seu nome.";
  if (value.trim().length < 2) return "Nome muito curto.";
  return null;
}

/** Normaliza antes de enviar: e-mail com espaço ou maiúscula vira conta duplicada. */
export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}
