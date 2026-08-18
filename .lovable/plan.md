# Etapa 3: Reconstrução Completa do Fluxo de Novo/Editar Lançamento

Este plano detalha a reconstrução da experiência de criação e edição de lançamentos financeiros, focando em simplicidade operacional e suporte a recursos avançados (recorrência, parcelamento, transferências) conforme solicitado.

## 1. Interface e Experiência do Usuário (UI/UX)
- **Componente Unificado**: Criar um novo componente de diálogo (`TransactionDialog`) que suporte tanto a criação quanto a edição de lançamentos.
- **Seletor de Tipo**: Implementar um seletor visual (`Receita | Despesa | Transferência`) em vez de um dropdown.
- **Formulário Dinâmico**:
    - Campos essenciais visíveis (Descrição, Valor, Vencimento, Categoria, Conta).
    - Labels contextuais: "Conta de recebimento" para Receitas, "Conta de pagamento" para Despesas.
    - Seção "Mais opções" recolhida para campos avançados (Competência, Centro de Custo, Observações, Recorrência, Parcelamento).
- **Status Inteligente**: Substituir o campo "Status" por um checkbox simples: "Já recebi este valor" ou "Já paguei esta despesa".
- **Drawer no Mobile**: Adaptar a interface para drawers ou telas cheias em dispositivos móveis.

## 2. Lógica e Funcionalidades
- **Transferências**: Formulário específico com campos de "Conta de origem" e "Conta de destino".
- **Criação Rápida**: Atalhos (`+`) para criar Clientes/Fornecedores, Categorias e Contas diretamente do formulário de lançamento.
- **Parcelamento Inteligente**: Cálculo automático de parcelas com ajuste de arredondamento na última parcela para garantir o valor total exato.
- **Recorrência**: Interface para frequências diversas (Semanal, Mensal, etc.) integrada à arquitetura de `recurring_transactions`.
- **Validações**: Regras rigorosas de preenchimento e proteção contra cliques duplos (idempotência no frontend).

## 3. Integração e Backend
- **Multi-tenant**: Garantir que todos os campos (Conta, Categoria, Cliente, etc.) pertençam ao workspace atual.
- **Transacionalidade**: Operações atômicas para criar o lançamento e sua liquidação simultaneamente quando marcado como pago/recebido.
- **Edição de Série**: Diálogo de confirmação ao editar lançamentos recorrentes/parcelados ("Somente este" vs "Este e os próximos").

## 4. Testes e Validação
- Testar fluxos de Receita/Despesa futura e realizada.
- Validar transferências entre contas.
- Verificar cálculos de parcelamento e arredondamento.
- Confirmar isolamento entre workspaces.
