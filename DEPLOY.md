# Configuração PostgreSQL Puro (EasyPanel)

Este app foi migrado de Supabase para **PostgreSQL Puro** rodando no seu EasyPanel.

## 1. Banco de Dados
Use a sua `DATABASE_URL` no EasyPanel:
`postgres://postgres:qx0hw7js8syz9axdmqf3@blaster_finace-gleego-bd:5432/finace-gleego-bd?sslmode=disable`

## 2. Inicialização Automática
O sistema inicializa as tabelas automaticamente no primeiro acesso após o deploy através do script em `src/lib/init-db.server.ts`. 

Se precisar rodar manualmente, o schema completo está em `DOCUMENTACAO_GERAL.md` ou pode usar o bloco abaixo:

```sql
-- Principais tabelas para funcionamento dos módulos
CREATE TABLE IF NOT EXISTS public.recurring_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL,
    type TEXT NOT NULL DEFAULT 'expense',
    description TEXT NOT NULL,
    amount NUMERIC(14,2) NOT NULL,
    is_fixed BOOLEAN NOT NULL DEFAULT true,
    day_of_month INTEGER NOT NULL DEFAULT 5,
    category_id UUID,
    account_id UUID,
    person_name TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Certifique-se de que a tabela transactions tenha as colunas de vínculo
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS recurring_id UUID;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS is_estimated BOOLEAN DEFAULT false;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS person_name TEXT;
```

## 3. Variáveis de Ambiente no EasyPanel
O sistema foi totalmente desacoplado do Supabase Cloud.

**Environment Variables (Runtime):**
- `DATABASE_URL`: Sua string de conexão.
- `OPENAI_API_KEY`: Sua chave da OpenAI (para leitura de comprovantes).
- `SUPERADMIN_EMAIL` / `SUPERADMIN_PASSWORD` / `SUPERADMIN_NAME`: superadmin criado automaticamente no boot. A senha padrão só funciona uma vez: no primeiro login o sistema exige a definição de uma nova senha antes de liberar o acesso.
- `NODE_ENV`: `production`
- `HOST`: `0.0.0.0`
- `PORT`: `3000`

**Build Args (VITE_):**
- No EasyPanel, se o build falhar por falta de variáveis VITE, você pode passar valores dummy ou reais se o frontend precisar delas (o sistema atual usa server functions para quase tudo, então chaves de client são opcionais).

## 4. Como funciona o Auth agora?
O sistema valida as sessões diretamente na tabela `user_sessions` do seu banco PostgreSQL. Não há chamadas para serviços externos. O login é local e seguro.

---
*Para uma lista detalhada de todas as funções, consulte o arquivo `DOCUMENTACAO_GERAL.md`.*
