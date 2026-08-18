---
title: Etapa 2 - Reconstrução da Tela de Movimentações
description: Transformação da listagem de transações em uma central operacional financeira moderna e produtiva.
---

## Objetivo
Transformar a tela de `movimentacoes.tsx` em uma interface de alta produtividade, permitindo visão clara do período, filtros rápidos, busca eficiente e gestão detalhada via painel lateral.

## Design e UX
- **Azul OpenFinance**: Paleta focada em azul principal, brancos e cinzas sutis.
- **Hierarquia Visual**: Fim do excesso de cards e badges agressivos. Uso de badges discretos e tipografia limpa (Sora/Manrope).
- **Densidade**: Aumento da quantidade de informações visíveis (10-15 linhas por tela em desktop).
- **Responsividade**: Tabela estruturada no desktop e cards compactos no mobile.

## Funcionalidades Principais

### 1. Central Operacional
- **Cabeçalho Dinâmico**: Seletor de período (mês/ano) que atualiza toda a página via TanStack Query.
- **Faixa de Resumo**: Indicadores compactos (Resultado, Entradas, Saídas, A Receber, A Pagar) baseados em dados reais e status de liquidação.

### 2. Filtros e Busca
- **Abas Principais**: Filtro rápido por Todas, Receitas, Despesas e Transferências.
- **Busca Global**: Pesquisa por descrição, contato, categoria e valor com debounce.
- **Filtros Rápidos**: Status (Pendentes, Realizados, Atrasados).
- **Filtros Avançados**: Popover lateral/dropdown para filtros granulares (conta, data, valor, etc).

### 3. Gestão de Lançamentos
- **Tabela Moderna**: Colunas claras com badges de status e indicadores secundários (Recorrente, Parcela, Estimado).
- **Painel Lateral (Side Panel)**: Visualização de detalhes sem sair da página, com ações contextuais (Liquidar, Editar, Excluir).
- **Liquidação Rápida**: Diálogo compacto para marcar como pago/recebido (apenas data, conta e valor).
- **Reversão**: Opção de desfazer liquidação.
- **Gestão de Recorrências/Parcelas**: Lógica de escopo ("Somente esta" vs "Todas as futuras") para edição e exclusão.

## Detalhes Técnicos
- **TanStack Query**: Uso de `queryKey` composto por `workspace_id`, `start_date`, `end_date`, `search` e `filters`.
- **Server Functions**: Implementação de `liquidateTransaction` e `revertLiquidation` em `db.functions.ts`.
- **Componentização**:
  - `TransactionSummary.tsx`: Faixa de indicadores.
  - `TransactionTable.tsx` / `TransactionMobileList.tsx`: Visualizações de lista.
  - `TransactionDetailsDrawer.tsx`: Painel lateral de detalhes.
  - `TransactionFilters.tsx`: Gestão de estados de filtragem.

## Plano de Implementação

1. **Infraestrutura**:
   - Criar server functions para liquidação e reversão rápida.
   - Atualizar `db.functions.ts` para suportar filtros complexos e contagens por aba.
2. **Componentes Base**:
   - Desenvolver o novo componente de Resumo (`TransactionSummary`).
   - Implementar o sistema de Abas e Busca com debounce.
3. **Listagem Principal**:
   - Criar `TransactionTable` (Desktop) e `TransactionCard` (Mobile).
   - Implementar badges de status (Atrasado, Pago, Pendente).
4. **Detalhes e Ações**:
   - Desenvolver o `TransactionDetailsDrawer` (Sheet do shadcn).
   - Implementar diálogos de Liquidação Rápida e Confirmação de Exclusão (escopo recorrente).
5. **Integração na Rota**:
   - Substituir a interface atual em `src/routes/_authenticated/movimentacoes.tsx`.
   - Garantir que o formulário de "Novo Lançamento" atual continue funcionando via botão principal.

## Verificação
- Testar navegação entre meses e anos.
- Validar cálculos de indicadores (ignorando transferências e cancelados).
- Verificar comportamento mobile.
- Confirmar isolamento multi-tenant em todas as queries.
