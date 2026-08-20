# Plano de Refatoração: Etapa 8 - Planejamento Financeiro

Este plano descreve a reconstrução do módulo de Planejamento Financeiro para suportar a comparação detalhada entre Planejado, Previsto e Realizado, com foco em usabilidade e precisão multi-tenant.

## 1. Alterações no Banco de Dados (PostgreSQL)

Atualizar `src/lib/init-db.server.ts` para garantir a estrutura necessária:
- Criar ou ajustar a tabela `public.budgets` (já existe parcialmente, mas garantiremos as colunas).
- Adicionar auditoria básica se necessário (meta-informações).
- Garantir que as queries de dashboard e planejamento usem casts `::text` para enums para evitar erros de tipo.

## 2. Lógica de Backend (RPCs em `src/lib/db.functions.ts`)

Criar novos handlers em `dbQuery` para:
- `get_financial_planning`: Retorna o resumo do mês contendo:
    - Lista de categorias com valores Planejado, Previsto (pending), Realizado (paid) e Comprometido.
    - Indicadores de Receitas e Despesas totais.
    - Projeção de fechamento.
- `save_budget_item`: Salva ou atualiza o planejado para uma categoria específica.
- `copy_previous_budget`: Copia os valores planejados do mês anterior para o mês atual.

## 3. Reconstrução da Interface (`src/routes/_authenticated/planejamento.tsx`)

Redesenhar a tela seguindo a nova identidade visual:
- **Cabeçalho**: Seletor de mês/ano moderno com navegação rápida.
- **Resumo**: Cards compactos com Receitas Planejadas, Despesas Planejadas, Resultado Planejado, Previsto e Realizado.
- **Lista de Categorias**: 
    - Separada por Receitas e Despesas.
    - Barra de progresso semântica (Verde -> Amarelo -> Vermelho discreto).
    - Exibição de Planejado, Realizado e Disponível/Excedido.
    - Edição inline do valor planejado.
- **Detalhamento**: Painel lateral (Drawer) ao clicar em uma categoria mostrando a lista de transações que compõem o valor realizado/previsto.

## 4. Melhorias de Usabilidade
- Implementar a função de "Copiar Mês Anterior".
- Garantir responsividade total (cards no mobile).
- Adicionar alertas visuais para orçamentos próximos do limite ou estourados.

## Detalhes Técnicos
- Utilização de `TanStack Query` para gerenciamento de estado e cache por `[wsId, year, month]`.
- Separação rigorosa de `transfer` e `card_payment` para evitar contagem dupla ou incorreta.
- Resiliência a enums do PostgreSQL usando casts explícitos.
