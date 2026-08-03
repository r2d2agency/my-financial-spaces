# Configuração PostgreSQL Puro (EasyPanel)

Este app foi migrado de Supabase para **PostgreSQL Puro** rodando no seu EasyPanel.

## 1. Banco de Dados
Use a sua `DATABASE_URL` no EasyPanel:
`postgres://postgres:qx0hw7js8syz9axdmqf3@blaster_finace-gleego-bd:5432/finace-gleego-bd?sslmode=disable`

## 2. Tabelas Necessárias
Execute o script SQL abaixo no seu banco de dados para criar a estrutura completa (Auth, Business Logic e Sessões):

```sql
-- 1. ESTRUTURA AUTH (Simulação do schema auth do Supabase para compatibilidade local)
CREATE SCHEMA IF NOT EXISTS auth;
CREATE TABLE IF NOT EXISTS auth.users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE,
    raw_user_meta_data JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. SCHEMAS E ENUMS
CREATE TYPE public.workspace_role AS ENUM ('owner','admin','editor','viewer','consultant');
CREATE TYPE public.app_role AS ENUM ('platform_admin','support');
CREATE TYPE public.account_kind AS ENUM ('checking','savings','wallet','cash','investment');
CREATE TYPE public.tx_type AS ENUM ('income','expense','transfer','refund','debt_payment','card_payment','adjustment');
CREATE TYPE public.tx_status AS ENUM ('pending','paid');
CREATE TYPE public.debt_status AS ENUM ('active','paid','renegotiated');
CREATE TYPE public.subscription_status AS ENUM ('trialing','active','past_due','canceled','suspended');
CREATE TYPE public.invite_status AS ENUM ('pending','accepted','revoked');

-- 3. TABELAS DE NEGÓCIO
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY,
  email TEXT,
  full_name TEXT,
  avatar_url TEXT,
  monthly_income NUMERIC(14,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

CREATE TABLE public.plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  price_cents INTEGER NOT NULL DEFAULT 0,
  max_workspaces INTEGER NOT NULL DEFAULT 1,
  max_users INTEGER NOT NULL DEFAULT 1,
  max_accounts INTEGER NOT NULL DEFAULT 3,
  features JSONB NOT NULL DEFAULT '[]'::jsonb,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.workspaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  owner_id UUID NOT NULL,
  currency TEXT NOT NULL DEFAULT 'BRL',
  expected_income NUMERIC(14,2) NOT NULL DEFAULT 0,
  onboarding_done BOOLEAN NOT NULL DEFAULT false,
  suspended BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.workspace_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  role public.workspace_role NOT NULL DEFAULT 'viewer',
  hide_balances BOOLEAN NOT NULL DEFAULT false,
  can_invite BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, user_id)
);

CREATE TABLE public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  plan_id UUID REFERENCES public.plans(id),
  status public.subscription_status NOT NULL DEFAULT 'trialing',
  current_period_end DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  kind public.tx_type NOT NULL DEFAULT 'expense',
  parent_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  is_house_cost BOOLEAN NOT NULL DEFAULT false,
  color TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.financial_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  kind public.account_kind NOT NULL DEFAULT 'checking',
  institution TEXT,
  initial_balance NUMERIC(14,2) NOT NULL DEFAULT 0,
  archived BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.credit_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  brand TEXT,
  credit_limit NUMERIC(14,2) NOT NULL DEFAULT 0,
  closing_day INTEGER NOT NULL DEFAULT 1,
  due_day INTEGER NOT NULL DEFAULT 10,
  holder_name TEXT,
  archived BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  type public.tx_type NOT NULL,
  description TEXT NOT NULL,
  amount NUMERIC(14,2) NOT NULL,
  status public.tx_status NOT NULL DEFAULT 'pending',
  competence_date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE,
  paid_date DATE,
  account_id UUID REFERENCES public.financial_accounts(id) ON DELETE SET NULL,
  to_account_id UUID REFERENCES public.financial_accounts(id) ON DELETE SET NULL,
  card_id UUID REFERENCES public.credit_cards(id) ON DELETE SET NULL,
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.debts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  outstanding NUMERIC(14,2) NOT NULL DEFAULT 0,
  installment_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  status public.debt_status NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.financial_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  target_amount NUMERIC(14,2) NOT NULL,
  current_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id UUID,
  action TEXT NOT NULL,
  entity TEXT,
  entity_id UUID,
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. GESTÃO DE SESSÕES (Essencial para Auto-Host)
CREATE TABLE IF NOT EXISTS public.user_sessions (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. DADOS INICIAIS (Planos)
INSERT INTO public.plans (slug, name, price_cents, max_workspaces, max_users, max_accounts) VALUES
 ('individual', 'Individual', 1990, 1, 1, 3),
 ('familia', 'Família', 3990, 1, 5, 10),
 ('premium', 'Premium', 6990, 5, 10, 50),
 ('profissional', 'Profissional', 12990, 50, 50, 200)
ON CONFLICT (slug) DO NOTHING;
```

## 3. Variáveis de Ambiente no EasyPanel
Você **não precisa** das variáveis `VITE_SUPABASE_*`. O sistema foi totalmente desacoplado do Supabase Cloud e da API do Supabase auto-hospedado.

Mantenha apenas:
- `DATABASE_URL` (Sua string de conexão)
- `OPENAI_API_KEY` (Para a IA)
- `NODE_ENV=production`

## 4. Como funciona o Auth agora?
O sistema agora valida as sessões diretamente na tabela `user_sessions` do seu banco PostgreSQL. Não há chamadas para `localhost:8000`.
