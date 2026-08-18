# Refatoração do Módulo de Membros e Acessos

Este plano detalha a conclusão da refatoração do sistema de multi-tenant e permissões (RBAC), garantindo que o isolamento por espaço financeiro e as restrições por cargo (roles) funcionem corretamente.

## Alterações Propostas

### 1. Segurança e Roles (RBAC)
- **Bloqueio de Escrita para Viewer**: Finalizar a integração no adaptador `db.functions.ts` para impedir que usuários com cargo "Visualizador" realizem operações de modificação (Insert/Update/Delete).
- **Validação de Permissões no Workspace**: Garantir que as funções de convite e remoção de membros verifiquem se o solicitante tem cargo de `owner` ou `admin`.

### 2. Interface de Gestão (UI)
- **Correção da Tela de Configurações**: Investigar por que a seção "Membros e acessos" não está renderizando corretamente e garantir que a listagem de membros, convites pendentes e formulário de adição funcionem para usuários com permissão.
- **Visualização de Roles**: Melhorar a exibição dos cargos na listagem de membros com badges e descrições claras.

### 3. Fluxo de Convites
- **Convites via Token**: Implementar o processamento final do token na rota `/invite/$token` para que, ao aceitar, o usuário seja vinculado automaticamente ao workspace.
- **Aceitação Direta**: Para usuários que já estão logados e recebem um convite, permitir a aceitação simplificada.

## Detalhes Técnicos
- Atualizar `src/lib/db.functions.ts` para capturar a `role` do usuário no `verifyAuth` e usá-la para filtragem de privilégios.
- Refinar `src/routes/_authenticated/configuracoes.tsx` para tratar estados de carregamento e permissões de visualização.
- Garantir que a tabela `workspace_invites` no `init-db.server.ts` possua as colunas `token`, `status` e `expires_at`.

## Usuário e Design
- **Idioma**: Português (pt-BR).
- **Estilo**: Manter o tema "Azul OpenFinance" com componentes shadcn/ui.
