---
name: Reconstrução do Dashboard (Etapa 6)
description: Implementação completa da nova interface do Dashboard com indicadores reais, fluxo de caixa, projeções e alertas.
type: feature
---

# Reconstrução do Dashboard (Etapa 6)

A Etapa 6 consiste em transformar o dashboard decorativo em uma ferramenta de decisão financeira premium, utilizando dados reais do PostgreSQL e seguindo os princípios de UX definidos.

## Objetivos
- Responder rapidamente à situação financeira (Saldo, Entradas, Saídas, Resultado).
- Exibir alertas de atenção (Atrasos, faturas vencendo).
- Mostrar próximos compromissos e projeção de caixa determinística.
- Apresentar visão clara de contas e cartões.
- Garantir performance e isolamento multi-tenant.

## Arquitetura e Endpoints
Para evitar múltiplas requisições e garantir consistência, criaremos RPCs dedicadas no backend:

1.  **`get_dashboard_summary`**: Retorna indicadores principais, alertas, próximos compromissos, resumo de contas e cartões.
2.  **`get_dashboard_cash_flow`**: Retorna dados para o gráfico de fluxo de caixa (realizado vs previsto) e projeção de saldo.

## Detalhes Técnicos

### 1. Backend (`src/lib/db.functions.ts`)
- Implementar `get_dashboard_summary`:
    - **Saldo Atual**: Soma dos saldos das contas (usando lógica consolidada).
    - **Indicadores do Mês**: Entradas (recebidas), Saídas (pagas), Resultado, A Receber (pendentes), A Pagar (pendentes).
    - **Alertas**: Contagem e valor total de atrasados, faturas próximas do vencimento, saldo negativo.
    - **Próximos Compromissos**: Lista cronológica de transações pendentes e faturas.
    - **Resumo de Contas/Cartões**: Lista compacta para os cards laterais.
- Implementar `get_dashboard_cash_flow`:
    - Agregação por mês/dia para o gráfico Recharts.
    - Cálculo de projeção de saldo partindo do saldo atual e somando/subtraindo compromissos futuros conhecidos.

### 2. Frontend (`src/routes/_authenticated/dashboard.tsx`)
- Refatoração completa da UI usando Tailwind CSS e componentes shadcn.
- **Cabeçalho**: Seletor de período (Mês/Ano).
- **Indicadores**: Grid compacta com comparação (vs. mês anterior).
- **Atenção**: Alert Banner condicional para itens críticos.
- **Gráficos**: Fluxo de caixa limpo (Recharts) com toggle Realizado/Previsto.
- **Projeção**: Tabela/Lista de evolução de saldo estimada.
- **Ações Rápidas**: Atalhos para `TransactionDialog`.
- **Navegação**: Click-through em todos os cards para filtros em `/movimentacoes`.

### 3. Lógica de Negócio
- **Saldo Total**: Somente contas ativas. Cartões não somam saldo.
- **Resultado**: Receitas Recebidas - Despesas Pagas.
- **Projeção de Caixa**:
    - Saldo Atual + Receitas Pendentes - Despesas Pendentes - Faturas a Vencer.
    - Evitar duplicidade: Se uma compra está em uma fatura, a projeção usa o vencimento da fatura para o caixa bancário.

## Plano de Ação

1.  **Backend (RPCs)**: Adicionar `get_dashboard_summary` e `get_dashboard_cash_flow` ao `dbQuery`.
2.  **Componentes**: Criar componentes de apoio para o dashboard (`SummaryCards`, `AttentionAlerts`, `CashFlowChart`, `UpcomingTasks`).
3.  **Página Principal**: Reconstruir `dashboard.tsx` integrando as novas RPCs e layout.
4.  **Integração**: Garantir que as ações rápidas chamem o `TransactionDialog` corretamente.
5.  **Testes**: Validar todos os 13 testes obrigatórios definidos pelo usuário.
