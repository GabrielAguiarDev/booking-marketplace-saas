"use client";

/**
 * A camada de dados do admin.
 *
 * As telas leem `data` e chamam `actions` — nunca tocam a origem do dado. Toda
 * ação entra no registro de auditoria: quem fez, o quê e quando. Na versão
 * ligada ao banco, é o próprio banco que grava essa linha, dentro da mesma
 * transação da ação; aqui a camada local imita isso.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { useRouter } from "next/navigation";

import type {
  AdminData,
  AuditEntry,
  CatalogItem,
  Decision,
  DecisionKind,
  PlanDef,
  PlanKind,
} from "./model";
import { brl, planText } from "./model";
import { createSupabaseActions } from "./supabase-actions";

export type Toast = { title: string; sub: string; tone?: "ok" | "error" };

/** O plano ativo daquele tipo — o que uma troca ou aprovação passa a usar. */
function planIdOf(data: AdminData, kind: PlanKind): string | null {
  return data.plans.find((p) => p.kind === kind && p.active)?.id ?? null;
}

export type AdminActions = {
  approveApplication: (id: string, plan: PlanKind, message: string) => Promise<void>;
  rejectApplication: (id: string, message: string) => Promise<void>;
  requestCorrection: (id: string, message: string) => Promise<void>;
  suspendEstablishments: (ids: string[], reason: string) => Promise<void>;
  reactivateEstablishment: (id: string) => Promise<void>;
  changePlan: (ids: string[], plan: PlanKind) => Promise<void>;
  applyDiscount: (ids: string[], percent: number, months: number) => Promise<void>;
  registerContact: (establishmentId: string, note: string) => Promise<void>;
  startAccessSession: (establishmentId: string, reason: string, minutes: number) => Promise<void>;
  openCity: (input: {
    name: string;
    uf: string;
    quota: number;
    priceCents: number;
  }) => Promise<void>;
  setCityStatus: (id: string, status: "active" | "pre_launch" | "evaluating") => Promise<void>;
  saveQuotas: (totals: Record<string, number>) => Promise<void>;
  updatePlan: (
    id: string,
    patch: Partial<Omit<PlanDef, "id" | "kind">>,
    cityPrices?: Record<string, number>,
  ) => Promise<void>;
  resendInvoice: (id: string) => Promise<void>;
  saveCatalogItem: (
    id: string,
    patch: Pick<CatalogItem, "name" | "durationMinutes" | "synonyms">,
  ) => Promise<void>;
  createCatalogItem: (group: string, name: string) => Promise<string>;
  resolveSuggestion: (
    id: string,
    resolution: "approve" | "merge" | "reject",
    targetItemId?: string,
  ) => Promise<void>;
  decideReport: (
    id: string,
    decision: "keep" | "remove",
    motive: string,
    note: string,
    notifyAuthor: boolean,
  ) => Promise<void>;
  requestClarification: (id: string, message: string) => Promise<void>;
  registerCustomerContact: (id: string, note: string) => Promise<void>;
  setCustomerBlocked: (id: string, blocked: boolean, reason: string) => Promise<void>;
  updateParam: (key: string, value: number) => Promise<void>;
};

type Store = {
  data: AdminData;
  actions: AdminActions;
  toast: Toast | null;
  notify: (toast: Toast) => void;
  dismiss: () => void;
};

const StoreContext = createContext<Store | null>(null);

export function useAdmin(): Store {
  const store = useContext(StoreContext);
  if (!store) throw new Error("useAdmin fora do AdminProvider");
  return store;
}

let sequence = 0;
const nextId = (prefix: string) =>
  `${prefix}-${Date.now().toString(36)}-${(sequence++).toString(36)}`;

/** Aplica uma mudança e grava a linha de auditoria dela, juntas. */
type Mutate = (
  change: (data: AdminData) => AdminData,
  audit?: Omit<AuditEntry, "id" | "at" | "who">,
) => void;

function localActions(get: () => AdminData, mutate: Mutate): AdminActions {
  const decide = (id: string, decision: DecisionKind, plan: PlanKind | null, message: string) => {
    const app = get().applications.find((a) => a.id === id);
    if (!app) throw new Error("Solicitação não encontrada.");
    if (decision !== "approved" && !message.trim()) {
      throw new Error("Escreva a mensagem ao solicitante antes de recusar ou pedir correção.");
    }
    if (decision === "approved" && plan === "monthly") {
      const city = get().cities.find((c) => c.id === app.cityId);
      if (city && city.quotaUsed >= city.quotaTotal) {
        throw new Error(
          `Não há vaga de mensalidade em ${city.name}. Aprove pelo plano de comissão.`,
        );
      }
    }

    const me = get().me;
    const entry: Decision = {
      id: nextId("d"),
      name: app.name,
      city: app.city,
      decision,
      plan: decision === "approved" ? plan : null,
      who: me.name,
      at: new Date().toISOString(),
    };

    mutate(
      (d) => ({
        ...d,
        applications: d.applications.filter((a) => a.id !== id),
        decisions: [entry, ...d.decisions],
        cities:
          decision === "approved" && plan === "monthly"
            ? d.cities.map((c) => (c.id === app.cityId ? { ...c, quotaUsed: c.quotaUsed + 1 } : c))
            : d.cities,
        establishments:
          decision === "approved"
            ? [
                {
                  id: app.id,
                  name: app.name,
                  cityId: app.cityId,
                  city: app.city,
                  category: app.category,
                  status: "active",
                  planId: planIdOf(d, plan ?? "commission"),
                  plan: plan ?? "commission",
                  overdue: false,
                  appointmentsMonth: 0,
                  platformRevenueCents: 0,
                  since: entry.at,
                  risk: null,
                  discountPercent: null,
                  cnpj: app.cnpj,
                  address: app.address,
                  responsible: `${app.responsible} · ${app.phone}`,
                  professionals: app.professionals,
                  usage: Array.from({ length: 12 }, () => 0),
                },
                ...d.establishments,
              ]
            : d.establishments,
      }),
      {
        action:
          decision === "approved"
            ? `Aprovou ${app.name}`
            : decision === "rejected"
              ? `Recusou ${app.name}`
              : `Pediu correção a ${app.name}`,
        meta:
          decision === "approved"
            ? `plano ${planText(plan ?? "commission", 12)} · ${app.city}`
            : `${app.city} · mensagem: ${message.trim()}`,
        accountAccess: false,
      },
    );
  };

  const names = (ids: string[]) => {
    const list = get().establishments.filter((e) => ids.includes(e.id));
    return list.length === 1 ? list[0]!.name : `${list.length} estabelecimentos`;
  };

  return {
    approveApplication: async (id, plan, message) => decide(id, "approved", plan, message),
    rejectApplication: async (id, message) => decide(id, "rejected", null, message),
    requestCorrection: async (id, message) => decide(id, "correction", null, message),

    suspendEstablishments: async (ids, reason) => {
      if (!reason.trim()) throw new Error("Informe o motivo da suspensão.");
      const label = names(ids);
      mutate(
        (d) => ({
          ...d,
          establishments: d.establishments.map((e) =>
            ids.includes(e.id) ? { ...e, status: "suspended" } : e,
          ),
        }),
        { action: `Suspendeu ${label}`, meta: `motivo: ${reason.trim()}`, accountAccess: false },
      );
    },

    reactivateEstablishment: async (id) => {
      const label = names([id]);
      mutate(
        (d) => ({
          ...d,
          establishments: d.establishments.map((e) =>
            e.id === id ? { ...e, status: "active" } : e,
          ),
        }),
        { action: `Reativou ${label}`, meta: "volta a aparecer no app", accountAccess: false },
      );
    },

    changePlan: async (ids, plan) => {
      const data = get();
      // quem passa para mensalidade ocupa vaga na cidade: sem vaga, a troca não entra
      if (plan === "monthly") {
        const incoming: Record<string, number> = {};
        for (const e of data.establishments) {
          if (ids.includes(e.id) && e.plan !== "monthly")
            incoming[e.cityId] = (incoming[e.cityId] ?? 0) + 1;
        }
        for (const [cityId, n] of Object.entries(incoming)) {
          const city = data.cities.find((c) => c.id === cityId);
          if (city && city.quotaUsed + n > city.quotaTotal) {
            throw new Error(
              `${city.name} tem ${city.quotaTotal - city.quotaUsed} vaga(s) de mensalidade e a troca pede ${n}.`,
            );
          }
        }
      }
      const label = names(ids);
      mutate(
        (d) => {
          const delta: Record<string, number> = {};
          for (const e of d.establishments) {
            if (!ids.includes(e.id) || e.plan === plan) continue;
            delta[e.cityId] = (delta[e.cityId] ?? 0) + (plan === "monthly" ? 1 : -1);
          }
          return {
            ...d,
            establishments: d.establishments.map((e) =>
              ids.includes(e.id) ? { ...e, plan, planId: planIdOf(d, plan) } : e,
            ),
            cities: d.cities.map((c) =>
              delta[c.id] ? { ...c, quotaUsed: Math.max(0, c.quotaUsed + (delta[c.id] ?? 0)) } : c,
            ),
          };
        },
        {
          action: `Trocou o plano de ${label}`,
          meta: `para ${planText(plan, 12)} · aplicado imediatamente`,
          accountAccess: false,
        },
      );
    },

    applyDiscount: async (ids, percent, months) => {
      if (!(percent > 0 && percent <= 100)) throw new Error("O desconto vai de 1% a 100%.");
      if (!(months >= 1)) throw new Error("O desconto dura ao menos um mês.");
      const label = names(ids);
      mutate(
        (d) => ({
          ...d,
          establishments: d.establishments.map((e) =>
            ids.includes(e.id) ? { ...e, discountPercent: percent } : e,
          ),
        }),
        {
          action: `Aplicou desconto a ${label}`,
          meta: `${percent}% por ${months} ${months === 1 ? "mês" : "meses"}`,
          accountAccess: false,
        },
      );
    },

    registerContact: async (id, note) => {
      if (!note.trim()) throw new Error("Escreva o que foi conversado.");
      mutate((d) => d, {
        action: `Registrou contato com ${names([id])}`,
        meta: note.trim(),
        accountAccess: false,
      });
    },

    startAccessSession: async (id, reason, minutes) => {
      if (reason.trim().length < 10)
        throw new Error("O motivo precisa explicar o acesso — ao menos 10 letras.");
      mutate((d) => d, {
        action: `Autorizou acesso de suporte a ${names([id])}`,
        meta: `janela de ${minutes} min · motivo: ${reason.trim()}`,
        accountAccess: true,
      });
    },

    openCity: async ({ name, uf, quota, priceCents }) => {
      const clean = name.trim();
      if (clean.length < 2) throw new Error("Informe o nome da cidade.");
      if (get().cities.some((c) => c.name.toLowerCase() === clean.toLowerCase() && c.uf === uf)) {
        throw new Error(`${clean}/${uf} já está cadastrada.`);
      }
      if (!(quota >= 0)) throw new Error("A cota de mensalidade não pode ser negativa.");
      if (!(priceCents > 0)) throw new Error("Informe o preço da mensalidade na cidade.");
      mutate(
        (d) => ({
          ...d,
          cities: [
            ...d.cities,
            {
              id: nextId("c"),
              name: clean,
              uf,
              status: "pre_launch",
              establishments: 0,
              customers: 0,
              appointmentsMonth: 0,
              quotaTotal: quota,
              quotaUsed: 0,
              monthlyPriceCents: priceCents,
              categories: [],
              gaps: ["Todas as categorias"],
            },
          ],
        }),
        {
          action: `Abriu ${clean}/${uf} em pré-lançamento`,
          meta: `${quota} vagas de mensalidade · ${brl(priceCents)}`,
          accountAccess: false,
        },
      );
    },

    setCityStatus: async (id, status) => {
      const city = get().cities.find((item) => item.id === id);
      if (!city) throw new Error("Cidade não encontrada.");
      mutate(
        (data) => ({
          ...data,
          cities: data.cities.map((item) => (item.id === id ? { ...item, status } : item)),
        }),
        {
          action: `Alterou ${city.name}/${city.uf} para ${status}`,
          meta: status === "active" ? "cidade publicada na busca" : "cidade fora da busca",
          accountAccess: false,
        },
      );
    },

    saveQuotas: async (totals) => {
      const data = get();
      const changes: string[] = [];
      for (const [id, total] of Object.entries(totals)) {
        const city = data.cities.find((c) => c.id === id);
        if (!city || city.quotaTotal === total) continue;
        if (!Number.isInteger(total) || total < 0)
          throw new Error(`Cota inválida em ${city.name}.`);
        if (total < city.quotaUsed) {
          throw new Error(
            `${city.name} tem ${city.quotaUsed} vagas ocupadas — a cota não pode ficar abaixo disso.`,
          );
        }
        changes.push(`${city.name}: ${city.quotaTotal} → ${total}`);
      }
      if (!changes.length) return;
      mutate(
        (d) => ({
          ...d,
          cities: d.cities.map((c) =>
            totals[c.id] !== undefined ? { ...c, quotaTotal: totals[c.id] ?? c.quotaTotal } : c,
          ),
        }),
        {
          action: "Alterou cotas de mensalidade",
          meta: changes.join(" · "),
          accountAccess: false,
        },
      );
    },

    updatePlan: async (id, patch, cityPrices) => {
      const plan = get().plans.find((p) => p.id === id);
      if (!plan) throw new Error("Plano não encontrado.");
      const parts: string[] = [];
      if (patch.commissionPercent != null && patch.commissionPercent !== plan.commissionPercent) {
        parts.push(`comissão ${plan.commissionPercent}% → ${patch.commissionPercent}%`);
      }
      if (
        patch.maxProfessionals !== undefined &&
        patch.maxProfessionals !== plan.maxProfessionals
      ) {
        parts.push(
          `profissionais ${plan.maxProfessionals ?? "sem limite"} → ${patch.maxProfessionals ?? "sem limite"}`,
        );
      }
      const cities = get().cities;
      for (const [cityId, cents] of Object.entries(cityPrices ?? {})) {
        const city = cities.find((c) => c.id === cityId);
        if (city && city.monthlyPriceCents !== cents) {
          parts.push(`${city.name} ${brl(city.monthlyPriceCents ?? 0)} → ${brl(cents)}`);
        }
      }
      mutate(
        (d) => ({
          ...d,
          plans: d.plans.map((p) => (p.id === id ? { ...p, ...patch } : p)),
          cities: cityPrices
            ? d.cities.map((c) =>
                cityPrices[c.id] !== undefined
                  ? { ...c, monthlyPriceCents: cityPrices[c.id] ?? null }
                  : c,
              )
            : d.cities,
        }),
        {
          action: `Editou o plano ${plan.name}`,
          meta: parts.length ? parts.join(" · ") : "sem mudança de valores",
          accountAccess: false,
        },
      );
    },

    resendInvoice: async (id) => {
      const invoice = get().invoices.find((i) => i.id === id);
      if (!invoice) throw new Error("Cobrança não encontrada.");
      mutate((d) => d, {
        action: `Reenviou cobrança de ${invoice.establishment}`,
        meta: `${brl(invoice.amountCents)}`,
        accountAccess: false,
      });
    },

    saveCatalogItem: async (id, patch) => {
      if (patch.name.trim().length < 2) throw new Error("O item precisa de um nome.");
      if (!(patch.durationMinutes >= 5)) throw new Error("A duração mínima é 5 minutos.");
      mutate(
        (d) => ({
          ...d,
          catalog: d.catalog.map((c) =>
            c.id === id ? { ...c, ...patch, name: patch.name.trim() } : c,
          ),
        }),
        {
          action: `Editou o item de catálogo ${patch.name.trim()}`,
          meta: `${patch.durationMinutes} min · ${patch.synonyms.length} nomes alternativos`,
          accountAccess: false,
        },
      );
    },

    createCatalogItem: async (group, name) => {
      const clean = name.trim();
      if (clean.length < 2) throw new Error("O item precisa de um nome.");
      if (get().catalog.some((c) => c.name.toLowerCase() === clean.toLowerCase())) {
        throw new Error(`${clean} já está no catálogo.`);
      }
      const id = nextId("cat");
      mutate(
        (d) => ({
          ...d,
          catalog: [
            ...d.catalog,
            {
              id,
              group,
              name: clean,
              durationMinutes: 30,
              synonyms: [],
              establishments: 0,
              searchesMonth: 0,
              appointmentsMonth: 0,
              averagePriceCents: null,
            },
          ],
        }),
        { action: `Criou o item de catálogo ${clean}`, meta: group, accountAccess: false },
      );
      return id;
    },

    resolveSuggestion: async (id, resolution, targetItemId) => {
      const s = get().suggestions.find((x) => x.id === id);
      if (!s) throw new Error("Sugestão não encontrada.");
      const target = targetItemId ? get().catalog.find((c) => c.id === targetItemId) : null;
      if (resolution === "merge" && !target) throw new Error("Escolha em qual item mesclar.");
      mutate(
        (d) => ({
          ...d,
          suggestions: d.suggestions.filter((x) => x.id !== id),
          catalog:
            resolution === "approve"
              ? [
                  ...d.catalog,
                  {
                    id: nextId("cat"),
                    group: "Sugeridos",
                    name: s.name,
                    durationMinutes: 30,
                    synonyms: [],
                    establishments: 1,
                    searchesMonth: 0,
                    appointmentsMonth: 0,
                    averagePriceCents: null,
                  },
                ]
              : resolution === "merge" && target
                ? d.catalog.map((c) =>
                    c.id === target.id
                      ? { ...c, synonyms: [...new Set([...c.synonyms, s.name.toLowerCase()])] }
                      : c,
                  )
                : d.catalog,
        }),
        {
          action:
            resolution === "approve"
              ? `Aprovou a sugestão ${s.name}`
              : resolution === "merge"
                ? `Mesclou ${s.name} em ${target?.name ?? ""}`
                : `Recusou a sugestão ${s.name}`,
          meta: `${s.establishment} · ${s.city}`,
          accountAccess: false,
        },
      );
    },

    decideReport: async (id, decision, motive, note, notifyAuthor) => {
      const r = get().reports.find((x) => x.id === id);
      if (!r) throw new Error("Denúncia não encontrada.");
      if (!motive) throw new Error("Escolha o motivo da decisão.");
      mutate(
        (d) => ({
          ...d,
          reports: d.reports.filter((x) => x.id !== id),
          panorama: d.panorama.map((p) =>
            p.establishmentId === r.establishmentId && decision === "remove" && p.total > 1
              ? {
                  ...p,
                  total: p.total - 1,
                  average: (p.average * p.total - r.rating) / (p.total - 1),
                }
              : p,
          ),
        }),
        {
          action: `${decision === "remove" ? "Removeu" : "Manteve"} avaliação denunciada por ${r.establishment}`,
          meta: [
            motive,
            note.trim(),
            decision === "remove" && notifyAuthor ? "autor marcado para aviso" : "",
          ]
            .filter(Boolean)
            .join(" · "),
          accountAccess: false,
        },
      );
    },

    requestClarification: async (id, message) => {
      if (!message.trim()) throw new Error("Escreva o que você precisa saber.");
      const r = get().reports.find((x) => x.id === id);
      if (!r) throw new Error("Denúncia não encontrada.");
      mutate(
        (d) => ({
          ...d,
          reports: d.reports.map((x) =>
            x.id === id ? { ...x, status: "awaiting_establishment" } : x,
          ),
        }),
        {
          action: `Pediu esclarecimento a ${r.establishment}`,
          meta: message.trim(),
          accountAccess: false,
        },
      );
    },

    registerCustomerContact: async (id, note) => {
      if (!note.trim()) throw new Error("Escreva o que foi conversado.");
      const c = get().customers.find((x) => x.id === id);
      mutate((d) => d, {
        action: `Registrou atendimento a ${c?.name ?? "cliente"}`,
        meta: note.trim(),
        accountAccess: false,
      });
    },

    setCustomerBlocked: async (id, blocked, reason) => {
      if (blocked && !reason.trim()) throw new Error("Informe o motivo do bloqueio.");
      const c = get().customers.find((x) => x.id === id);
      mutate(
        (d) => ({ ...d, customers: d.customers.map((x) => (x.id === id ? { ...x, blocked } : x)) }),
        {
          action: `${blocked ? "Bloqueou" : "Desbloqueou"} novos agendamentos de ${c?.name ?? "cliente"}`,
          meta: blocked ? `motivo: ${reason.trim()}` : "volta a poder agendar",
          accountAccess: false,
        },
      );
    },

    updateParam: async (key, value) => {
      const p = get().params.find((x) => x.key === key);
      if (!p) throw new Error("Parâmetro não encontrado.");
      if (!Number.isFinite(value) || value < 0) throw new Error("Use um número positivo.");
      if (p.unit === "%" && value > 100) throw new Error("Percentual vai até 100.");
      mutate(
        (d) => ({ ...d, params: d.params.map((x) => (x.key === key ? { ...x, value } : x)) }),
        {
          action: `Alterou ${p.label.toLowerCase()}`,
          meta: `${p.value} → ${value}`,
          accountAccess: false,
        },
      );
    },
  };
}

/**
 * O dado vive fora do React, num objeto que avisa quem está ouvindo. As ações
 * leem o valor mais recente com `get()` sem depender do ciclo de render — é o
 * que permite validar ("ainda há vaga?") contra o estado atual, e não contra o
 * de quando o botão foi desenhado.
 */
function createDataStore(initial: AdminData) {
  let current = initial;
  const listeners = new Set<() => void>();
  return {
    get: () => current,
    set: (next: AdminData) => {
      current = next;
      for (const listener of listeners) listener();
    },
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

export function AdminProvider({
  initial,
  remote = false,
  children,
}: {
  initial: AdminData;
  remote?: boolean;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [store] = useState(() => createDataStore(initial));
  const data = useSyncExternalStore(store.subscribe, store.get, store.get);
  const [toast, setToast] = useState<Toast | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const notify = useCallback((next: Toast) => {
    setToast(next);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(null), 5000);
  }, []);

  const dismiss = useCallback(() => setToast(null), []);

  // router.refresh() entrega um novo snapshot do servidor sem desmontar a UI.
  useEffect(() => store.set(initial), [initial, store]);

  const actions = useMemo(() => {
    const mutate: Mutate = (change, audit) => {
      const before = store.get();
      const next = change(before);
      store.set({
        ...next,
        audit: audit
          ? [
              { ...audit, id: nextId("a"), at: new Date().toISOString(), who: before.me.name },
              ...next.audit,
            ]
          : next.audit,
      });
    };
    return remote
      ? createSupabaseActions(store.get, () => router.refresh())
      : localActions(store.get, mutate);
  }, [remote, router, store]);

  const value = useMemo(
    () => ({ data, actions, toast, notify, dismiss }),
    [data, actions, toast, notify, dismiss],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}
