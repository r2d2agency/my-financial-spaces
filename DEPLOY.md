# Deploy no EasyPanel (PostgreSQL Local / Supabase Self-Hosted)

Este projeto está configurado para utilizar uma instância local do **PostgreSQL** (via Supabase Self-Hosted) no seu EasyPanel.

## 1. Configuração do Banco no EasyPanel
1. Instale o template **Supabase** no seu EasyPanel.
2. Certifique-se de que os serviços (Kong, GoTrue, PostgREST) estão rodando.
3. Obtenha a **URL Pública** do serviço Kong (porta 8000) e as chaves `anon` e `service_role`.

## 2. Variáveis de Ambiente no EasyPanel

Você deve configurar as variáveis em dois lugares no EasyPanel para que o app funcione:

### A. Build Args (Advanced -> Build Args)
*Essas são fixadas no código do navegador durante o build.*

```env
VITE_SUPABASE_URL=https://[DOMINIO-PÚBLICO-DO-SEU-SUPABASE-KONG]
VITE_SUPABASE_PUBLISHABLE_KEY=[SUA-ANON-KEY]
```

### B. Environment Variables (Runtime)
*Essas são usadas pelo servidor para conectar no banco.*

```env
DATABASE_URL=postgres://postgres:qx0hw7js8syz9axdmqf3@blaster_finace-gleego-bd:5432/finace-gleego-bd?sslmode=disable
NODE_ENV=production
HOST=0.0.0.0
PORT=3000
SUPABASE_URL=https://[DOMINIO-PÚBLICO-DO-SEU-SUPABASE-KONG]
SUPABASE_ANON_KEY=[SUA-ANON-KEY]
SUPABASE_SERVICE_ROLE_KEY=[SUA-SERVICE-ROLE-KEY]
OPENAI_API_KEY=[SUA-CHAVE-OPENAI]
```

---

## 3. Por que o erro de conexão local acontece?
Se o erro for `ERR_CONNECTION_REFUSED` em `localhost:8000`, significa que o **VITE_SUPABASE_URL** está definido como `localhost`. 
**Solução:** O frontend roda no navegador do seu cliente, então ele precisa de um domínio público (ex: `https://seu-supabase.host`) para alcançar o seu servidor.

## 4. Migrações
Execute o conteúdo da pasta `supabase/migrations/` diretamente no Editor SQL do seu Supabase local ou via `psql`.

## 5. Painel administrativo da plataforma (`/admin`)
O painel interno exige o papel `platform_admin` na tabela `user_roles`. Acesse `/admin` após o deploy para fazer o bootstrap do primeiro administrador.
