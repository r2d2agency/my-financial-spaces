import { query } from "./db.server";
import { hashPassword } from "./crypto.server";

/**
 * Cria (ou garante) o superadmin definido por variáveis de ambiente.
 * SUPERADMIN_EMAIL / SUPERADMIN_PASSWORD
 * O usuário criado nasce com must_change_password = true, ou seja,
 * na primeira entrada o sistema exige a definição de uma nova senha.
 */
async function seedSuperAdmin() {
  const email = (process.env["SUPERADMIN_EMAIL"] || "tnicodemos@gmail.com").trim().toLowerCase();
  const envPassword = process.env["SUPERADMIN_PASSWORD"]?.trim();
  const generated = !envPassword;
  const password = envPassword || `Adm-${crypto.randomUUID().slice(0, 12)}`;
  const name = process.env["SUPERADMIN_NAME"] || "Super Admin";

  const existing = await query("SELECT id FROM auth.users WHERE lower(trim(email)) = lower($1)", [email]);
  let userId: string;

  if (existing.rows.length > 0) {
    userId = existing.rows[0].id;
    console.log(`Superadmin já existe: ${email}`);
    
    if (envPassword) {
      const pwHash = await hashPassword(password);
      await query(
        "UPDATE auth.users SET password_hash = $1 WHERE id = $2",
        [pwHash, userId]
      );
      console.log(`Senha do Superadmin sincronizada com SUPERADMIN_PASSWORD para ${email}`);
    }
  } else {
    const pwHash = await hashPassword(password);
    const res = await query(
      `INSERT INTO auth.users (email, password_hash, raw_user_meta_data, must_change_password)
       VALUES ($1, $2, $3, true) RETURNING id`,
      [email, pwHash, JSON.stringify({ full_name: name })]
    );
    userId = res.rows[0].id;
    console.log(`Superadmin criado: ${email}`);
    if (generated) {
      console.log(`Senha gerada: ${password}`);
    }
  }

  // Garantir Perfil
  await query(
    `INSERT INTO public.profiles (id, full_name, email)
     VALUES ($1, $2, $3)
     ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email`,
    [userId, name, email]
  );

  // Garantir Role de Admin
  await query(
    `INSERT INTO public.user_roles (user_id, role)
     VALUES ($1, 'platform_admin')
     ON CONFLICT (user_id, role) DO NOTHING`,
    [userId]
  );
}


export async function initializeDatabase() {
  console.log("Checking database initialization...");
  
  try {
    // Force re-run for now to ensure all missing tables are created if user is stuck
    if (true) { // Garantir execução das novas tabelas do Sprint A
      console.log("Database verification/initialization running...");
      
      // SQL for full schema initialization
      // Note: We run these separately or handle errors if the driver doesn't support multiple statements well.
      // But we will use the same string for now, ensuring syntax is perfect.
      const sql = `
        -- 1. ESTRUTURA AUTH
        CREATE SCHEMA IF NOT EXISTS auth;
        CREATE TABLE IF NOT EXISTS auth.users (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            email TEXT UNIQUE,
            password_hash TEXT,
            raw_user_meta_data JSONB DEFAULT '{}'::jsonb,
            created_at TIMESTAMPTZ DEFAULT NOW()
        );

        -- 2. SCHEMAS E ENUMS
        DO $$ BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'workspace_role') THEN
                CREATE TYPE public.workspace_role AS ENUM ('owner','admin','manager','operator','viewer');
            END IF;
        END $$;

        DO $$ BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role') THEN
                CREATE TYPE public.app_role AS ENUM ('platform_admin','support');
            END IF;
        END $$;

        DO $$ BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'account_kind') THEN
                CREATE TYPE public.account_kind AS ENUM ('checking','savings','wallet','cash','investment');
            END IF;
        END $$;

        DO $$ BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'tx_type') THEN
                CREATE TYPE public.tx_type AS ENUM ('income','expense','transfer','refund','debt_payment','card_payment','adjustment');
            END IF;
        END $$;

        DO $$ BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'tx_status') THEN
                CREATE TYPE public.tx_status AS ENUM ('pending','paid','partial','canceled');
            END IF;
        END $$;

        DO $$ BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'debt_status') THEN
                CREATE TYPE public.debt_status AS ENUM ('active','paid','renegotiated');
            END IF;
        END $$;

        DO $$ BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'subscription_status') THEN
                CREATE TYPE public.subscription_status AS ENUM ('trialing','active','past_due','canceled','suspended');
            END IF;
        END $$;

        DO $$ BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'invite_status') THEN
                CREATE TYPE public.invite_status AS ENUM ('pending','accepted','revoked');
            END IF;
        END $$;

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
          user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
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
          actual_amount NUMERIC(14,2),
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
          updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          recurring_id UUID REFERENCES public.recurring_transactions(id) ON DELETE SET NULL,
          is_estimated BOOLEAN NOT NULL DEFAULT false,
          installment_number INTEGER,
          total_installments INTEGER,
          parent_transaction_id UUID REFERENCES public.transactions(id) ON DELETE SET NULL,
          transfer_id UUID
        );

        CREATE TABLE IF NOT EXISTS public.debts (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
          name TEXT NOT NULL,
          initial_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
          outstanding NUMERIC(14,2) NOT NULL DEFAULT 0,
          installment_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
          installments_total INTEGER NOT NULL DEFAULT 1,
          due_day INTEGER NOT NULL DEFAULT 10,
          status public.debt_status NOT NULL DEFAULT 'active',
          person_name TEXT,
          is_parcelled BOOLEAN NOT NULL DEFAULT false,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );

        CREATE TABLE IF NOT EXISTS public.financial_goals (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
          name TEXT NOT NULL,
          target_amount NUMERIC(14,2) NOT NULL,
          current_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
          target_date DATE,
          color TEXT,
          archived BOOLEAN NOT NULL DEFAULT false,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );

        CREATE TABLE IF NOT EXISTS public.recurring_transactions (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
          type public.tx_type NOT NULL DEFAULT 'expense',
          description TEXT NOT NULL,
          amount NUMERIC(14,2) NOT NULL,
          frequency TEXT NOT NULL DEFAULT 'monthly',
          day_of_month INTEGER NOT NULL DEFAULT 5,
          is_fixed BOOLEAN NOT NULL DEFAULT true,
          category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
          account_id UUID REFERENCES public.financial_accounts(id) ON DELETE SET NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );

        CREATE TABLE IF NOT EXISTS public.workspace_invites (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
          email TEXT NOT NULL,
          role public.workspace_role NOT NULL DEFAULT 'viewer',
          hide_balances BOOLEAN NOT NULL DEFAULT false,
          invited_by UUID,
          status public.invite_status NOT NULL DEFAULT 'pending',
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

        CREATE TABLE IF NOT EXISTS public.platform_configs (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          key TEXT UNIQUE NOT NULL,
          value TEXT NOT NULL,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );

        CREATE TABLE IF NOT EXISTS public.contacts (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
          name TEXT NOT NULL,
          document TEXT,
          email TEXT,
          phone TEXT,
          kind TEXT DEFAULT 'both', -- 'client', 'vendor', 'both'
          created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
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
            SELECT id INTO v_plan_id FROM public.plans WHERE slug = 'individual' LIMIT 1;

            -- 4. Criar Assinatura (Trial)
            IF v_plan_id IS NOT NULL THEN
              INSERT INTO public.subscriptions (workspace_id, plan_id, status, current_period_end)
              VALUES (v_ws_id, v_plan_id, 'trialing', (CURRENT_DATE + INTERVAL '30 days'));
            END IF;

            -- 5. Criar Categorias Padrão
            INSERT INTO public.categories (workspace_id, name, kind, color) VALUES
            (v_ws_id, 'Aluguel / Hipoteca', 'expense', '#ef4444'),
            (v_ws_id, 'Energia', 'expense', '#eab308'),
            (v_ws_id, 'Água', 'expense', '#3b82f6'),
            (v_ws_id, 'Internet', 'expense', '#8b5cf6'),
            (v_ws_id, 'Supermercado', 'expense', '#22c55e'),
            (v_ws_id, 'Salário', 'income', '#10b981'),
            (v_ws_id, 'Freelance', 'income', '#6366f1');

            -- 6. Garantir que o owner tenha acesso aos dados do workspace via RLS (lógica de aplicação)
            -- Como estamos em Postgres Puro sem RLS real do Supabase habilitado no driver JS, 
            -- a separação multi-tenant é feita via filtros de workspace_id nas queries.
            
            RETURN v_ws_id;
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE 'Error in create_workspace: %', SQLERRM;
            RAISE;
        END;
        $$ LANGUAGE plpgsql SECURITY DEFINER;

        -- 8. FUNÇÃO HAS_ROLE
        CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
        RETURNS BOOLEAN AS $$
        BEGIN
            RETURN EXISTS (
                SELECT 1 FROM public.user_roles
                WHERE user_id = _user_id AND role = _role
            );
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
      
        -- 9. ADD MISSING COLUMNS (MIGRATIONS)
        ALTER TABLE public.recurring_transactions ADD COLUMN IF NOT EXISTS repeat_until DATE;
        ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS recurring_id UUID REFERENCES public.recurring_transactions(id) ON DELETE SET NULL;
        ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS is_estimated BOOLEAN NOT NULL DEFAULT false;

        ALTER TABLE public.recurring_transactions ADD COLUMN IF NOT EXISTS is_fixed BOOLEAN NOT NULL DEFAULT true;
        ALTER TABLE public.recurring_transactions ADD COLUMN IF NOT EXISTS day_of_month INTEGER NOT NULL DEFAULT 5;
        ALTER TABLE public.recurring_transactions ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL;
        ALTER TABLE public.recurring_transactions ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES public.financial_accounts(id) ON DELETE SET NULL;

        ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS person_name TEXT;
        ALTER TABLE public.recurring_transactions ADD COLUMN IF NOT EXISTS person_name TEXT;
        ALTER TABLE public.debts ADD COLUMN IF NOT EXISTS person_name TEXT;
        ALTER TABLE public.debts ADD COLUMN IF NOT EXISTS is_parcelled BOOLEAN NOT NULL DEFAULT false;

        -- Sprint B: Orçamentos
        CREATE TABLE IF NOT EXISTS public.budgets (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
          category_id UUID NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
          amount NUMERIC(14,2) NOT NULL,
          period_month INTEGER NOT NULL, -- 1-12
          period_year INTEGER NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          UNIQUE (workspace_id, category_id, period_month, period_year)
        );

        -- Flag de troca obrigatória de senha (superadmin semeado)
        ALTER TABLE auth.users ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT false;

        -- Promover tnicodemos@gmail.com a platform_admin
        DO $$ 
        DECLARE 
          v_user_id UUID;
        BEGIN
          SELECT id INTO v_user_id FROM auth.users WHERE email = 'tnicodemos@gmail.com';
          IF v_user_id IS NOT NULL THEN
            INSERT INTO public.user_roles (user_id, role) 
            VALUES (v_user_id, 'platform_admin')
            ON CONFLICT (user_id, role) DO NOTHING;
          END IF;
        END $$;

        -- Sprint B: Metas Financeiras (Aprimoramento)
        ALTER TABLE public.financial_goals ADD COLUMN IF NOT EXISTS target_date DATE;
        ALTER TABLE public.financial_goals ADD COLUMN IF NOT EXISTS color TEXT;
        ALTER TABLE public.financial_goals ADD COLUMN IF NOT EXISTS archived BOOLEAN NOT NULL DEFAULT false;


        -- Sprint C: Ciclo de Faturas de Cartão
        CREATE TABLE IF NOT EXISTS public.credit_card_bills (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
          card_id UUID NOT NULL REFERENCES public.credit_cards(id) ON DELETE CASCADE,
          amount NUMERIC(14,2) NOT NULL,
          period_month INTEGER NOT NULL,
          period_year INTEGER NOT NULL,
          status TEXT NOT NULL DEFAULT 'open', -- 'open', 'paid'
          paid_at TIMESTAMPTZ,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          UNIQUE (card_id, period_month, period_year)
        );

        -- Sprint A: Subcategorias e Tags
        ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS subcategory_of UUID REFERENCES public.categories(id) ON DELETE SET NULL;
        
        CREATE TABLE IF NOT EXISTS public.tags (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
          name TEXT NOT NULL,
          color TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          UNIQUE (workspace_id, name)
        );

        CREATE TABLE IF NOT EXISTS public.transaction_tags (
          transaction_id UUID NOT NULL REFERENCES public.transactions(id) ON DELETE CASCADE,
          tag_id UUID NOT NULL REFERENCES public.tags(id) ON DELETE CASCADE,
          PRIMARY KEY (transaction_id, tag_id)
        );

        -- Centros de Custo
        CREATE TABLE IF NOT EXISTS public.cost_centers (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
          name TEXT NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );

        ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS cost_center_id UUID REFERENCES public.cost_centers(id) ON DELETE SET NULL;
        ALTER TABLE public.recurring_transactions ADD COLUMN IF NOT EXISTS cost_center_id UUID REFERENCES public.cost_centers(id) ON DELETE SET NULL;
        
        -- Transferências
        ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS transfer_id UUID; -- Para ligar os dois lados da transferência
        
        -- Migração de senha (segurança)
        ALTER TABLE auth.users ADD COLUMN IF NOT EXISTS password_hash TEXT;
        -- Sprint D: Estornos e Hierarquia de Centros de Custo
        DO $$ BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'tx_nature') THEN
                CREATE TYPE public.tx_nature AS ENUM ('normal', 'refund', 'reversal', 'adjustment');
            END IF;
        END $$;

        ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS related_transaction_id UUID REFERENCES public.transactions(id);
        ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS nature public.tx_nature DEFAULT 'normal';
        
        ALTER TABLE public.cost_centers ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES public.cost_centers(id);
        
        -- Garantir que a tabela contacts existe
        CREATE TABLE IF NOT EXISTS public.contacts (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
          name TEXT NOT NULL,
          document TEXT,
          email TEXT,
          phone TEXT,
          kind TEXT DEFAULT 'both',
          created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );
        ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS updated_by UUID;
        ALTER TABLE public.financial_accounts ADD COLUMN IF NOT EXISTS updated_by UUID;
        ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS updated_by UUID;
        ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS updated_by UUID;
        
        -- Atualizações de colunas da refatoração
        ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS actual_amount NUMERIC(14,2);
        ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS installment_number INTEGER;
        ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS total_installments INTEGER;
        ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS parent_transaction_id UUID REFERENCES public.transactions(id) ON DELETE SET NULL;
        ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS transfer_id UUID;
      `;

      await query(sql);
      await seedSuperAdmin();
      console.log("Database initialized/verified successfully.");
    }
  } catch (err) {
    console.error("Database initialization failed:", err);
  }
}
