# Plano de Refatoração - Etapa 7: Cadastros Financeiros

Esta etapa reorganiza Clientes, Fornecedores, Categorias, Centros de Custo e Tags para apoiar a gestão financeira com inteligência e flexibilidade.

## 1. Banco de Dados (PostgreSQL)

### Novas Tabelas e Estruturas
- **public.contacts**: Tabela unificada para Clientes e Fornecedores.
  - Campos: `id`, `workspace_id`, `name`, `trade_name`, `person_type` (PF/PJ), `document`, `email`, `phone`, `notes`, `status` (active/archived), `is_client`, `is_provider`.
- **public.cost_centers**: Centros de custo.
  - Campos: `id`, `workspace_id`, `name`, `description`, `code`, `status` (active/archived).
- **public.tags**: Tags flexíveis.
  - Campos: `id`, `workspace_id`, `name`.
- **public.transaction_tags**: Relacionamento N:N entre transações e tags.
  - Campos: `transaction_id`, `tag_id`.

### Alterações em Tabelas Existentes
- **public.categories**: Adicionar `status` (active/archived).
- **public.transactions**: Adicionar `contact_id`, `cost_center_id`.
- **public.recurring_transactions**: Adicionar `contact_id`, `cost_center_id`.

## 2. Server Functions (RPCs)
- Refatorar `dbQuery` para suportar as novas tabelas e filtros.
- Garantir que as queries respeitem o `workspace_id`.

## 3. Interface (Frontend)

### Módulo de Cadastros (`/cadastros`)
- Criar rota unificada `/cadastros` com abas para:
  - **Contatos**: Listagem de Clientes e Fornecedores com filtros.
  - **Categorias**: Organização de Receitas e Despesas.
  - **Centros de Custo**: Listagem e edição.
  - **Tags**: Gestão simplificada.

### Integração com Lançamentos
- **TransactionDialog**:
  - Seletor de Contato (Cliente/Fornecedor) com busca.
  - Seletor de Centro de Custo.
  - Seletor múltiplo de Tags.
  - Atalhos para criação rápida de novos registros.

### Detalhes do Contato
- Visualização de histórico financeiro por contato (Entradas/Saídas/Saldo).

## Detalhes Técnicos
- **Segurança**: RLS em todas as tabelas.
- **UX**: Máscaras de entrada e feedback visual de status.
- **Arquivamento**: Impede a exclusão de registros com histórico, permitindo apenas o arquivamento.
