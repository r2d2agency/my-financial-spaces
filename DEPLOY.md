# Configuração PostgreSQL Puro (EasyPanel)

Este app foi migrado de Supabase para **PostgreSQL Puro** rodando no seu EasyPanel.

## 1. Banco de Dados
Use a sua `DATABASE_URL` no EasyPanel:
`postgres://postgres:qx0hw7js8syz9axdmqf3@blaster_finace-gleego-bd:5432/finace-gleego-bd?sslmode=disable`

## 2. Tabelas Necessárias
Além das tabelas de negócio, você deve criar a tabela de sessões:
```sql
CREATE TABLE IF NOT EXISTS public.user_sessions (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

## 3. Variáveis de Ambiente no EasyPanel
Você **não precisa** das variáveis `VITE_SUPABASE_*`. O sistema foi totalmente desacoplado do Supabase Cloud e da API do Supabase auto-hospedado.

Mantenha apenas:
- `DATABASE_URL` (Sua string de conexão)
- `OPENAI_API_KEY` (Para a IA)
- `NODE_ENV=production`

## 4. Como funciona o Auth agora?
O sistema agora valida as sessões diretamente na tabela `user_sessions` do seu banco PostgreSQL. Não há chamadas para `localhost:8000`.
