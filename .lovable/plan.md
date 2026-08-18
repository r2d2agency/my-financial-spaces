# Plano de Correção: Módulo de Membros e Acessos

Corrigir o fluxo completo de convite, atribuição de permissão e isolamento multi-tenant, garantindo que usuários novos e existentes possam ser adicionados corretamente sem duplicação ou falhas de segurança.

## Alterações

### Banco de Dados (PostgreSQL)
- Atualizar `src/lib/init-db.server.ts` para garantir que `public.workspace_invites` tenha a coluna `token` (UNIQUE) e `expires_at`.
- Adicionar a coluna `status` (pending, accepted, expired, cancelled) se não existir.
- Garantir `UNIQUE(workspace_id, user_id)` na tabela `public.workspace_members`.

### Backend (Server Functions)
- **Novo `src/lib/workspace.server.ts`**: Lógica privada para manipulação de convites e tokens.
- **Novo `src/lib/workspace.functions.ts`**:
    - `inviteMember`: Verifica se o usuário existe. Se sim, cria membership. Se não, cria convite com token.
    - `acceptInvite`: Valida token, cria membership para o usuário autenticado e marca convite como aceito.
    - `listInvites`: Lista convites pendentes do workspace atual.
    - `cancelInvite`: Permite ao ADMIN/OWNER revogar um convite.
    - `updateMemberRole`: Altera a role de um membro existente.
    - `removeMember`: Remove a membership de um usuário.

### Frontend (UI/UX)
- **Refatorar `src/routes/_authenticated/configuracoes.tsx`**:
    - Implementar a nova interface de "Membros e Acessos" conforme especificado.
    - Modal de "Adicionar Membro" com seleção de Role (Administrador, Gestor, Operador, Visualizador).
    - Listagem unificada de Membros Ativos e Convites Pendentes.
    - Ações de Editar (Role) e Remover (Acesso).
- **Nova Rota `src/routes/invite.$token.tsx`**:
    - Página pública para aceitar o convite.
    - Se não logado, direciona para Auth.
    - Se logado, processa a aceitação e redireciona para o workspace.

### Segurança e Multi-tenant
- Validar permissões no `dbQuery` (especialmente para `workspace_members` e `workspace_invites`).
- Garantir que apenas OWNER/ADMIN possam convidar/remover membros.
- Normalização de e-mails (lowercase) em todos os fluxos.

## Detalhes Técnicos
- O token de convite será um `crypto.randomUUID()`.
- Expiração padrão de 7 dias.
- Uso de `dbQuery` e `createServerFn` para manter a consistência com a arquitetura atual.
