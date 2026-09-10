import type { Establishment } from "./establishment";
import type { BusinessHour, ProfessionalSchedule } from "./schedule";
import type { Professional, Service } from "./catalog";

export type SetupStep = {
  key: "servico" | "horario" | "perfil";
  title: string;
  body: string;
  done: boolean;
  cta: string;
  route: string;
};

/**
 * Os três passos para a loja receber cliente.
 *
 * Nada disso é uma tabela de progresso: cada passo é uma pergunta feita ao
 * estado real. Guardar "já fez o passo 1" numa coluna criaria a possibilidade
 * de a coluna dizer sim e a loja não ter serviço nenhum — e o dono ficaria
 * olhando para um check verde sem entender por que ninguém agenda.
 */
export function setupSteps(input: {
  establishment: Establishment;
  services: Service[];
  professionals: Professional[];
  hours: BusinessHour[];
  schedules: ProfessionalSchedule[];
}): SetupStep[] {
  const hasService = input.services.some((service) => service.isActive);
  const hasProfessional = input.professionals.some((professional) => professional.isActive);
  const hasHours = input.hours.length > 0 && input.schedules.length > 0;
  const hasProfile = Boolean(
    input.establishment.description?.trim() && input.establishment.address_line?.trim(),
  );

  return [
    {
      key: "servico",
      title: "Cadastre o primeiro serviço",
      body: hasService
        ? "Feito. A duração de cada serviço é o que fatia a sua agenda."
        : "Um nome, um preço, uma duração. Sem serviço não existe horário para vender.",
      done: hasService,
      cta: "Cadastrar serviço",
      route: "/servicos",
    },
    {
      key: "horario",
      title: "Diga quando vocês atendem",
      body: hasHours
        ? "Feito. A vaga que o cliente vê é o encontro do horário da loja com a escala de cada um."
        : hasProfessional
          ? "Falta a escala: o horário da loja recorta, mas quem gera vaga é a jornada de cada profissional."
          : "Cadastre quem atende e a jornada de cada um. É a escala que gera vaga, não o horário da loja.",
      done: hasHours,
      cta: "Definir horários",
      route: "/horarios",
    },
    {
      key: "perfil",
      title: "Complete o perfil público",
      body: hasProfile
        ? "Feito. É assim que a barbearia aparece na busca do app do cliente."
        : "Descrição e endereço. É o que o cliente lê antes de decidir vir.",
      done: hasProfile,
      cta: "Completar perfil",
      route: "/perfil-publico",
    },
  ];
}
