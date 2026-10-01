# Finalização do Vez — auditoria de 30/09/2026

## Objetivo e critério de pronto

Concluir as lacunas de código verificáveis do marketplace, manter uma interface
coerente e familiar nas cinco superfícies e separar implementação de operação em
produção. Este documento substitui as afirmações de prontidão dos relatórios
históricos; configuração externa só será marcada como validada com evidência.

Orquestração Orca: `run_f16798fb6003`. Frentes Claude para web, mobile e
backend; coordenação responsável por integração, documentação e verificações.

## Diagnóstico inicial, antes da implementação

| Prioridade | Lacuna                                          | Evidência inicial                                                                                               | Ação                                                                    |
| ---------- | ----------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| Alta       | Documentação contraditória sobre prontidão      | `proximos-passos.md` declara conclusão, mas lista IA e produção pendentes; `setup-local.md` descreve web antiga | Consolidar estado e atualizar instruções                                |
| Alta       | Sem verificação automática em PR                | Não existe `.github/workflows`                                                                                  | Acrescentar CI de tipos, lint, testes, build e banco local              |
| Alta       | Assistente e histórico sem conclusão comprovada | Roadmap lista histórico pendente                                                                                | Auditar implementação, concluir e testar sem consumir API paga          |
| Alta       | Cobrança sem provedor/modelo fechado            | Portal informa ausência de cobrança; banco contém apenas modelo básico                                          | Solicitar decisão, não simular assinatura ou repasse                    |
| Alta       | Produção depende de configuração externa        | SMTP, push/EAS, deploy, domínio e identificação da empresa constam pendentes                                    | Checklist verificável, sem publicar silenciosamente                     |
| Média      | UX e acessibilidade sem revisão atual           | Cinco superfícies e componentes próprios                                                                        | Auditar navegação, formulários, diálogo, foco, responsividade e estados |

O primeiro baseline passou: tipos e lint em sete pacotes e **73 testes**.
Isso não prova prontidão visual nem integração de produção. O runtime local de
containers estava desligado e foi iniciado sem reset do banco existente.

## Frentes e evidências

- Web: `docs/auditoria-web-2026-09-30.md` — portal, admin e landing.
- Mobile: `docs/auditoria-mobile-2026-09-30.md` — cliente e estabelecimento.
- Backend: `docs/auditoria-backend-2026-09-30.md` — Supabase e assistente.
- Integração: resultado consolidado ao final desta execução.

Cada frente deve registrar achados antes das alterações, atualizar resolução e
informar o que realmente foi testado. Bibliotecas novas só entram quando resolvem
uma necessidade concreta; preservar a identidade visual e os componentes existentes.

## Pendências externas para lançar

- [ ] Definir cobrança do SaaS (mensalidade, comissão ou fase sem cobrança).
- [ ] Configurar e verificar SMTP de autenticação e e-mail transacional.
- [ ] Configurar e verificar credenciais Expo/EAS e push em aparelho real.
- [ ] Verificar acesso e saldo da API do assistente em ambiente de homologação.
- [ ] Aplicar migrations e Edge Functions em homologação e produção.
- [ ] Definir domínio, URLs de retorno, identificação da empresa e contatos.
- [ ] Revisar termos e privacidade e publicar os aplicativos nas lojas.

Não há autorização nesta execução para contratar provedores, cobrar usuários ou
publicar o produto. Essas ações exigem os dados e decisões do responsável.
