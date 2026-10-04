# Auditoria de layout — 3 de outubro de 2026

Revisão das cinco superfícies do Vez, com mapeamento e correções aplicadas nesta
branch. Dois workers supervisionados pelo Orca trabalharam em escopos separados:
admin/portal e apps móveis. O coordenador revisou a landing, conferiu os ajustes e
complementou as correções nas telas móveis.

## O que mudou

| Superfície     | Ajustes                                                                                                                                                                                                                                                                                                    | Onde conferir                                                         |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| Landing        | Botão principal quebra dentro da largura disponível; cabeçalho cabe em 320px; menu tem rolagem em telas baixas; barra da agenda demonstrativa quebra sem sobrepor título e abas; etapas mantêm texto antes da imagem quando empilhadas; contatos/links longos quebram; metadados da agenda têm reticências | Home, Como funciona, rodapé, Cliente, Termos e Privacidade            |
| Admin          | Campos dos diálogos empilham; cinco etapas passam a três/uma colunas; busca respeita as margens no celular; filtro não excede o contêiner; alturas consideram a barra móvel do navegador                                                                                                                   | Busca global, Estabelecimentos, Cotas e planos, formulários e Vitrine |
| Portal         | Gavetas, login e cadastro usam altura dinâmica; seletor de loja cede espaço no cabeçalho; galeria usa colunas que podem encolher                                                                                                                                                                           | Cabeçalho, Perfil público, login/cadastro e gavetas                   |
| App da loja    | Folhas inferiores limitadas e roláveis; formulários ajustam espaço do teclado no iOS; valores e títulos longos podem encolher; controles fixos limitam rótulos; indicador ATENDIDOS cabe em 320px; escalas/nomes e cabeçalhos da agenda podem quebrar dentro da linha                                      | Hoje, Agenda, Fila, Horários, detalhes e formulários                  |
| App do cliente | Avaliação ajusta espaço do teclado no iOS; corpo da folha pode encolher; títulos de seção e rótulos de controles respeitam espaço; nome do autor da avaliação cede espaço para a nota                                                                                                                      | Avaliação, Assistente, seções e avaliações da loja                    |

Não houve alteração de banco, regras de pagamento ou regras de negócio.

## Verificação

- TypeScript e ESLint passaram nos cinco apps. As verificações dos apps móveis
  foram repetidas após as correções complementares; as da landing após seus ajustes.
- Admin: navegação pelas 13 seções com dados locais em **320, 768 e 1440px**.
- Portal: navegação pelas 12 seções com dados locais em **320, 768 e 1440px**.
- Landing: `/`, `/cliente`, `/termos`, `/privacidade` em **320, 768 e 1440px**.
- App da loja: versão web do Expo, **19 telas em 320px**: Hoje, Agenda, Fila,
  Loja, Mais, Horários, Serviços, Profissionais, Ajustes, Assinatura, Regras,
  Começar, Financeiro, Avaliações, Suporte, Perfil público, Novo agendamento,
  Bloquear período e Configurações da fila.
- App do cliente: versão web do Expo em **320px**, com estados de visitante e
  sessão do cliente local. Conferidos Início, Explorar, Assistente, Agenda, Perfil,
  Resultados, Ajuda/novo chamado, dados, avisos, favoritos, endereços/novo endereço,
  tela de exclusão (sem confirmar), login, cadastro, recuperação/confirmação e
  páginas das duas lojas locais. Fluxos de reserva/pagamento que exigem parâmetros
  e dados específicos continuam cobertos por revisão de código, não ponta a ponta.
- Medição de limites horizontais do DOM e capturas inspecionadas para os defeitos
  reproduzidos. Tabelas/calendários com rolagem própria e hachuras decorativas
  recortadas foram distinguidos de conteúdo escapando da tela.
- Painel de adicionar alguém à fila conferido em **320 × 320px**: título dentro
  da janela e corpo com rolagem interna (156px visíveis para 322px de conteúdo),
  sem salvar ou alterar a fila.
- `git diff --check` passou.

A revisão de código cobre os componentes compartilhados e buscas de padrões nas
telas; não equivale a testar cada combinação de dados, modal e estado de erro.
A versão web não comprova teclado, áreas seguras e fonte ampliada no iOS/Android.
Não foram executados builds nativos ou simuladores.

## Uso dos agentes

Run Orca: `run_2da6edae24f3`. As duas tarefas foram concluídas e seus workers
liberados. A primeira tentativa de iniciar o worker Codex falhou antes da entrega;
foi substituída por um worker Claude, resultando em dois workers Claude com o modelo
padrão configurado no Orca. O terminal da tentativa inicial foi preservado pelo
Orca por detectar `user_takeover`.

Os workers estimaram cerca de **45 mil tokens no web** e **45–50 mil no mobile**
(incluindo contexto inicial no mobile). São estimativas dos próprios agentes,
sem telemetria precisa comparável. A meta inicial de 15 mil por worker foi
ultrapassada; ao receber os checkpoints, o coordenador restringiu novas leituras
amplas e encerrou as frentes após correções e checks. Não há garantia de igualdade
de consumo nem de limites rígidos entre contas/provedores.

## Relatórios das frentes

- [Mapeamento web dos workers](layout-audit-web.md).
- [Mapeamento mobile dos workers](layout-audit-mobile.md).

Esses relatórios registram a revisão estática inicial; esta página registra também
a conferência posterior no navegador e as correções complementares.
