# Vez

Marketplace de agendamentos para serviços locais — barbearias, salões, clínicas
de estética, dermatologistas e petshops. Cliente busca o serviço, vê quem tem
horário e agenda, ou entra numa fila por ordem de chegada.

Monorepo com cinco superfícies (três web em Next.js, dois apps em Expo) sobre um
backend Supabase.

```bash
pnpm install
pnpm db:start
pnpm dev
```

- **[Próximos passos — por onde continuar](docs/proximos-passos.md)**
- [Setup local, passo a passo](docs/setup-local.md)
- [Arquitetura](docs/architecture.md)
- [Convenções](docs/conventions.md)
- [App do cliente: implementação do design](docs/mobile-cliente.md)
- [Roadmap do app do cliente: o que falta e em que ordem](docs/roadmap-mobile-cliente.md)
- [Por que a disponibilidade vive no Postgres](docs/decisions/0001-disponibilidade-no-postgres.md)
- [Navegação, ícones e entradas da Home no app do cliente](docs/decisions/0002-navegacao-e-icones-do-app-cliente.md)
- [Autenticação por e-mail, senha e código de 6 dígitos](docs/decisions/0003-autenticacao-por-codigo.md)
- [Catálogo, disponibilidade, reservas, fila e avaliações](docs/decisions/0004-catalogo-disponibilidade-fila.md)
- [Assistente com a API da OpenAI](docs/decisions/0005-assistente-openai.md)
- [Assistente: como ligar a chave](docs/assistente.md)
