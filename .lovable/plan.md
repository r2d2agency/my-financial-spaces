# Plano de Refatoração: Gestão de Membros (Criação Direta)

O usuário relatou um erro `column "expires_at" does not exist` (apesar de existir no schema, pode haver dessincronização) e expressou a preferência de criar usuários/senhas manualmente para convidados, em vez de depender apenas de links de convite.

## Alterações propostas

### 1. Banco de Dados e Backend
- **Tornar `expires_at` opcional**: Ajustar `workspace_invites` para permitir convites sem expiração.
- **Nova Server Function `createMemberWithAccount`**:
  - Recebe Nome, E-mail, Senha e Permissão.
  - Verifica se o e-mail já existe.
  - Se não existir, cria a conta em `auth.users` (com hash de senha).
  - Cria o perfil em `public.profiles`.
  - Adiciona o usuário ao Workspace em `public.workspace_members`.
  - Marca como `must_change_password` para que o convidado mude a senha no primeiro acesso.

### 2. Interface (Configurações)
- **Refatoração do formulário "+ Adicionar membro"**:
  - Adicionar campos de **Nome** e **Senha**.
  - Manter o campo de **E-mail** e **Permissão**.
  - O botão passará a criar a conta e o acesso instantaneamente.
- **Melhoria visual**: Ajustar a exibição de convites pendentes para tratar datas nulas.

## Detalhes Técnicos
- Utilizar `bcryptjs` para hashing no backend (já configurado no projeto).
- Manter o isolamento multi-tenant validando o `workspace_id` do administrador.
- Atualizar `init-db.server.ts` para garantir que o schema suporte a criação direta.

O fluxo de convite via link continuará existindo como fallback (copiar link), mas a criação direta será o padrão preferido pelo usuário.
