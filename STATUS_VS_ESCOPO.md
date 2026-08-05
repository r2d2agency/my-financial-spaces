# ESPAÇO FINANCEIRO — Status Real vs. Escopo Documentado

Resposta curta: **não, ainda não temos tudo isso.** O escopo enviado é o produto completo
(fases 1 a 6). Hoje temos uma parte da Fase 1 e pedaços de Fase 2 e 5.
Abaixo o inventário honesto do que existe no código hoje.

Legenda: ✅ pronto · 🟡 parcial · ❌ não existe

---

## 1. Base técnica

| Item | Status | Observação |
|---|---|---|
| Frontend React + TanStack Start/Router/Query | ✅ | Vite 7, React 19 |
| Tailwind + Shadcn UI + Recharts | ✅ | design tokens azul OpenFinance |
| PostgreSQL puro (`pg.Pool`) | ✅ | `src/lib/db.server.ts` |
| Docker / EasyPanel | ✅ | `Dockerfile`, `docker-compose.yml`, `DEPLOY.md` |
| Autenticação local (sessões em banco) | 🟡 | funciona; falta hash Argon2, 2FA, bloqueio de tentativas, reset de senha |
| Migrations versionadas | ❌ | hoje é criação automática no boot (`init-db.server.ts`) — risco em produção |
| Storage S3 para anexos | ❌ | nenhum upload de arquivo implementado |
| Redis / filas / worker assíncrono | ❌ | OCR e relatórios rodam sincronamente |
| Row Level Security | ❌ | isolamento hoje é por `workspace_id` na query, validado na aplicação |

## 2. Multiusuário e permissões

| Item | Status |
|---|---|
| Cadastro de usuário e login | ✅ |
| Criar múltiplos espaços e alternar entre eles | ✅ |
| Tabela de membros com papéis (owner/admin/editor/viewer/consultant) | 🟡 estrutura existe, UI de gestão é básica |
| Convites por e-mail (`workspace_invites`) | 🟡 tabela existe, fluxo de aceite não |
| Permissões granulares por ação | ❌ |
| Visibilidade privada por conta/lançamento | ❌ |
| Tipos de espaço (pessoal/familiar/negócio) | ❌ |
| Visão consolidada de vários espaços | ❌ |

## 3. Operação financeira

| Item | Status |
|---|---|
| Contas financeiras (tipos, saldo inicial) | ✅ |
| Categorias com cor + cadastro rápido "+" no lançamento | ✅ |
| Receitas e despesas | ✅ |
| Lançamento rápido (FAB mobile) | ✅ |
| Recorrentes fixos e variáveis com estimativa | ✅ |
| Vínculo de cliente/fornecedor (`person_name`) | ✅ |
| Transferências entre contas | 🟡 tipo existe no enum, tela dedicada não |
| Cartões de crédito e faturas | 🟡 tabela + rota `/cartoes`, sem ciclo de fatura real |
| Dívidas e parcelamentos | 🟡 cadastro e listagem; sem simulador/juros/avalanche |
| Pagamentos parciais | ❌ |
| Estorno / reembolso vinculado | ❌ |
| Conciliação bancária | ❌ |
| Divisão de despesas entre membros | ❌ |
| Centros de custo / tags / subcategorias | ❌ |
| Assinaturas (visão dedicada) | ❌ |

## 4. Planejamento e inteligência

| Item | Status |
|---|---|
| Dashboard com resumo e gráficos | ✅ |
| Relatórios com histórico e projeção 3/6 meses | ✅ |
| Calendário financeiro | 🟡 visão mensal simples |
| Orçamento por categoria/membro com alertas | ❌ |
| Projeção diária, cenários e simulações | ❌ |
| "Disponível para gastar com segurança" | ❌ |
| Metas financeiras (tabela existe, UI não) | 🟡 |
| Reserva de emergência | ❌ |
| Patrimônio (ativos/passivos) | ❌ |
| OCR de comprovantes via OpenAI | 🟡 `ai.functions.ts` pronto, sem armazenamento do arquivo |
| Categorização automática / assistente / análise de comportamento | ❌ |
| Importação OFX/CSV/Excel | ❌ |
| Pesquisa global | ❌ |
| Notificações configuráveis | 🟡 tabela + sino no shell, sem regras automáticas |
| Auditoria (`audit_logs`) | 🟡 tabela existe, gravação parcial |

## 5. SaaS

| Item | Status |
|---|---|
| Painel `/admin` (clientes, planos, auditoria) | ✅ |
| Planos cadastrados (Individual/Família/Premium/Profissional) | ✅ seed |
| Assinaturas em trial de 30 dias | ✅ automático ao criar espaço |
| Limites por plano aplicados de fato | ❌ |
| Cobrança / cupons / inadimplência | ❌ |

---

## Próximos sprints sugeridos (ordem recomendada)

**Sprint A — Fechar a Fase 1**
Migrations versionadas, hash de senha Argon2id, transferências, conciliação simples,
subcategorias, tags e centros de custo.

**Sprint B — Planejamento (Fase 2)**
Orçamento mensal com alertas, metas com aportes, projeção diária + cenários,
indicador de "disponível seguro", simulador de quitação de dívidas.

**Sprint C — Gestão familiar (Fase 3)**
Divisão de despesas, reembolsos, permissões granulares, visibilidade privada,
gastos por membro.

**Sprint D — Automação (Fase 4)**
Storage S3, anexos, OCR com fila, importação OFX/CSV, categorização automática,
detecção de duplicidades, assistente financeiro.

**Sprint E — SaaS (Fase 5)**
Limites por plano, cobrança, cupons, controle de uso de IA.
