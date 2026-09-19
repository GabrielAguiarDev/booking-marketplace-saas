# Contas e endereços para testar

Tudo aqui é do ambiente **local** (`supabase start` + `pnpm db:demo`). Nenhuma
dessas contas existe em produção. A senha é a mesma para todas:

```
senha-forte-123
```

## As quatro contas

| E-mail              | Quem é                      | Onde entra                  | O que dá para ver                                                       |
| ------------------- | --------------------------- | --------------------------- | ----------------------------------------------------------------------- |
| `cliente@vez.local` | Marcos Aurélio, cliente     | App do cliente              | Buscar, agendar, fila, avaliar, vitrine na home e "Ajuda" (chamados)    |
| `rafael@vez.local`  | Rafael Nunes, **dono**      | Portal (3001) e app da loja | Tudo da Barbearia Meia-Nove: agenda, fila, serviços, equipe, horários…  |
| `diego@vez.local`   | Diego Alves, **equipe**     | Portal (3001) e app da loja | Só a própria agenda; as telas de gestão ficam bloqueadas                |
| `admin@vez.local`   | Helena Reis, **plataforma** | Admin (3002)                | As 13 telas: aprovações, suporte, vitrine, cidades, avaliações, equipe… |

A demo tem **duas lojas** (Barbearia Meia-Nove e Clínica Aurora Derma), ambas
ativas, e agendamentos ancorados no dia de hoje — a agenda abre com conteúdo em
qualquer data que você carregar a demo.

## Endereços

| Superfície              | Endereço               | Como subir                              |
| ----------------------- | ---------------------- | --------------------------------------- |
| Landing                 | http://localhost:3000  | `pnpm --filter @vez/landing dev`        |
| Portal da loja          | http://localhost:3001  | `pnpm --filter @vez/portal dev`         |
| Admin da plataforma     | http://localhost:3002  | `pnpm --filter @vez/admin dev`          |
| App do cliente          | Expo (web ou celular)  | `pnpm --filter @vez/mobile-cliente dev` |
| App da loja             | Expo (web ou celular)  | `pnpm --filter @vez/mobile-staff dev`   |
| E-mails (Inbucket)      | http://127.0.0.1:54324 | sobe com o Supabase                     |
| Banco (Supabase Studio) | http://127.0.0.1:54323 | sobe com o Supabase                     |

`pnpm dev` na raiz sobe tudo de uma vez. Para ver os apps Expo no navegador,
acrescente `--web`: `pnpm --filter @vez/mobile-cliente exec expo start --web`.

## Começando do zero

```bash
pnpm db:start     # sobe o Supabase local (precisa do Docker/OrbStack aberto)
pnpm db:reset     # recria o banco com todas as migrations
pnpm db:demo      # carrega as lojas, os serviços, o dia de hoje e as 4 contas
```

`db:reset` apaga o que você tiver criado testando. `db:demo` pode ser rodado de
novo a qualquer momento para voltar ao estado inicial.

## Roteiros que valem a pena

**A loja nasce (portal → admin → app do cliente).** Na landing, clique em
"Cadastrar meu estabelecimento" — vai para o portal. Crie uma conta nova (o
código de confirmação chega no Inbucket), cadastre a loja e veja a tela "em
análise". No admin, em Aprovações, peça correção; volte ao portal com a conta
nova, corrija e reenvie; aprove no admin. A loja aprovada aparece na busca do
app do cliente.

**Chamado de suporte (app → admin → app).** No app do cliente, em Perfil →
Ajuda, abra um chamado. Ele entra na tela Suporte do admin. Responda por lá e a
resposta aparece no app. O mesmo vale pelo app da loja.

**Denúncia de avaliação (loja → admin → loja).** No app da loja, em Sua loja →
Avaliações, denuncie uma avaliação. No admin, em Avaliações, peça
esclarecimento; responda pelo app da loja; decida no admin. A loja vê a decisão.

**Vitrine.** No admin, em Vitrine, crie um banner com uma imagem. Ele aparece na
home do app do cliente. Pause ou remova e a home volta a começar nas categorias.

**Interessado da landing.** Preencha o formulário da landing; o contato aparece
no admin, em Interessados, com a triagem ("já falei", "descartar", "devolver").

**Papéis.** Entre no portal com `diego@vez.local`: as telas de gestão ficam
bloqueadas, porque ele é equipe, não dono. No admin, em Configurações → Equipe,
dá para convidar alguém com papel de operações, financeiro ou suporte (o convite
chega no Inbucket) e conferir que cada papel só faz o que lhe cabe.

## Detalhes que costumam confundir

- **Use `localhost`, não `127.0.0.1`,** para abrir as aplicações web em
  desenvolvimento; com o outro endereço o Next bloqueia recursos e a tela não
  carrega direito.
- **Nenhum aviso sai de verdade.** E-mail e push ainda não têm provedor: o
  convite e a confirmação de conta caem no Inbucket, e o resto fica só gravado.
- **O segundo fator do admin vem desligado** na demo, para o login local ser
  simples. Para testar:
  `update public.platform_settings set admin_mfa_required = true where id;`
- **Cobrança não existe.** O plano é só leitura no portal e o financeiro mostra
  apenas atendimentos concluídos.
- **Cidade não aparece** para cliente, loja ou visitante: é decisão do MVP. Ela
  continua no banco e o admin a vê.
