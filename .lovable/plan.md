# Plano de Refatoração Financeira - Etapa 1: Arquitetura e Multi-tenancy

O objetivo desta etapa é consolidar a base de dados e a segurança do módulo financeiro, garantindo isolamento multi-tenant rigoroso e uma estrutura de dados preparada para as funcionalidades avançadas de parcelamento, recorrência e auditoria.

## Auditoria da Estrutura Atual
- **Tabelas**: `workspaces`, `workspace_members`, `transactions`, `financial_accounts`, `categories`, `contacts`, `recurring_transactions`, `budgets`, `financial_goals`, `credit_cards`, `cost_centers`.
- **Auth**: Sistema local em `auth.users` e `user_sessions`.
- **Multi-tenancy**: Implementado via coluna `workspace_id` na maioria das tabelas, mas precisa de reforço no backend e validação cruzada.
- **Transações**: Suporta `income`, `expense`, `transfer`, `refund`, `card_payment`. Status `pending`, `paid`.

## Alterações Propostas

### 1. Reforço do Banco de Dados (PostgreSQL)
Ajustar `src/lib/init-db.server.ts` para garantir:
- **Constraints**: FKs com `ON DELETE CASCADE` e `NOT NULL` em `workspace_id`.
- **Status Financeiro**: Adição de campos para `A_RECEBER`, `ATRASADO` (calculado), `RECEBIDO`, `PENDENTE`, `PAGO`.
- **Liquidação**: Colunas `paid_date` (já existe) e `actual_amount` (para pagamentos parciais).
- **Recorrência e Parcelamento**: Melhorar relacionamento entre `transactions` e `recurring_transactions`. Adicionar `installment_number`, `total_installments`, `parent_transaction_id`.
- **Auditoria**: Adicionar `created_by`, `updated_by`, `updated_at` em todas as tabelas financeiras relevantes.
- **Transferências**: Garantir que `transfer_id` vincule os dois lados e que o tipo `transfer` não impacte cálculos de DRE.

### 2. Segurança e Backend (Server Functions)
- **Middleware de Workspace**: Refatorar `verifyAuth` em `src/lib/db.functions.ts` para validar se o `userId` tem acesso ao `workspace_id` solicitado em cada operação.
- **Validação Cruzada**: Nas operações de escrita (INSERT/UPDATE), verificar se as entidades relacionadas (conta, categoria, cliente) pertencem ao mesmo `workspace_id`.
- **Níveis de Permissão**: Atualizar `workspace_role` enum para incluir `OWNER`, `ADMIN`, `MANAGER`, `OPERATOR`, `VIEWER`.

### 3. Modelo de Negócio (Server Logic)
- **Recorrência**: Implementar lógica de geração de ocorrências segura (gerar apenas conforme necessário ou em janelas).
- **Parcelamento**: Refatorar criação de parcelas para manter o vínculo com a transação original.
- **Auditoria**: Implementar trigger ou lógica manual no `dbQuery` para registrar quem alterou os dados.

## Detalhes Técnicos
- Utilização de `numeric(14,2)` para valores monetários (mantendo o padrão atual).
- Manutenção da compatibilidade com `db-browser.ts` para evitar quebras no frontend atual.
- As alterações serão incrementais via `init-db.server.ts` (sem reset de banco).

## O que NÃO será feito agora
- Redesenho de UI/Dashboard/Modais.
- IA Financeira ou Relatórios visuais novos.
- Alteração no fluxo de login/cadastro ou planos SaaS.
