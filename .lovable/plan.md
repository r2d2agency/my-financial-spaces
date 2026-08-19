# Plano de Refatoração - Etapa 7: Cadastros Financeiros

Esta etapa reorganiza Clientes, Fornecedores, Categorias, Centros de Custo e Tags para apoiar a gestão financeira com inteligência e flexibilidade.

## 1. Banco de Dados (PostgreSQL)

### Novas Tabelas e Estruturas
- **public.contacts**: Tabela unificada para Clientes e Fornecedores.
  - Campos: `id`, `workspace_id`, `name`, `trade_name`, `type` (PF/PJ), `document` (CPF/CNPJ), `email`, `phone`, `notes`, `status` (active/archived), `is_client` (bool), `is_provider` (bool).
- **public.cost_centers**: Centros de custo.
  - Campos: `id`, `workspace_id`, `name`, `description`, `code`, `status` (active/archived).
- **public.tags**: Tags flexíveis.
  - Campos: `id`, `workspace_id`, `name`.
- **public.transaction_tags**: Relacionamento N:N entre transações e tags.
  - Campos: `transaction_id`, `tag_id`.

### Alterações em Tabelas Existentes
- **public.categories**: Adicionar `status` (active/archived).
- **public.transactions**: Adicionar `contact_id` (FK para contacts), `cost_center_id` (FK para cost_centers).
- **public.recurring_transactions**: Garantir `contact_id`, `cost_center_id`.

## 2. Server Functions (RPCs)
- Refatorar `dbQuery` para suportar as novas tabelas.
- Criar RPCs específicas se necessário para buscas otimizadas e criação rápida.

## 3. Interface (Frontend)

### Módulo de Cadastros (`/cadastros`)
- Criar rota unificada `/cadastros` com subnavegação:
  - **Contatos**: Gestão de Clientes e Fornecedores (Filtros: Todos, Clientes, Fornecedores, Arquivados).
  - **Categorias**: Hierarquia de Receitas e Despesas.
  - **Centros de Custo**: Listagem moderna.
  - **Tags**: Gestão simples de etiquetas.

### Integração com Lançamentos
- **TransactionDialog**:
  - Substituir campo de texto de Cliente/Fornecedor por Search/Select de `contacts`.
  - Adicionar suporte a `cost_center_id`.
  - Adicionar seletor múltiplo para `tags`.
  - Implementar "Criação Rápida" para Contatos, Categorias e Centros de Custo diretamente no diálogo.

### Detalhes e Filtros
- Tela de detalhes do Contato com histórico de movimentações.
- Integração de filtros de Contato, Centro de Custo e Tags na tela de Movimentações.

## Detalhes Técnicos
- **Normalização**: Máscaras para CPF/CNPJ e Telefone no frontend; armazenamento limpo no banco.
- **Segurança**: RLS estrito por `workspace_id` em todas as novas tabelas e relacionamentos.
- **Arquivamento**: Implementar lógica de arquivamento em vez de exclusão para registros com histórico.
- **Multi-tenant**: Garantir isolamento total entre workspaces.

