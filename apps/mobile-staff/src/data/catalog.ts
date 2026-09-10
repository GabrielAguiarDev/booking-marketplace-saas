import { useAsync } from "@vez/mobile-kit/async";

import { supabase } from "../../lib/supabase";

export type Service = {
  id: string;
  name: string;
  description: string | null;
  durationMinutes: number;
  priceCents: number;
  isActive: boolean;
  sortOrder: number;
  professionalIds: string[];
};

export type Professional = {
  id: string;
  displayName: string;
  title: string | null;
  isActive: boolean;
  userId: string | null;
  sortOrder: number;
  serviceIds: string[];
};

/** Serviços da loja, com quem executa cada um. */
export function useServices(establishmentId: string | null, includeInactive = true) {
  return useAsync(
    `services:${establishmentId}:${includeInactive}`,
    async () => {
      const [services, links] = await Promise.all([
        supabase
          .from("services")
          .select("id, name, description, duration_minutes, price_cents, is_active, sort_order")
          .eq("establishment_id", establishmentId!)
          .order("sort_order"),
        supabase
          .from("professional_services")
          .select("professional_id, service_id, professionals!inner(establishment_id)")
          .eq("professionals.establishment_id", establishmentId!),
      ]);

      if (services.error) throw new Error(services.error.message);
      if (links.error) throw new Error(links.error.message);

      const byService = new Map<string, string[]>();
      for (const link of (links.data ?? []) as { professional_id: string; service_id: string }[]) {
        const list = byService.get(link.service_id) ?? [];
        list.push(link.professional_id);
        byService.set(link.service_id, list);
      }

      return (services.data ?? [])
        .filter((row) => includeInactive || row.is_active)
        .map<Service>((row) => ({
          id: row.id,
          name: row.name,
          description: row.description,
          durationMinutes: row.duration_minutes,
          priceCents: row.price_cents,
          isActive: row.is_active,
          sortOrder: row.sort_order,
          professionalIds: byService.get(row.id) ?? [],
        }));
    },
    { enabled: Boolean(establishmentId) },
  );
}

/** Quem atende, com os serviços que cada um faz. */
export function useProfessionals(establishmentId: string | null) {
  return useAsync(
    `professionals:${establishmentId}`,
    async () => {
      const [professionals, links] = await Promise.all([
        supabase
          .from("professionals")
          .select("id, display_name, title, is_active, user_id, sort_order")
          .eq("establishment_id", establishmentId!)
          .order("sort_order"),
        supabase
          .from("professional_services")
          .select("professional_id, service_id, professionals!inner(establishment_id)")
          .eq("professionals.establishment_id", establishmentId!),
      ]);

      if (professionals.error) throw new Error(professionals.error.message);
      if (links.error) throw new Error(links.error.message);

      const byProfessional = new Map<string, string[]>();
      for (const link of (links.data ?? []) as { professional_id: string; service_id: string }[]) {
        const list = byProfessional.get(link.professional_id) ?? [];
        list.push(link.service_id);
        byProfessional.set(link.professional_id, list);
      }

      return (professionals.data ?? []).map<Professional>((row) => ({
        id: row.id,
        displayName: row.display_name,
        title: row.title,
        isActive: row.is_active,
        userId: row.user_id,
        sortOrder: row.sort_order,
        serviceIds: byProfessional.get(row.id) ?? [],
      }));
    },
    { enabled: Boolean(establishmentId) },
  );
}

/**
 * Quem tem login e com qual papel.
 *
 * Separado de `professionals` porque as duas coisas não coincidem: existe
 * recepcionista com acesso e sem cadeira, e existe barbeiro que aparece na
 * vitrine e nunca abriu o app.
 */
export function useTeam(establishmentId: string | null) {
  return useAsync(
    `team:${establishmentId}`,
    async () => {
      const { data, error } = await supabase
        .from("establishment_members")
        .select("user_id, role, profiles(full_name)")
        .eq("establishment_id", establishmentId!);
      if (error) throw new Error(error.message);
      return (
        (data ?? []) as unknown as {
          user_id: string;
          role: string;
          profiles: { full_name: string | null } | null;
        }[]
      ).map((row) => ({
        userId: row.user_id,
        role: row.role as "owner" | "manager" | "staff",
        name: row.profiles?.full_name ?? "Sem nome",
      }));
    },
    { enabled: Boolean(establishmentId) },
  );
}

type Result = { ok: boolean; message?: string };

export async function saveService(input: {
  id: string | null;
  establishmentId: string;
  name: string;
  description: string | null;
  durationMinutes: number;
  priceCents: number;
  isActive: boolean;
  professionalIds: string[];
}): Promise<Result> {
  const payload = {
    establishment_id: input.establishmentId,
    name: input.name,
    description: input.description,
    duration_minutes: input.durationMinutes,
    price_cents: input.priceCents,
    is_active: input.isActive,
  };

  const saved = input.id
    ? await supabase.from("services").update(payload).eq("id", input.id).select("id").single()
    : await supabase.from("services").insert(payload).select("id").single();

  if (saved.error || !saved.data) {
    return { ok: false, message: "Não foi possível salvar o serviço." };
  }

  const serviceId = saved.data.id;

  // Quem faz o quê é reescrito por inteiro: a alternativa seria comparar dois
  // conjuntos no cliente e emitir os deltas, o que erra silenciosamente quando
  // duas pessoas editam a mesma lista.
  const cleared = await supabase.from("professional_services").delete().eq("service_id", serviceId);
  if (cleared.error) return { ok: false, message: "Não foi possível salvar quem executa." };

  if (input.professionalIds.length > 0) {
    const linked = await supabase.from("professional_services").insert(
      input.professionalIds.map((professionalId) => ({
        professional_id: professionalId,
        service_id: serviceId,
      })),
    );
    if (linked.error) return { ok: false, message: "Não foi possível salvar quem executa." };
  }

  return { ok: true };
}

/**
 * Serviço sai de circulação desativado, nunca apagado.
 *
 * `appointments.service_id` é `on delete restrict` justamente por isso: apagar
 * o serviço apagaria o que ele quer dizer nas reservas já feitas — e a agenda
 * de ontem passaria a mostrar "serviço removido" no lugar do corte que a
 * pessoa realmente fez.
 */
export async function setServiceActive(id: string, isActive: boolean): Promise<Result> {
  const { error } = await supabase.from("services").update({ is_active: isActive }).eq("id", id);
  return error ? { ok: false, message: "Não foi possível mudar o serviço." } : { ok: true };
}

export async function setProfessionalActive(id: string, isActive: boolean): Promise<Result> {
  const { error } = await supabase
    .from("professionals")
    .update({ is_active: isActive })
    .eq("id", id);
  return error ? { ok: false, message: "Não foi possível mudar o profissional." } : { ok: true };
}
