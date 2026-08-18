# Plano de Refatoração: Fluxo de Edição de Movimentações

Implementar o fluxo completo de edição para a tela de Movimentações, garantindo que o botão de edição funcione, carregue os dados corretamente e respeite as regras de recorrência e multi-tenant.

## 1. Componentes e UI
- Criar `src/components/finance/TransactionDialog.tsx` como um formulário unificado (Novo/Editar).
  - Suportar todos os campos: Descrição, Valor, Datas, Status, Conta, Categoria, Contato, Notas.
  - Campos condicionais para **Recorrência** (Repetir até) e **Parcelamento** (Quantidade).
  - Títulos e labels dinâmicos ("Novo lançamento" vs "Editar lançamento", "Salvar" vs "Salvar alterações").
- Atualizar `TransactionDetailsDrawer.tsx` para disparar o modo edição.
  - Adicionar tooltips e `aria-label` nos ícones de Lápis e Lixeira.
  - Corrigir a área de clique dos botões.

## 2. Lógica de Negócio (Frontend)
- Adicionar estado `editingTransaction` em `movimentacoes.tsx`.
- Implementar diálogo de confirmação de escopo para itens recorrentes/parcelados.
  - Opções: "Somente este" e "Este e os próximos" (com indicação "Em breve" se necessário).

## 3. Backend e Segurança (db.functions.ts)
- Implementar a server function para `UPDATE` de transações.
  - Validar `workspace_id` e permissões do usuário.
  - Recalcular datas/status se necessário.
- Garantir que a query de atualização retorne o registro atualizado para refletir no UI imediatamente.

## 4. Integração e Refresh
- Utilizar `invalidateQueries` do TanStack Query para atualizar indicadores, abas e listagem.
- Garantir que o painel lateral (`Drawer`) seja atualizado com os novos dados sem fechamento forçado se o usuário não desejar.

## Detalhes Técnicos
- **Endpoint**: `db.from("transactions").update(...)` via adaptador `db-browser`.
- **Escopo de Recorrência**: Por segurança inicial, a edição de "Este e os próximos" será marcada como "Em breve" para evitar desbalanceamento de parcelas já liquidadas, focando na edição atômica garantida.
