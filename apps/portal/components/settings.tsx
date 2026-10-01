"use client";

import { Switch, minutesLabel, useSave } from "./cadastro-ui";
import type { BookingMode, PortalSettings, RulesPatch, SettingsPatch } from "./model";
import { BOOKING_MODE_LABEL } from "./model";
import { usePortal } from "./store";
import { INK, MUTED } from "./tokens";

const LEAD_OPTIONS = [0, 15, 30, 60, 120, 240];
const CANCEL_OPTIONS = [60, 120, 360, 1440];
const DEPOSIT_OPTIONS = [30, 50];
const SLOT_OPTIONS = [10, 15, 20, 30, 60];
const CLOSE_AFTER = [30, 60, 90];

const ARRIVAL: { key: PortalSettings["queue_arrival_method"]; label: string }[] = [
  { key: "qr", label: "QR no balcão" },
  { key: "staff", label: "A equipe confirma" },
  { key: "location", label: "Localização" },
];
const CHANNEL: { key: PortalSettings["queue_notify_channel"]; label: string }[] = [
  { key: "push", label: "Push" },
  { key: "sms", label: "SMS" },
  { key: "whatsapp", label: "WhatsApp" },
];

/** Escolha curta em linha: os valores possíveis de um ajuste, logo abaixo dele. */
function Pills({
  options,
  value,
  onPick,
  label,
  disabled,
}: {
  options: { key: string; label: string }[];
  value: string;
  onPick: (key: string) => void;
  label: string;
  disabled: boolean;
}) {
  return (
    <div aria-label={label} className="chipbar" role="group" style={{ padding: "0 20px 14px" }}>
      {options.map((option) => (
        <button
          aria-pressed={option.key === value}
          className={option.key === value ? "chip active" : "chip"}
          disabled={disabled}
          key={option.key}
          onClick={() => onPick(option.key)}
          style={{ borderRadius: "8px" }}
          type="button"
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

/**
 * Regras da loja.
 *
 * Os mesmos ajustes de `mobile-staff/app/regras.tsx` e `fila-config.tsx`, lendo
 * e gravando as mesmas colunas. As regras de fila sao aplicadas no banco.
 */
export function Settings() {
  const { data, actions } = usePortal();
  const { run, pending } = useSave();

  if (!data) return null;
  const settings = data.settings;
  const establishment = data.establishment;
  const canWrite = establishment.role !== "staff";

  const patchSettings = (patch: SettingsPatch, message: string) =>
    void run(() => actions.saveSettings(establishment.id, patch), message);
  const patchRules = (patch: RulesPatch, message: string) =>
    void run(() => actions.saveRules(establishment.id, patch), message);

  if (!canWrite) {
    return (
      <section className="empty-section">
        <span aria-hidden="true">!</span>
        <h2>Só dono ou gerente muda as regras</h2>
        <p>Você opera a loja; as regras são de quem responde por ela.</p>
      </section>
    );
  }

  if (!settings) {
    return (
      <section className="empty-section">
        <span aria-hidden="true">○</span>
        <h2>Ajustes ainda não criados</h2>
        <p>As regras desta loja ainda não foram criadas. Fale com o suporte do Vez.</p>
      </section>
    );
  }

  const usesQueue = establishment.bookingMode !== "scheduled";

  return (
    <div className="page">
      <section className="panel">
        <header className="panel-head stacked">
          <h2>Como a loja atende</h2>
          <p>
            Vale para todo pedido feito pelo app do cliente. O que a loja cria no balcão não passa
            por estas regras.
          </p>
        </header>

        <div className="list-row">
          <div>
            <strong>Forma de atendimento</strong>
            <small>Hora marcada, ordem de chegada, ou os dois.</small>
          </div>
          <code>{BOOKING_MODE_LABEL[establishment.bookingMode]}</code>
        </div>
        <Pills
          disabled={pending}
          label="Forma de atendimento"
          onPick={(key) =>
            patchRules({ bookingMode: key as BookingMode }, "Forma de atendimento atualizada.")
          }
          options={(["scheduled", "queue", "both"] as BookingMode[]).map((mode) => ({
            key: mode,
            label: BOOKING_MODE_LABEL[mode],
          }))}
          value={establishment.bookingMode}
        />

        <div className="list-row">
          <div>
            <strong>Aprovar cada pedido na mão</strong>
            <small>Desligado, o horário é confirmado na hora em que o cliente pede.</small>
          </div>
          <Switch
            disabled={pending}
            label="Aprovar cada pedido na mão"
            on={!settings.auto_approve}
            onChange={(next) =>
              patchSettings(
                { auto_approve: !next },
                next ? "Pedidos passam a esperar seu sim." : "Pedidos passam a nascer confirmados.",
              )
            }
          />
        </div>

        <div className="list-row">
          <div>
            <strong>Passo da grade de horários</strong>
            <small>De quanto em quanto tempo o app oferece um começo de atendimento.</small>
          </div>
          <code>{minutesLabel(establishment.slotIntervalMinutes)}</code>
        </div>
        <Pills
          disabled={pending}
          label="Passo da grade"
          onPick={(key) => patchRules({ slotIntervalMinutes: Number(key) }, "Grade atualizada.")}
          options={SLOT_OPTIONS.map((value) => ({
            key: String(value),
            label: minutesLabel(value),
          }))}
          value={String(establishment.slotIntervalMinutes)}
        />
      </section>

      <section className="panel">
        <header className="panel-head stacked">
          <h2>Prazos</h2>
          <p>
            Mudar prazo não mexe em reserva já vendida: quem marcou ontem continua com o horário e
            com a regra de ontem.
          </p>
        </header>

        <div className="list-row">
          <div>
            <strong>Antecedência mínima</strong>
            <small>Tempo mínimo entre o pedido e o horário. Fecha o encaixe de última hora.</small>
          </div>
          <code>
            {establishment.minLeadMinutes === 0
              ? "sem limite"
              : minutesLabel(establishment.minLeadMinutes)}
          </code>
        </div>
        <Pills
          disabled={pending}
          label="Antecedência mínima"
          onPick={(key) => patchRules({ minLeadMinutes: Number(key) }, "Antecedência atualizada.")}
          options={LEAD_OPTIONS.map((value) => ({
            key: String(value),
            label: value === 0 ? "sem limite" : minutesLabel(value),
          }))}
          value={String(establishment.minLeadMinutes)}
        />

        <div className="list-row">
          <div>
            <strong>Cancelar sem custo até</strong>
            <small>Depois disso, o cliente vê o aviso de que cancelou fora do prazo.</small>
          </div>
          <code>{minutesLabel(establishment.cancellationWindowMinutes)} antes</code>
        </div>
        <Pills
          disabled={pending}
          label="Janela de cancelamento"
          onPick={(key) =>
            patchRules({ cancellationWindowMinutes: Number(key) }, "Janela atualizada.")
          }
          options={CANCEL_OPTIONS.map((value) => ({
            key: String(value),
            label: minutesLabel(value),
          }))}
          value={String(establishment.cancellationWindowMinutes)}
        />
      </section>

      <section className="panel">
        <header className="panel-head stacked">
          <h2>Sinal e pagamento</h2>
          <p>
            O valor do sinal já é calculado e guardado em cada reserva. Nenhuma cobrança sai de
            lugar nenhum: falta escolher o provedor de pagamento.
          </p>
        </header>

        <div className="list-row">
          <div>
            <strong>Exigir sinal para reservar</strong>
            <small>Calculado sobre o preço do serviço no ato da reserva.</small>
          </div>
          <Switch
            disabled={pending}
            label="Exigir sinal para reservar"
            on={establishment.depositPercent > 0}
            onChange={(next) =>
              patchRules(
                { depositPercent: next ? 30 : 0 },
                next ? "Sinal de 30% ligado." : "Sinal desligado.",
              )
            }
          />
        </div>
        {establishment.depositPercent > 0 ? (
          <Pills
            disabled={pending}
            label="Percentual do sinal"
            onPick={(key) => patchRules({ depositPercent: Number(key) }, "Sinal atualizado.")}
            options={DEPOSIT_OPTIONS.map((value) => ({
              key: String(value),
              label: `${value}% do valor`,
            }))}
            value={String(establishment.depositPercent)}
          />
        ) : null}

        {/* "Sinal reembolsável" e "Aceitar pagamento pelo app" voltam junto com o
            pagamento pelo app; até lá seriam interruptores sem efeito. As colunas
            continuam em establishment_settings. */}
      </section>

      <section className="panel">
        <header className="panel-head stacked">
          <h2>Fila de espera</h2>
          <p>
            {usesQueue
              ? "Vale para quem chega sem hora marcada."
              : "Esta loja atende só com hora marcada; ligue a fila em “Como a loja atende”."}
          </p>
        </header>

        <div className="list-row">
          <div>
            <strong>Pedir confirmação de chegada</strong>
            <small>
              Quem entrou de longe só assume a posição depois de confirmar que chegou. É o único
              ajuste da fila que muda a ordem de verdade.
            </small>
          </div>
          <Switch
            disabled={pending || !usesQueue}
            label="Pedir confirmação de chegada"
            on={settings.queue_require_arrival}
            onChange={(next) =>
              patchSettings(
                { queue_require_arrival: next },
                next
                  ? "Quem não confirmar chegada não segura a fila."
                  : "Todo mundo passa a pegar posição de onde estiver.",
              )
            }
          />
        </div>
        {settings.queue_require_arrival ? (
          <Pills
            disabled={pending}
            label="Como confirmar chegada"
            onPick={(key) =>
              patchSettings(
                { queue_arrival_method: key as PortalSettings["queue_arrival_method"] },
                "Ajuste salvo.",
              )
            }
            options={ARRIVAL.map((item) => ({ key: item.key, label: item.label }))}
            value={settings.queue_arrival_method}
          />
        ) : null}

        {(
          [
            [
              "queue_remote_join",
              "Entrar na fila antes de chegar",
              "A pessoa pega posição pelo celular e vem depois.",
            ],
            [
              "queue_qr_enabled",
              "Entrada por QR code no balcão",
              "Um cartaz na recepção; o cliente entra sozinho.",
            ],
            [
              "queue_per_professional",
              "Uma fila por profissional",
              "Desligado, todos esperam na mesma fila da loja.",
            ],
            [
              "queue_auto_close",
              "Fechar a fila quando encher",
              "Para de aceitar gente nova quando a espera passa do tempo abaixo.",
            ],
            [
              "queue_auto_skip",
              "Pular quem não responde à chamada",
              "Depois de chamar sem resposta, a pessoa vai para o fim.",
            ],
            [
              "queue_notify_enabled",
              "Avisar o cliente na vez dele",
              "O aviso é enviado pelo canal escolhido abaixo.",
            ],
          ] as const
        ).map(([key, label, help]) => (
          <div className="list-row" key={key}>
            <div>
              <strong>{label}</strong>
              <small>{help}</small>
            </div>
            <Switch
              disabled={pending || !usesQueue}
              label={label}
              on={settings[key]}
              onChange={(next) => patchSettings({ [key]: next }, "Ajuste salvo.")}
            />
          </div>
        ))}

        {settings.queue_auto_close ? (
          <Pills
            disabled={pending}
            label="Fechar a fila depois de"
            onPick={(key) =>
              patchSettings({ queue_close_after_minutes: Number(key) }, "Ajuste salvo.")
            }
            options={CLOSE_AFTER.map((value) => ({ key: String(value), label: `${value} min` }))}
            value={String(settings.queue_close_after_minutes)}
          />
        ) : null}
        {settings.queue_notify_enabled ? (
          <Pills
            disabled={pending}
            label="Canal do aviso"
            onPick={(key) =>
              patchSettings(
                { queue_notify_channel: key as PortalSettings["queue_notify_channel"] },
                "Ajuste salvo.",
              )
            }
            options={CHANNEL.map((item) => ({ key: item.key, label: item.label }))}
            value={settings.queue_notify_channel}
          />
        ) : null}

        <footer className="card-foot">
          As regras de fila valem no portal e nos aplicativos. Um aviso que não puder ser entregue
          fica retido por até sete dias e depois é descartado, para não chegar fora de hora.
        </footer>
      </section>

      <section className="panel">
        <header className="panel-head stacked">
          <h2>Dados do estabelecimento</h2>
          <p>Usados no contrato com o Vez. Para corrigir, fale com o suporte.</p>
        </header>
        <div className="list-row">
          <div>
            <strong>Razão social</strong>
            <small>{establishment.legal_name || "não informada"}</small>
          </div>
          <code style={{ color: MUTED }}>
            {establishment.cnpj ? `CNPJ ${establishment.cnpj}` : "sem CNPJ"}
          </code>
        </div>
        <div className="list-row">
          <div>
            <strong>Responsável</strong>
            <small>
              {establishment.responsible_name || "não informado"}
              {establishment.contact_email ? ` · ${establishment.contact_email}` : ""}
            </small>
          </div>
          <code style={{ color: INK }}>{establishment.slug}</code>
        </div>
      </section>
    </div>
  );
}
