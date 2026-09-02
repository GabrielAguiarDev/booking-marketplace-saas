# Próximos passos

Documento de continuidade. O [roadmap do app do cliente](roadmap-mobile-cliente.md)
cobria uma superfície só e está quase todo riscado; este cobre o produto.

## O diagnóstico, sem otimismo

O app do cliente sabe comprar. **Ninguém sabe vender.**

| Superfície       | Linhas de código | Estado                                   |
| ---------------- | ---------------: | ---------------------------------------- |
| `mobile-cliente` |            5.880 | Funcional ponta a ponta                  |
| `portal`         |              593 | Página que confirma conexão com Supabase |
| `admin`          |              593 | Idem                                     |
| `landing`        |              593 | Idem                                     |
| `mobile-staff`   |               64 | Idem                                     |

Isso não é "falta polir as outras telas". É que o ciclo do produto **não fecha**:

- **Nenhum estabelecimento consegue se cadastrar.** `establishments` não tem
  política de INSERT para `authenticated` — só admin de plataforma escreve. A
  Edge Function que valida a cota da cidade foi documentada e nunca escrita.
- **Nenhuma loja sai de `pending`.** O status nasce pendente e só loja `active`
  aparece na busca. Não existe tela que aprove.
- **Ninguém marca uma reserva como atendida.** A política existe
  (`appointments_update_establishment`), o app que a usaria não. Consequência
  direta: **avaliar é inalcançável** — a política de `reviews` exige
  `status = 'completed'`.
- **A fila não anda.** Entrar funciona; chamar o próximo é ação da equipe, e não
  há equipe no sistema.
- **O negócio não cobra nada.** Zero linhas sobre cota por cidade, mensalidade
  ou comissão — que é o modelo do brief.

Hoje, para testar uma avaliação, é preciso rodar `update appointments set
status='completed'` no Studio. Isso mede a distância que falta.

---

## Ordem sugerida

Ordenada por dependência, não por esforço. Os três primeiros itens fecham o
ciclo; sem eles, o resto melhora um produto que não funciona.

### 1. App da equipe — `mobile-staff`

**Por que primeiro:** é o que faz o dia acontecer. Sem ele a fila não anda,
reserva não vira atendimento, e avaliação nunca existe.

Telas mínimas:

- Entrar (reaproveita `packages/supabase` e o padrão de `mobile-cliente`)
- Agenda do dia do profissional
- Chamar próximo / marcar sentado / concluir — a fila viva do outro lado
- Marcar atendido, não compareceu, cancelar pela loja

**Reaproveitável direto:** `src/auth/` inteiro, `src/ui/`, `src/theme/`,
`src/data/use-async.ts`. Vale mover para `packages/` **quando o segundo app
consumir de fato** — não antes, pela regra do projeto.

**Pronto quando:** dá para atender alguém do começo ao fim sem tocar no Studio.

### 2. Portal do estabelecimento — `portal`

Cadastro do que hoje só existe por SQL: serviços, profissionais, quem faz o quê,
horário de funcionamento, jornadas e exceções. Todas as tabelas e políticas já
existem — falta a tela.

**Cuidado:** mudar duração de serviço ou jornada **muda a grade de horários** e
pode invalidar reserva futura já vendida. Decida o que acontece com quem já
marcou antes de permitir a edição.

**Pronto quando:** um dono de barbearia publica a loja inteira sem ajuda.

### 3. Onboarding de estabelecimento + aprovação

Duas pontas do mesmo problema:

- **Edge Function `create-establishment`** — cria a loja e o vínculo `owner` em
  `establishment_members`, validando a cota da cidade (o motivo original de não
  haver política de INSERT). Precisa da decisão de monetização abaixo.
- **Admin aprova** — `pending` → `active`. Sem isso nada publicado aparece.

**Pronto quando:** um cadastro feito do zero aparece na busca do app do cliente.

---

### 4. Monetização ⟵ **precisa de decisão sua**

Nada disso existe no banco, e é o modelo de negócio do brief: mensalidade fixa
com cota por cidade, **ou** comissão por atendimento.

As duas escolhas produzem esquemas diferentes:

| Modelo      | O que entra no banco                                                       |
| ----------- | -------------------------------------------------------------------------- |
| Mensalidade | `city_plans` (cota e preço por cidade), `subscriptions`, ciclo de cobrança |
| Comissão    | percentual por loja, cálculo por atendimento concluído, repasse            |

E mudam a fase 3 acima: a cota da cidade só é verificável se houver o conceito
de cota.

**Pergunta concreta:** os dois modelos coexistem (a loja escolhe) ou a
plataforma adota um?

### 5. Pagamento ⟵ **continua bloqueada**

`payments` existe como esquema, sem nenhuma política de escrita. Falta escolher
provedor e definir **quem recebe** — plataforma repassando ou estabelecimento
direto. Isso muda o modelo tributário inteiro.

Ver [decisions/0004](decisions/0004-catalogo-disponibilidade-fila.md), decisão 5.

---

### 6. O que trava produção

- **SMTP.** Sem provedor real, o Supabase hospedado manda ~3 e-mails por hora e
  ninguém se cadastra. É o item operacional mais urgente.
- **Crédito da OpenAI.** A chave está configurada e válida; a conta está sem
  saldo. Ver [assistente.md](assistente.md).
- **Notificações push.** A fila só atualiza com o app aberto — que é justamente
  quando o usuário não está olhando. Vale também para lembrete de reserva.
- **Excluir conta (LGPD).** Precisa de Edge Function (RLS não apaga
  `auth.users`) e de uma decisão sobre o histórico de reservas.
- **Deep links.** Quando houver domínio, dá para somar o link mágico ao lado do
  código de 6 dígitos, sem tocar nas telas de auth.

### 7. Lacunas do app do cliente

Nenhuma bloqueia o ciclo; todas incomodam.

| Falta                   | Onde                                          |
| ----------------------- | --------------------------------------------- |
| `app/reserva/[id].tsx`  | detalhe e remarcar — hoje só cancelar no card |
| `app/perfil/editar.tsx` | editar nome e telefone                        |
| Fotos da loja           | tabela existe, upload não                     |
| Busca por proximidade   | coordenadas guardadas, ordenação não usa      |
| Histórico do assistente | tabelas guardam, tela abre vazia              |
| `vzrise`                | animação de entrada que o canvas previa       |

### 8. Landing

Deixada por último de propósito: ela vende um produto que precisa existir antes.

---

## Regras que continuam valendo

Do [roadmap](roadmap-mobile-cliente.md#as-regras), e nenhuma mudou:

- **R1** — disponibilidade só no Postgres. Nem o assistente é exceção.
- **R2** — toda tabela nasce com RLS e política, na mesma migration.
- **R3** — fixture morre quando a tabela nasce. Nada de fallback silencioso.
- **R4** — escrita privilegiada é Edge Function. Chave secreta nunca no cliente.
- **R5** — tela com rodapé fixo ou etapa de fluxo vai na raiz de `app/`.
- **R6** — escolha curta é folha inferior, não bloco que empurra a tela.
- **R7** — nada de número inventado. Zero verdadeiro vence estimativa bonita.

Duas que este documento acrescenta:

- **R8 — `packages/` só quando o segundo consumidor existir.** `mobile-staff`
  vai querer `auth/`, `ui/` e `theme/` do cliente. Mova quando ele consumir, não
  quando parecer que vai consumir.
- **R9 — mudança de agenda não invalida venda em silêncio.** Editar duração,
  jornada ou funcionamento pode derrubar reserva já feita. Quem edita precisa
  ver o que vai quebrar.

## Como uma fase é executada

1. Migration com RLS e política juntas (R2).
2. `pnpm db:reset && pnpm db:demo && pnpm db:types`.
3. Testar a política **por comportamento**: ler e escrever como `anon`, como
   dono, e como alguém de outra loja. Metadado não prova bloqueio.
4. Ligar a tela; apagar a fixture (R3).
5. `pnpm typecheck && pnpm lint && pnpm build && pnpm db:check-rls`.
6. Atualizar este documento e registrar a decisão em `docs/decisions/`.

## Estado para retomar

```bash
pnpm db:start && pnpm db:demo     # 2 lojas em Joinville
cd apps/mobile-cliente && npx expo start
```

Conta de teste: `teste@vez.local` / `senha-forte-123`.
E-mails locais em http://127.0.0.1:54324 · Studio em http://127.0.0.1:54323

**Decisões suas que destravam trabalho:** monetização (item 4), provedor de
pagamento (item 5), e o que fazer com reserva já vendida quando a loja muda a
agenda (R9).
