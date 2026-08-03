import { query } from "./db.server";

export async function initializeDatabase() {
  console.log("Checking database initialization...");
  
  try {
    // Check if a basic table exists
    const checkTable = await query(`
      SELECT EXISTS (
        SELECT FROM pg_proc 
        WHERE proname = 'create_workspace' 
        AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
      );
    `);

    if (!checkTable.rows[0].exists) {
      console.log("Database not initialized. Running migrations...");
      
      // SQL for full schema initialization
      // Note: Running these in a single call. In some PG drivers this is fine, in others we might need to split.
      const sql = `
        -- 1. ESTRUTURA AUTH
        CREATE SCHEMA IF NOT EXISTS auth;
        CREATE TABLE IF NOT EXISTS auth.users (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            email TEXT UNIQUE,
            raw_user_meta_data JSONB DEFAULT '{}'::jsonb,
            created_at TIMESTAMPTZ DEFAULT NOW()
        );

        -- 2. SCHEMAS E ENUMS
        DO $$ BEGIN
            CREATE TYPE public.workspace_role AS ENUM ('owner','admin','editor','viewer','consultant');
        EXCEPTION WHEN duplicate_object THEN null; END $$;

        DO $$ BEGIN
            CREATE TYPE public.app_role AS ENUM ('platform_admin','support');
        EXCEPTION WHEN duplicate_object THEN null; END $$;

        DO $$ BEGIN
            CREATE TYPE public.account_kind AS ENUM ('checking','savings','wallet','cash','investment');
        EXCEPTION WHEN duplicate_object THEN null; END $$;

        DO $$ BEGIN
            CREATE TYPE public.tx_type AS ENUM ('income','expense','transfer','refund','debt_payment','card_payment','adjustment');
        EXCEPTION WHEN duplicate_object THEN null; END $$;

        DO $$ BEGIN
            CREATE TYPE public.tx_status AS ENUM ('pending','paid');
        EXCEPTION WHEN duplicate_object THEN null; END $$;

        DO $$ BEGIN
            CREATE TYPE public.debt_status AS ENUM ('active','paid','renegotiated');
        EXCEPTION WHEN duplicate_object THEN null; END $$;

        DO $$ BEGIN
            CREATE TYPE public.subscription_status AS ENUM ('trialing','active','past_due','canceled','suspended');
        EXCEPTION WHEN duplicate_object THEN null; END $$;

        DO $$ BEGIN
            CREATE TYPE public.invite_status AS ENUM ('pending','accepted','revoked');
        EXCEPTION WHEN duplicate_object THEN null; END $$;

        -- 3. TABELAS DE NEGÓCIO
        CREATE TABLE IF NOT EXISTS public.profiles (
          id UUID PRIMARY KEY,
          email TEXT,
          full_name TEXT,
          avatar_url TEXT,
          monthly_income NUMERIC(14,2),
          created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );

        CREATE TABLE IF NOT EXISTS public.user_roles (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID NOT NULL,
          role public.app_role NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          UNIQUE (user_id, role)
        );

        CREATE TABLE IF NOT EXISTS public.plans (
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

        CREATE TABLE IF NOT EXISTS public.workspaces (
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

        CREATE TABLE IF NOT EXISTS public.workspace_members (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
          user_id UUID NOT NULL,
          role public.workspace_role NOT NULL DEFAULT 'viewer',
          hide_balances BOOLEAN NOT NULL DEFAULT false,
          can_invite BOOLEAN NOT NULL DEFAULT false,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          UNIQUE (workspace_id, user_id)
        );

        CREATE TABLE IF NOT EXISTS public.subscriptions (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
          plan_id UUID REFERENCES public.plans(id),
          status public.subscription_status NOT NULL DEFAULT 'trialing',
          current_period_end DATE,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );

        CREATE TABLE IF NOT EXISTS public.categories (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
          name TEXT NOT NULL,
          kind public.tx_type NOT NULL DEFAULT 'expense',
          parent_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
          is_house_cost BOOLEAN NOT NULL DEFAULT false,
          color TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );

        CREATE TABLE IF NOT EXISTS public.financial_accounts (
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

        CREATE TABLE IF NOT EXISTS public.credit_cards (
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

        CREATE TABLE IF NOT EXISTS public.transactions (
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

        CREATE TABLE IF NOT EXISTS public.debts (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
          name TEXT NOT NULL,
          outstanding NUMERIC(14,2) NOT NULL DEFAULT 0,
          installment_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
          status public.debt_status NOT NULL DEFAULT 'active',
          created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );

        CREATE TABLE IF NOT EXISTS public.financial_goals (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
          name TEXT NOT NULL,
          target_amount NUMERIC(14,2) NOT NULL,
          current_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );

        CREATE TABLE IF NOT EXISTS public.notifications (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE,
          user_id UUID NOT NULL,
          title TEXT NOT NULL,
          body TEXT,
          read_at TIMESTAMPTZ,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );

        CREATE TABLE IF NOT EXISTS public.audit_logs (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE,
          user_id UUID,
          action TEXT NOT NULL,
          entity TEXT,
          entity_id UUID,
          meta JSONB NOT NULL DEFAULT '{}'::jsonb,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );

        -- 4. GESTÃO DE SESSÕES
        CREATE TABLE IF NOT EXISTS public.user_sessions (
            id UUID PRIMARY KEY,
            user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
            expires_at TIMESTAMPTZ NOT NULL,
            created_at TIMESTAMPTZ DEFAULT NOW()
        );

        -- 5. DADOS INICIAIS
        INSERT INTO public.plans (slug, name, price_cents, max_workspaces, max_users, max_accounts) VALUES
         ('individual', 'Individual', 1990, 1, 1, 3),
         ('familia', 'Família', 3990, 1, 5, 10),
         ('premium', 'Premium', 6990, 5, 10, 50),
         ('profissional', 'Profissional', 12990, 50, 50, 200)
        ON CONFLICT (slug) DO NOTHING;

        -- 6. FUNÇÃO CREATE_WORKSPACE
        CREATE OR REPLACE FUNCTION public.create_workspace(_name TEXT, _expected_income NUMERIC, _user_id UUID)
        RETURNS UUID AS $$
        DECLARE
            v_ws_id UUID;
            v_plan_id UUID;
        BEGIN
            -- 1. Criar Workspace
            INSERT INTO public.workspaces (name, owner_id, expected_income)
            VALUES (_name, _user_id, _expected_income)
            RETURNING id INTO v_ws_id;

            -- 2. Adicionar como Owner
            INSERT INTO public.workspace_members (workspace_id, user_id, role, can_invite)
            VALUES (v_ws_id, _user_id, 'owner', true);

            -- 3. Obter ID do Plano (Individual por padrão)
            SELECT id INTO v_plan_id FROM public.plans WHERE slug = 'individual';

            -- 4. Criar Assinatura (Trial)
            INSERT INTO public.subscriptions (workspace_id, plan_id, status, current_period_end)
            VALUES (v_ws_id, v_plan_id, 'trialing', CURRENT_DATE + INTERVAL '30 days');

            -- 5. Criar Categorias Padrão
            INSERT INTO public.categories (workspace_id, name, kind, color) VALUES
            (v_ws_id, 'Aluguel / Hipoteca', 'expense', '#ef4444'),
            (v_ws_id, 'Energia', 'expense', '#eab308'),
            (v_ws_id, 'Água', 'expense', '#3b82f6'),
            (v_ws_id, 'Internet', 'expense', '#8b5cf6'),
            (v_ws_id, 'Supermercado', 'expense', '#22c55e'),
            (v_ws_id, 'Salário', 'income', '#10b981'),
            (v_ws_id, 'Freelance', 'income', '#6366f1');

            RETURN v_ws_id;
        END;
        $$ LANGUAGE plpgsql SECURITY DEFINER;

        -- 7. FUNÇÃO LIST_WS_MEMBERS
        CREATE OR REPLACE FUNCTION public.list_ws_members(_ws UUID)
        RETURNS TABLE (
            id UUID,
            workspace_id UUID,
            user_id UUID,
            role public.workspace_role,
            hide_balances BOOLEAN,
            can_invite BOOLEAN,
            created_at TIMESTAMPTZ,
            email TEXT,
            full_name TEXT
        ) AS $$
        BEGIN
            RETURN QUERY
            SELECT 
                m.id, m.workspace_id, m.user_id, m.role, m.hide_balances, m.can_invite, m.created_at,
                p.email, p.full_name
            FROM public.workspace_members m
            JOIN public.profiles p ON p.id = m.user_id
            WHERE m.workspace_id = _ws;
        END;
        $$ LANGUAGE plpgsql SECURITY DEFINER;
      
      
      
      `;

      await query(sql);
      console.log("Database initialized successfully!");
    } else {
      console.log("Database already initialized.");
    }
  } catch (error) {
    console.error("Failed to initialize database:", error);
  }
}
