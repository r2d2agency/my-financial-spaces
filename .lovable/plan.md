# Plano de Refatoração: Etapa 5 - Módulo de Cartões de Crédito e Faturas

Este plano detalha a reconstrução completa do módulo de cartões de crédito, garantindo consistência financeira (não duplicar despesas no pagamento da fatura), gestão de limites, parcelamento e faturas.

## Objetivos
- Reconstruir a tabela `credit_cards` e criar `credit_card_invoices` (faturas).
- Implementar lógica de fechamento/vencimento robusta (considerando meses curtos e bissextos).
- Integrar compras no cartão ao fluxo de `transactions` sem afetar o saldo bancário imediatamente.
- Implementar o pagamento de fatura como uma liquidação de obrigação (reduz saldo da conta, quita fatura, não gera nova despesa).
- Interface moderna baseada em cards com visão de limite e faturas futuras.

## Alterações Técnicas

### 1. Banco de Dados (`src/lib/init-db.server.ts`)
- **Tabela `credit_cards`**: Adicionar `institution`, `last_digits`, `default_payment_account_id`.
- **Tabela `credit_card_invoices`**:
    - `id`, `workspace_id`, `card_id`.
    - `period_month`, `period_year`.
    - `due_date`, `closing_date`.
    - `status` (open, closed, paid, overdue, partial).
    - `amount` (total da fatura).
- **Tabela `transactions`**:
    - Adicionar `invoice_id` (vinculado a `credit_card_invoices`).
    - Garantir que compras em cartão tenham `type = 'expense'` e `status = 'pending'` (ou um novo status se necessário, mas 'pending' resolve pois não afeta saldo).

### 2. Backend / Server Functions (`src/lib/db.functions.ts`)
- **`get_or_create_invoice`**: Função para localizar a fatura correta baseada na data da compra e regras de fechamento do cartão.
- **`create_card_purchase`**: Handler para compras (à vista ou parceladas). Se parcelado, cria múltiplas transações vinculadas às faturas futuras.
- **`pay_card_invoice`**: Handler atômico que:
    1. Cria uma transação de liquidação (tipo `card_payment` ou `transfer`) saindo da conta bancária.
    2. Atualiza o status da fatura para `paid`.
    3. (Opcional) Recompõe o limite do cartão.
- **`get_card_details`**: Retorna limites (total, utilizado, disponível) calculados dinamicamente ou via cache.

### 3. Frontend / UI
- **Página de Cartões (`src/routes/_authenticated/cartoes.tsx`)**:
    - Listagem em cards compactos.
    - Indicadores de topo (Faturas atuais, Próximos vencimentos, Limite disponível).
- **Diálogo de Novo Cartão**: Campos conforme requisitos (Fechamento, Vencimento, Limite, Conta Padrão).
- **Detalhe da Fatura**: Listagem de compras daquela fatura específica, navegação entre meses.
- **Diálogo de Pagamento de Fatura**: Seleção de conta e valor.
- **Integração no `TransactionDialog.tsx`**: Quando forma de pagamento for "Cartão", ocultar conta bancária e mostrar seletor de cartão.

## Regras de Negócio Críticas
- **Limite**: Compra de R$ 3.000 em 10x compromete R$ 3.000 do limite total imediatamente.
- **Fechamento**: Compra no dia 04/08 com fechamento dia 03 entra na fatura de Setembro.
- **Duplicidade**: O pagamento da fatura NÃO é uma categoria de despesa; é uma transferência de fundos para quitar uma dívida já contabilizada pelas compras individuais.

## Cronograma de Trabalho
1. Atualização do Schema e Seed.
2. Implementação das funções de lógica de faturas e pagamentos no backend.
3. Reconstrução da UI de Cartões e Faturas.
4. Atualização do `TransactionDialog` para suportar compras em cartão.
5. Testes de regressão (Saldo Bancário vs Limite de Cartão).

NÃO avance automaticamente para outra etapa.
