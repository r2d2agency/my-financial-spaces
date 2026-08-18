---
name: Etapa 4 - Módulo de Contas
description: Reconstrução do módulo de contas com lógica de saldos calculados e transferências.
type: feature
---

# Etapa 4 - Reconstrução do Módulo de Contas

## Objetivos
- Gestão de contas (Nubank, Carteira, Investimentos, etc.).
- Saldo calculado: `Saldo = Saldo Inicial + Entradas Liquidadas - Saídas Liquidadas + Transferências Recebidas - Transferências Enviadas`.
- Transferência entre contas com transação atômica.
- Arquivamento de contas (não excluir se houver histórico).
- Extrato detalhado por conta com saldo progressivo.

## Regras de Negócio
- Saldo inicial com data de referência.
- Não permitir edição manual do saldo atual.
- Saldo atual considera apenas movimentações com status 'paid'.
- Transferências não afetam receitas/despesas, apenas o saldo das contas envolvidas.
- Multi-tenant rigoroso por `workspace_id`.

## Estrutura Técnica
- Tabela `public.financial_accounts` já existe, mas precisa de validação de campos.
- Tabela `public.transactions` centraliza movimentações e transferências (via `transfer_id` e `type='transfer'`).
- Novo componente `AccountDetails` para visão de extrato.
- RPC `execute_transfer` já existe no `db.functions.ts` mas será revisado.
