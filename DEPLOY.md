# Deploy no EasyPanel (PostgreSQL Local / Supabase Self-Hosted)

Este projeto está configurado para utilizar uma instância local do **PostgreSQL** (via Supabase Self-Hosted) no seu EasyPanel.

## 1. Configuração do Banco no EasyPanel
1. Instale o template **Supabase** no seu EasyPanel.
2. Certifique-se de que os serviços (Kong, GoTrue, PostgREST) estão rodando.
3. Obtenha a **URL Pública** do serviço Kong (porta 8000) e as chaves `anon` e `service_role`.

## 2. Variáveis de Ambiente (App)
No EasyPanel, configure as variáveis abaixo tanto em **Environment Variables** quanto em **Build Args** (necessário para o Vite):

| Variável | Valor Exemplo | Observação |
| :--- | :--- | :--- |
| `VITE_SUPABASE_URL` | `https://api.seu-dominio.com` | URL pública do Kong (porta 8000) |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | `eyJhbGci...` | Chave `anon` do seu banco |
| `SUPABASE_URL` | `http://kong:8000` | URL interna (se no mesmo Docker network) ou pública |
| `SUPABASE_ANON_KEY` | `eyJhbGci...` | Mesma que a Publishable Key |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJhbGci...` | Chave de admin do banco |
| `DATABASE_URL` | `postgresql://postgres:senha@db:5432/postgres` | Conexão direta ao Postgres |

## 3. Por que o erro de conexão local acontece?
Se o erro for `ERR_CONNECTION_REFUSED` em `localhost:8000`, significa que o **VITE_SUPABASE_URL** está definido como `localhost`. 
**Solução:** O frontend roda no navegador do seu cliente, então ele precisa de um domínio público (ex: `https://seu-supabase.host`) para alcançar o seu servidor.

## 4. Migrações
Execute o conteúdo da pasta `supabase/migrations/` diretamente no Editor SQL do seu Supabase local ou via `psql`.
