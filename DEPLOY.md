# Deploy no EasyPanel (auto-hospedagem)

O app é full-stack (frontend + API no mesmo processo TanStack Start/Nitro).
O build usa o preset `node-server`, então roda em qualquer host Node/Docker.

## 1. Criar o app no EasyPanel
1. `+ Service` → `App`.
2. Source: seu repositório GitHub (branch `main`).
3. Build: **Dockerfile** (o `Dockerfile` da raiz já está pronto).
4. Port: **3000**.
5. Domain: adicione seu domínio e ative HTTPS (Let's Encrypt).

## 2. Variáveis de ambiente
Copie de `.env.example`. Importante: as `VITE_*` são embutidas no build,
então no EasyPanel marque-as também como **Build Args** (Advanced → Build Args):

```
VITE_SUPABASE_URL=https://seu-dominio-supabase.host (URL PÚBLICA do seu Supabase no EasyPanel)
VITE_SUPABASE_PUBLISHABLE_KEY=sua-anon-key-real
VITE_SUPABASE_PROJECT_ID=seu-id
```

E como env de runtime:

```
NODE_ENV=production
HOST=0.0.0.0
PORT=3000
SUPABASE_URL=http://IP-DO-EASYPANEL:8000
SUPABASE_ANON_KEY=sua-anon-key
SUPABASE_SERVICE_ROLE_KEY=sua-service-role-key
DATABASE_URL=postgresql://postgres:senha@IP-DO-EASYPANEL:5432/postgres
OPENAI_API_KEY=sua-chave-aqui
```

> **Nota sobre PostgreSQL:** Se estiver usando o template Supabase no EasyPanel, o `VITE_SUPABASE_URL` e `SUPABASE_URL` devem apontar para a porta da API do Kong (geralmente `8000`). O `DATABASE_URL` aponta direto para o banco (porta `5432`).

## 3. Banco de dados
Duas opções:
- **Supabase Cloud** (mais simples): use a URL/keys do projeto.
- **Supabase self-hosted no EasyPanel**: crie o template Supabase, rode as migrações
  de `supabase/migrations/` (na ordem) via SQL editor ou `psql`, e aponte as env vars
  para essa instância.

## 4. Auth
Em Authentication → URL Configuration, defina:
- Site URL: `https://seu-dominio.com`
- Redirect URLs: `https://seu-dominio.com/**`

## 5. Local
```bash
cp .env.example .env
docker compose up --build
# http://localhost:3000
```

## Painel administrativo da plataforma (`/admin`)

O painel interno (clientes, planos, assinaturas, suporte e auditoria) exige o papel
`platform_admin` na tabela `user_roles`.

1. Faça login com a conta que será a administradora da plataforma.
2. Acesse `/admin`. Enquanto não existir nenhum `platform_admin`, a tela oferece o botão
   **"Tornar-me administrador da plataforma"** (bootstrap de primeira instalação).
3. Depois do primeiro admin, novos administradores devem ser adicionados diretamente no banco:

```sql
insert into public.user_roles (user_id, role)
values ('<uuid-do-usuario>', 'platform_admin');
```

Todas as ações administrativas (suspender cliente, alterar plano/assinatura, criar ou editar
plano, enviar mensagem de suporte) são gravadas em `audit_logs`.
