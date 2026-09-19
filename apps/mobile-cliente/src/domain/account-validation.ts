/**
 * Validação dos formulários de conta (dados pessoais e endereço).
 *
 * O banco tem as mesmas regras como `check`; repetir aqui é só para a mensagem
 * aparecer embaixo do campo certo antes de uma ida ao servidor. Se as duas
 * divergirem, quem vence é o banco — o app mostra o erro dele.
 *
 * Módulo puro (sem React Native) para rodar nos testes com `node --test`.
 */

export type FieldErrors<K extends string> = Partial<Record<K, string>>;

/** Só dígitos. */
export function digits(value: string): string {
  return value.replace(/\D+/g, "");
}

/**
 * Telefone brasileiro normalizado para E.164 (`+55DDNNNNNNNNN`), ou `null`
 * quando não dá para ser um número válido. Aceita com ou sem `+55`/`0`.
 */
export function normalizePhone(value: string): string | null {
  let d = digits(value);
  if (d.startsWith("55") && (d.length === 12 || d.length === 13)) d = d.slice(2);
  if (d.startsWith("0")) d = d.slice(1);
  if (d.length !== 10 && d.length !== 11) return null;
  // DDD brasileiro vai de 11 a 99, sem zero no segundo dígito.
  const ddd = Number(d.slice(0, 2));
  if (ddd < 11 || d[1] === "0") return null;
  // Celular tem 9 dígitos começando por 9.
  if (d.length === 11 && d[2] !== "9") return null;
  // Fixo tem 8 dígitos começando de 2 a 5.
  if (d.length === 10 && !"2345".includes(d[2]!)) return null;
  return `+55${d}`;
}

/** "+5511987654321" → "(11) 98765-4321". Devolve o valor original se não reconhecer. */
export function formatPhone(value: string | null): string {
  if (!value) return "";
  const d = digits(value).replace(/^55(?=\d{10,11}$)/, "");
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return value;
}

export type PersonalInput = { fullName: string; phone: string };
export type PersonalValue = { fullName: string; phone: string | null };

export function validatePersonal(
  input: PersonalInput,
): { ok: true; value: PersonalValue } | { ok: false; errors: FieldErrors<keyof PersonalInput> } {
  const errors: FieldErrors<keyof PersonalInput> = {};
  const fullName = input.fullName.trim().replace(/\s+/g, " ");

  if (fullName.length < 2) errors.fullName = "Informe seu nome.";
  else if (fullName.length > 80) errors.fullName = "Use até 80 caracteres.";

  let phone: string | null = null;
  if (input.phone.trim()) {
    phone = normalizePhone(input.phone);
    if (!phone) errors.phone = "Telefone inválido. Use DDD + número.";
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, value: { fullName, phone } };
}

export type AddressInput = {
  label: string;
  postalCode: string;
  street: string;
  number: string;
  complement: string;
  neighborhood: string;
};

export type AddressValue = {
  label: string;
  postal_code: string | null;
  street: string;
  number: string | null;
  complement: string | null;
  neighborhood: string | null;
};

const clean = (value: string) => value.trim().replace(/\s+/g, " ");
const orNull = (value: string) => (clean(value) ? clean(value) : null);

export function validateAddress(
  input: AddressInput,
): { ok: true; value: AddressValue } | { ok: false; errors: FieldErrors<keyof AddressInput> } {
  const errors: FieldErrors<keyof AddressInput> = {};

  const label = clean(input.label);
  if (!label) errors.label = "Dê um nome, como Casa ou Trabalho.";
  else if (label.length > 40) errors.label = "Use até 40 caracteres.";

  const street = clean(input.street);
  if (street.length < 2) errors.street = "Informe a rua.";
  else if (street.length > 120) errors.street = "Use até 120 caracteres.";

  const postal = digits(input.postalCode);
  if (postal && postal.length !== 8) errors.postalCode = "CEP tem 8 dígitos.";

  if (clean(input.number).length > 20) errors.number = "Use até 20 caracteres.";
  if (clean(input.complement).length > 80) errors.complement = "Use até 80 caracteres.";
  if (clean(input.neighborhood).length > 80) errors.neighborhood = "Use até 80 caracteres.";

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return {
    ok: true,
    value: {
      label,
      postal_code: postal || null,
      street,
      number: orNull(input.number),
      complement: orNull(input.complement),
      neighborhood: orNull(input.neighborhood),
    },
  };
}

/** "01310100" → "01310-100". */
export function formatPostalCode(value: string | null): string {
  const d = digits(value ?? "");
  return d.length === 8 ? `${d.slice(0, 5)}-${d.slice(5)}` : (value ?? "");
}

/** Uma linha para o geocoder do aparelho. Sem cidade: o CEP já localiza. */
export function geocodeQuery(value: AddressValue): string {
  return [
    [value.street, value.number].filter(Boolean).join(", "),
    value.neighborhood,
    value.postal_code ? formatPostalCode(value.postal_code) : null,
    "Brasil",
  ]
    .filter(Boolean)
    .join(" - ");
}
