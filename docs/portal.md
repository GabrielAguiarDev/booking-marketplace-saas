# Portal do estabelecimento

O portal web roda em `apps/portal`, na porta 3001. A fundação ligada ao
Supabase e o onboarding entraram em 12 de setembro de 2026; no mesmo dia
entraram as seções de operação (P5), cadastro e negócio (P6).

## Autenticação e acesso

- E-mail e senha usam Supabase Auth. Cadastro e recuperação aceitam o código de
  seis dígitos enviado pelo template atual; a sessão é renovada por `proxy.ts`.
- O Server Component de `app/page.tsx` valida a sessão com `getUser()` e só
  então carrega os vínculos de `establishment_members` sob RLS.
- Uma conta com mais de uma loja recebe um seletor; `?establishment=<uuid>` só
  é aceito quando o vínculo aparece na leitura autorizada. Sem vínculo, a tela
  oferece o cadastro da primeira loja.
- O papel vem do banco: `owner` vê tudo, `manager` não entra em assinatura, e
  `staff` fica nas áreas operacionais e em Primeiros passos. RLS/RPC continua
  sendo a barreira definitiva, não a condição da interface.

## Onboarding da loja

O fluxo é:

1. criar e confirmar a conta;
2. informar nome, categoria, CNPJ, razão social, responsável, contato,
   endereço, bairro e ao menos um serviço;
3. `create-establishment` valida o JWT e chama, com service role,
   `create_establishment_application`;
4. a transação cria a loja como `pending`, o vínculo `owner` e os serviços;
5. o admin aprova, recusa ou pede correção.

A loja nunca se aprova sozinha (decisão 0008). No MVP a localidade não aparece
no portal: `resolve_signup_city()` usa a praça ativa. Quando houver mais de uma
praça comercial, essa função deve ser substituída por resolução por CEP,
geolocalização ou pergunta explícita.

Uma correção grava mensagem em `establishment_decisions`. Enquanto essa decisão
for posterior ao último `submitted_at`, o dono vê a mensagem e o formulário
preenchido; `resubmit_establishment_application` valida propriedade, status e
serviços, atualiza os dados e carimba um novo `submitted_at`. Isso devolve a
loja à fila do admin e troca a tela por “cadastro em análise”. Recusa mostra o
motivo; aprovação abre o portal normal.

Fotos não entram no onboarding atual: elas são enviadas depois, em
[Perfil público](#perfil-público).

## Contrato de dados e ações

O contrato está dividido assim:

- `components/model.ts`: tipos serializáveis de sessão, loja, vínculo,
  aplicação, passos e — desde a P6 — catálogo, equipe, agenda, ajustes,
  negócio e financeiro;
- `components/portal-data.ts`: leitura do Server Component, sempre com a
  sessão do usuário e RLS;
- `components/portal-cadastro-data.ts`: a parte da leitura que pertence à P6,
  num arquivo próprio para que P5 e P6 não reescrevessem o mesmo loader;
- `components/store.tsx`: entrega `{ data, actions }` às seções;
- `components/supabase-actions.ts`: escritas do navegador e `router.refresh()`.

Componentes de seção não criam clientes Supabase próprios e não consultam o
banco por conta própria: leem `usePortal().data` e chamam `usePortal().actions`.

Os fixtures de `components/data.ts` e `section-data.ts` ficam apenas como
referência visual do canvas e não são renderizados. Não há fallback silencioso,
contagem, cobrança, receita ou fila inventada (R3 e R7).

## Operação da loja (P5)

- **Visão geral:** os indicadores vêm de `portal_operation_summary`; reservas
  futuras em `scheduled` podem ser aprovadas ou recusadas com motivo.
- **Agenda:** consulta duas semanas, filtra pelo dia local da loja e por
  profissional, e permite aprovar, remarcar, concluir, marcar falta ou cancelar
  pela loja. A escrita usa os mesmos estados do app da equipe.
- **Novo agendamento:** cria cliente sem conta com `guest_name`/`guest_phone`
  (decisão 0006). Serviço, profissional e data são obrigatórios; os horários
  exibidos vêm exclusivamente de `available_slots`, e criação/remarcação passam
  pelas RPCs transacionais do Postgres.
- **Fila:** lê posição e espera de `queue_state()` e permite chamar, sentar,
  concluir, registrar ausência, confirmar chegada e subir uma posição. O balcão
  aceita pessoa sem conta; `queue_require_arrival` decide quando ela ganha
  posição. A assinatura Realtime de `queue_entries` atualiza a leitura do
  Server Component para acompanhar também mudanças do app da equipe.
- **Clientes:** `portal_operation_customers` reúne pessoas com e sem conta a
  partir do histórico real de agenda e fila, incluindo totais, faltas, visitas
  e valor concluído.

As funções de leitura e escrita operacional estão na migration
`20260912140000_portal_operacao.sql`. Todas exigem vínculo ativo com a loja;
papel `staff` opera agenda, fila e clientes, mas continua barrado das áreas de
gestão pela autorização do portal e pelas políticas/RPCs correspondentes.

## Cadastro e negócio (P6)

Sete seções, todas em `components/`, reunidas por `cadastro-sections.tsx` e
ligadas em `portal.tsx`. `cadastro-ui.tsx` guarda o que elas compartilham:
formatação, o aviso de "salvou / não deu certo" e o bloco da regra R9.

O papel é conferido em duas camadas. `portal.tsx` decide quais seções abrem
(`staff` não entra em nenhuma destas; `billing` é só do dono) e cada seção
esconde o que não pode. **A barreira de verdade é RLS**: toda escrita abaixo
usa a política que já existia para dono e gerente.

### Serviços

`services.tsx` e `service-dialog.tsx`. Criar, editar, pausar e reativar, com
duração, preço e quem executa. Três estados aparecem separados, porque a falha
silenciosa mais comum do cadastro é a do meio:

| Estado           | O que significa                                       |
| ---------------- | ----------------------------------------------------- |
| no ar            | ativo e com ao menos um profissional ativo que o faça |
| sem quem execute | ativo, mas não gera horário nenhum no app do cliente  |
| pausado          | fora de circulação                                    |

Serviço nunca é apagado, só pausado: `appointments.service_id` é
`on delete restrict`, e apagar apagaria o sentido das reservas passadas.

### Equipe

`team.tsx`. Cadeira (`professionals`) e conta (`establishment_members`) são
coisas diferentes e aparecem separadas — existe recepção com login e sem
cadeira, e barbeiro na vitrine que nunca abriu o app. Um card por profissional
com jornada da semana, reservas futuras, se usa o app e o que faz; abaixo, a
lista de quem entra no portal, onde o dono muda o papel de um colega.

Convite por e-mail usa a Edge Function `establishment-invite` e a rota
`/convite` ([notificacoes.md](notificacoes.md#convite-para-a-equipe-da-loja)).
O dono envia, reenvia e revoga pela lista; a pessoa aceita o link e define a
senha antes de entrar. Trocar o próprio papel não é oferecido, e o banco recusa
deixar a loja sem nenhum dono (gatilho `guard_last_establishment_owner`).

### Horários

`hours.tsx`. Três painéis: funcionamento da loja por dia da semana, grade de
jornada por pessoa × dia, e as exceções futuras (folga, feriado, bloqueio, ou
o sábado extra que alguém resolveu abrir). Dois turnos no mesmo dia é como se
fecha para o almoço.

Nada aqui recalcula disponibilidade: quem responde continua sendo
`available_slots()` no Postgres (R1).

### Perfil público

`profile.tsx`. Descrição, endereço, bairro, telefone, cor da marca e galeria,
com prévia do card do app do cliente ao lado. A prévia usa os dados reais —
quando não há avaliação ela diz "ainda sem avaliação" em vez de inventar 4,9, e
quando nenhum serviço está no ar ela diz isso também.

As fotos vão para o bucket público `establishment-photos`, no caminho
`<id da loja>/<arquivo>`. O caminho carrega a autorização: as políticas de
`storage.objects` leem a primeira pasta e conferem o papel por
`establishment_photo_can_write()`, e uma restrição em
`establishment_photos.storage_path` garante que ninguém grave fora do formato.
Público como o da vitrine, porque a imagem é mostrada antes de qualquer login;
o que é controlado é quem escreve.

### Configurações

`settings.tsx`. As mesmas colunas que o `mobile-staff` lê em
`app/regras.tsx` e `app/fila-config.tsx`, para que os dois não digam coisas
diferentes: forma de atendimento, aprovação automática, passo da grade,
antecedência mínima, janela de cancelamento, sinal, e os ajustes de fila.

Os oito ajustes marcados **"ainda não atua"** continuam visíveis de propósito:
o valor é gravado, nenhuma superfície o lê ainda, e escondê-los faria a loja
confiar num interruptor que não faz nada. Eles esperam notificação push e o
provedor de pagamento.

**Atualização 2026-09-17:** os seis ajustes de fila passaram a atuar no banco
(`20260917131000_queue_rules.sql`) e o aviso na vez sai pela caixa de saída;
só "Sinal reembolsável" e "Aceitar pagamento pelo app" continuam sem efeito.
A etiqueta da tela ainda precisa ser retirada dos seis. Ver
[notificacoes.md](notificacoes.md#os-ajustes-da-fila-atuam).

### Plano e assinatura

`billing.tsx`, e só leitura — não por preguiça: `guard_establishment_status`
recusa mudança de plano, desconto ou situação que não venha de admin da
plataforma. Mostra o plano atual, o desconto (se houver) e o que muda em cada
plano do catálogo, avisando quando a loja já passou do limite de profissionais
do plano. Não há fatura, cartão nem histórico de cobrança: `payments` nunca
recebeu uma linha porque o provedor de pagamento não foi escolhido, e a tela
diz isso em vez de mostrar número inventado (R7).

### Financeiro

`finance.tsx`. Tudo sai de `appointments` com `status = 'completed'` e o
`price_cents` congelado no ato da reserva: seis meses de faturamento, mês
corrente por profissional e por serviço, ticket médio e o sinal preso em
reservas futuras (calculado, nunca cobrado). Repasse, taxa e recebimento pelo
app não aparecem — seriam invenção.

## Regra R9 — mudança de agenda não invalida venda em silêncio

A pergunta "o que quebra se eu mudar isto?" é respondida pelo Postgres, ao lado
de `available_slots()`, e não por uma segunda implementação em TypeScript que
erraria em fuso, turno partido e reserva que cruza a meia-noite.

| Onde                            | Como                                                                       |
| ------------------------------- | -------------------------------------------------------------------------- |
| Funcionamento e jornada         | `schedule_change_impact()` com a jornada proposta; salvar só depois de ver |
| Bloquear um período             | `block_impact()`; a pergunta se inverte (quebra quem encosta no bloqueio)  |
| Tirar um profissional da agenda | `schedule_change_impact()` sem dia e sem turno: tudo que ele tem marcado   |
| Mudar a duração de um serviço   | contagem de reservas futuras vivas daquele serviço, no próprio diálogo     |

As duas funções são `security definer` com portão explícito
(`assert_establishment_manager`) e só leem. Lista vazia significa que nada
quebra, e a tela diz isso; com linha, o botão passa a se chamar "Salvar mesmo
assim". Salvar **não** cancela nada: a reserva continua na agenda, e quem edita
foi avisado — que é exatamente o que a R9 pede.

Duração e preço de uma reserva são congelados no ato: mudar a tabela de preços
ou a duração de hoje não mexe em quem marcou ontem. É o mesmo que o
`mobile-staff` diz em `app/servico/[id].tsx` e em `app/regras.tsx`.

## Primeiros passos

Segue a mesma regra de `mobile-staff/src/data/onboarding.ts`: progresso não é
uma coluna. O portal pergunta ao estado real se existe serviço ativo, se há
horário da loja junto de profissional/jornada, e se descrição/endereço estão
preenchidos. Assim o check não fica verde quando o dado necessário desaparece.

## Verificação local

```bash
docker exec -i supabase_db_vez-saas psql -U postgres -d postgres \
  -v ON_ERROR_STOP=1 < supabase/migrations/20260912110000_onboarding.sql
docker exec -i supabase_db_vez-saas psql -U postgres -d postgres \
  -v ON_ERROR_STOP=1 < supabase/migrations/20260912140000_portal_operacao.sql
docker exec -i supabase_db_vez-saas psql -U postgres -d postgres \
  -v ON_ERROR_STOP=1 < supabase/migrations/20260912150000_portal_cadastro.sql
pnpm exec supabase db lint --local --level warning
./scripts/check-rls.sh
pnpm --filter @vez/portal typecheck
pnpm --filter @vez/portal lint
pnpm --filter @vez/portal build
pnpm exec supabase functions serve create-establishment \
  --env-file supabase/functions/.env
```
