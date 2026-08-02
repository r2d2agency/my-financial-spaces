-- ENUMS
CREATE TYPE public.workspace_role AS ENUM ('owner','admin','editor','viewer','consultant');
CREATE TYPE public.app_role AS ENUM ('platform_admin','support');
CREATE TYPE public.account_kind AS ENUM ('checking','savings','wallet','cash','investment');
CREATE TYPE public.tx_type AS ENUM ('income','expense','transfer','refund','debt_payment','card_payment','adjustment');
CREATE TYPE public.tx_status AS ENUM ('pending','paid');
CREATE TYPE public.debt_status AS ENUM ('active','paid','renegotiated');
CREATE TYPE public.subscription_status AS ENUM ('trialing','active','past_due','canceled','suspended');
CREATE TYPE public.invite_status AS ENUM ('pending','accepted','revoked');

-- UPDATED_AT helper
CREATE OR REPLACE FUNCTION public.set_updated_at() RETURNS TRIGGER
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

-- PROFILES
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY,
  email TEXT,
  full_name TEXT,
  avatar_url TEXT,
  monthly_income NUMERIC(14,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own profile read" ON public.profiles FOR SELECT TO authenticated USING (id = auth.uid());
CREATE POLICY "own profile write" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());
CREATE POLICY "own profile insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());
CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- PLATFORM ROLES
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read own platform roles" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role) $$;

-- PLANS
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
GRANT SELECT ON public.plans TO authenticated, anon;
GRANT ALL ON public.plans TO service_role;
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "plans public read" ON public.plans FOR SELECT USING (active = true);
CREATE POLICY "plans admin manage" ON public.plans FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'platform_admin')) WITH CHECK (public.has_role(auth.uid(),'platform_admin'));

INSERT INTO public.plans (slug,name,price_cents,max_workspaces,max_users,max_accounts,features) VALUES
 ('individual','Individual',1990,1,1,3,'["1 espaço financeiro","1 usuário","Relatórios básicos"]'),
 ('familia','Família',3990,1,5,10,'["Até 5 usuários","Permissões","Dívidas, metas e planejamento","Relatórios completos"]'),
 ('premium','Premium',6990,5,10,50,'["Vários espaços","Importação de extratos","Exportação avançada","Relatórios personalizados"]'),
 ('profissional','Profissional',12990,50,50,200,'["Vários clientes","Acesso para consultores","Gestão centralizada","Painel de acompanhamento"]');

-- WORKSPACES
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
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workspaces TO authenticated;
GRANT ALL ON public.workspaces TO service_role;
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_workspaces_updated BEFORE UPDATE ON public.workspaces FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

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
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workspace_members TO authenticated;
GRANT ALL ON public.workspace_members TO service_role;
ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;

-- HELPERS
CREATE OR REPLACE FUNCTION public.ws_role(_ws UUID)
RETURNS public.workspace_role LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT role FROM public.workspace_members WHERE workspace_id = _ws AND user_id = auth.uid() $$;

CREATE OR REPLACE FUNCTION public.is_ws_member(_ws UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.workspace_members WHERE workspace_id = _ws AND user_id = auth.uid()) $$;

CREATE OR REPLACE FUNCTION public.can_edit_ws(_ws UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.ws_role(_ws) IN ('owner','admin','editor') $$;

CREATE OR REPLACE FUNCTION public.can_manage_ws(_ws UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.ws_role(_ws) IN ('owner','admin') $$;

CREATE OR REPLACE FUNCTION public.is_ws_owner(_ws UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.ws_role(_ws) = 'owner' $$;

CREATE POLICY "ws members read" ON public.workspaces FOR SELECT TO authenticated USING (public.is_ws_member(id));
CREATE POLICY "ws create own" ON public.workspaces FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid());
CREATE POLICY "ws update by managers" ON public.workspaces FOR UPDATE TO authenticated USING (public.can_manage_ws(id)) WITH CHECK (public.can_manage_ws(id));
CREATE POLICY "ws delete by owner" ON public.workspaces FOR DELETE TO authenticated USING (public.is_ws_owner(id));

CREATE POLICY "members read" ON public.workspace_members FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_ws_member(workspace_id));
CREATE POLICY "members insert" ON public.workspace_members FOR INSERT TO authenticated
  WITH CHECK (public.can_manage_ws(workspace_id) OR EXISTS (SELECT 1 FROM public.workspaces w WHERE w.id = workspace_id AND w.owner_id = auth.uid()));
CREATE POLICY "members update" ON public.workspace_members FOR UPDATE TO authenticated USING (public.can_manage_ws(workspace_id)) WITH CHECK (public.can_manage_ws(workspace_id));
CREATE POLICY "members delete" ON public.workspace_members FOR DELETE TO authenticated USING (public.can_manage_ws(workspace_id));

-- SUBSCRIPTIONS
CREATE TABLE public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  plan_id UUID REFERENCES public.plans(id),
  status public.subscription_status NOT NULL DEFAULT 'trialing',
  current_period_end DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.subscriptions TO authenticated;
GRANT ALL ON public.subscriptions TO service_role;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "subs read" ON public.subscriptions FOR SELECT TO authenticated USING (public.is_ws_member(workspace_id));
CREATE POLICY "subs owner insert" ON public.subscriptions FOR INSERT TO authenticated WITH CHECK (public.is_ws_owner(workspace_id));
CREATE POLICY "subs owner update" ON public.subscriptions FOR UPDATE TO authenticated USING (public.is_ws_owner(workspace_id)) WITH CHECK (public.is_ws_owner(workspace_id));

-- INVITES
CREATE TABLE public.workspace_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role public.workspace_role NOT NULL DEFAULT 'viewer',
  hide_balances BOOLEAN NOT NULL DEFAULT false,
  status public.invite_status NOT NULL DEFAULT 'pending',
  invited_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX invites_unique_pending ON public.workspace_invites (workspace_id, lower(email)) WHERE status = 'pending';
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workspace_invites TO authenticated;
GRANT ALL ON public.workspace_invites TO service_role;
ALTER TABLE public.workspace_invites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "invites read" ON public.workspace_invites FOR SELECT TO authenticated
  USING (public.is_ws_member(workspace_id) OR lower(email) = lower(coalesce(auth.jwt() ->> 'email','')));
CREATE POLICY "invites manage" ON public.workspace_invites FOR ALL TO authenticated
  USING (public.can_manage_ws(workspace_id)) WITH CHECK (public.can_manage_ws(workspace_id) AND invited_by = auth.uid());

-- CATEGORIES
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
GRANT SELECT, INSERT, UPDATE, DELETE ON public.categories TO authenticated;
GRANT ALL ON public.categories TO service_role;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cat read" ON public.categories FOR SELECT TO authenticated USING (public.is_ws_member(workspace_id));
CREATE POLICY "cat write" ON public.categories FOR ALL TO authenticated USING (public.can_manage_ws(workspace_id)) WITH CHECK (public.can_manage_ws(workspace_id));

-- ACCOUNTS
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
GRANT SELECT, INSERT, UPDATE, DELETE ON public.financial_accounts TO authenticated;
GRANT ALL ON public.financial_accounts TO service_role;
ALTER TABLE public.financial_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "acc read" ON public.financial_accounts FOR SELECT TO authenticated USING (public.is_ws_member(workspace_id));
CREATE POLICY "acc write" ON public.financial_accounts FOR ALL TO authenticated USING (public.can_manage_ws(workspace_id)) WITH CHECK (public.can_manage_ws(workspace_id));
CREATE TRIGGER trg_acc_updated BEFORE UPDATE ON public.financial_accounts FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- CREDIT CARDS
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
GRANT SELECT, INSERT, UPDATE, DELETE ON public.credit_cards TO authenticated;
GRANT ALL ON public.credit_cards TO service_role;
ALTER TABLE public.credit_cards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "card read" ON public.credit_cards FOR SELECT TO authenticated USING (public.is_ws_member(workspace_id));
CREATE POLICY "card write" ON public.credit_cards FOR ALL TO authenticated USING (public.can_manage_ws(workspace_id)) WITH CHECK (public.can_manage_ws(workspace_id));
CREATE TRIGGER trg_card_updated BEFORE UPDATE ON public.credit_cards FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- TRANSACTIONS
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
  debt_id UUID,
  responsible_id UUID,
  installment_no INTEGER,
  installment_total INTEGER,
  installment_group UUID,
  invoice_month DATE,
  recurrence TEXT,
  tags TEXT[] NOT NULL DEFAULT '{}',
  notes TEXT,
  attachment_path TEXT,
  created_by UUID NOT NULL DEFAULT auth.uid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX tx_ws_date ON public.transactions (workspace_id, competence_date DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.transactions TO authenticated;
GRANT ALL ON public.transactions TO service_role;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tx read" ON public.transactions FOR SELECT TO authenticated USING (public.is_ws_member(workspace_id));
CREATE POLICY "tx insert" ON public.transactions FOR INSERT TO authenticated WITH CHECK (public.can_edit_ws(workspace_id) AND created_by = auth.uid());
CREATE POLICY "tx update" ON public.transactions FOR UPDATE TO authenticated USING (public.can_edit_ws(workspace_id)) WITH CHECK (public.can_edit_ws(workspace_id));
CREATE POLICY "tx delete" ON public.transactions FOR DELETE TO authenticated USING (public.can_edit_ws(workspace_id));
CREATE TRIGGER trg_tx_updated BEFORE UPDATE ON public.transactions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RECURRING
CREATE TABLE public.recurring_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  type public.tx_type NOT NULL DEFAULT 'expense',
  description TEXT NOT NULL,
  amount NUMERIC(14,2) NOT NULL,
  frequency TEXT NOT NULL DEFAULT 'monthly',
  day_of_month INTEGER NOT NULL DEFAULT 1,
  account_id UUID REFERENCES public.financial_accounts(id) ON DELETE SET NULL,
  card_id UUID REFERENCES public.credit_cards(id) ON DELETE SET NULL,
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.recurring_transactions TO authenticated;
GRANT ALL ON public.recurring_transactions TO service_role;
ALTER TABLE public.recurring_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rec read" ON public.recurring_transactions FOR SELECT TO authenticated USING (public.is_ws_member(workspace_id));
CREATE POLICY "rec write" ON public.recurring_transactions FOR ALL TO authenticated USING (public.can_edit_ws(workspace_id)) WITH CHECK (public.can_edit_ws(workspace_id));

-- DEBTS
CREATE TABLE public.debts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  creditor TEXT,
  initial_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  outstanding NUMERIC(14,2) NOT NULL DEFAULT 0,
  interest_rate NUMERIC(6,3) NOT NULL DEFAULT 0,
  installments_total INTEGER NOT NULL DEFAULT 1,
  installments_paid INTEGER NOT NULL DEFAULT 0,
  installment_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  due_day INTEGER NOT NULL DEFAULT 10,
  priority INTEGER NOT NULL DEFAULT 3,
  status public.debt_status NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.debts TO authenticated;
GRANT ALL ON public.debts TO service_role;
ALTER TABLE public.debts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "debt read" ON public.debts FOR SELECT TO authenticated USING (public.is_ws_member(workspace_id));
CREATE POLICY "debt write" ON public.debts FOR ALL TO authenticated USING (public.can_edit_ws(workspace_id)) WITH CHECK (public.can_edit_ws(workspace_id));
CREATE TRIGGER trg_debt_updated BEFORE UPDATE ON public.debts FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.debt_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  debt_id UUID NOT NULL REFERENCES public.debts(id) ON DELETE CASCADE,
  amount NUMERIC(14,2) NOT NULL,
  paid_date DATE NOT NULL DEFAULT CURRENT_DATE,
  extra BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.debt_payments TO authenticated;
GRANT ALL ON public.debt_payments TO service_role;
ALTER TABLE public.debt_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dp read" ON public.debt_payments FOR SELECT TO authenticated USING (public.is_ws_member(workspace_id));
CREATE POLICY "dp write" ON public.debt_payments FOR ALL TO authenticated USING (public.can_edit_ws(workspace_id)) WITH CHECK (public.can_edit_ws(workspace_id));

-- BUDGETS
CREATE TABLE public.budgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  month DATE NOT NULL,
  category_id UUID REFERENCES public.categories(id) ON DELETE CASCADE,
  planned_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  kind TEXT NOT NULL DEFAULT 'category',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, month, category_id, kind)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.budgets TO authenticated;
GRANT ALL ON public.budgets TO service_role;
ALTER TABLE public.budgets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bud read" ON public.budgets FOR SELECT TO authenticated USING (public.is_ws_member(workspace_id));
CREATE POLICY "bud write" ON public.budgets FOR ALL TO authenticated USING (public.can_edit_ws(workspace_id)) WITH CHECK (public.can_edit_ws(workspace_id));

-- GOALS
CREATE TABLE public.financial_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  target_amount NUMERIC(14,2) NOT NULL,
  current_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  target_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.financial_goals TO authenticated;
GRANT ALL ON public.financial_goals TO service_role;
ALTER TABLE public.financial_goals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "goal read" ON public.financial_goals FOR SELECT TO authenticated USING (public.is_ws_member(workspace_id));
CREATE POLICY "goal write" ON public.financial_goals FOR ALL TO authenticated USING (public.can_edit_ws(workspace_id)) WITH CHECK (public.can_edit_ws(workspace_id));

-- AUDIT LOGS
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
GRANT SELECT, INSERT ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "audit read" ON public.audit_logs FOR SELECT TO authenticated USING (workspace_id IS NOT NULL AND public.can_manage_ws(workspace_id));
CREATE POLICY "audit insert" ON public.audit_logs FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

-- NOTIFICATIONS
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "notif own" ON public.notifications FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "notif own update" ON public.notifications FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- SIGNUP: profile + accept pending invites
CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data ->> 'full_name', ''))
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.workspace_members (workspace_id, user_id, role, hide_balances)
  SELECT i.workspace_id, NEW.id, i.role, i.hide_balances
  FROM public.workspace_invites i
  WHERE lower(i.email) = lower(NEW.email) AND i.status = 'pending'
  ON CONFLICT (workspace_id, user_id) DO NOTHING;

  UPDATE public.workspace_invites SET status = 'accepted'
  WHERE lower(email) = lower(NEW.email) AND status = 'pending';

  RETURN NEW;
END $$;

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- CREATE WORKSPACE with owner membership, default categories and trial subscription
CREATE OR REPLACE FUNCTION public.create_workspace(_name TEXT, _income NUMERIC DEFAULT 0)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _ws UUID; _uid UUID := auth.uid(); _plan UUID;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  INSERT INTO public.workspaces (name, owner_id, expected_income)
  VALUES (_name, _uid, COALESCE(_income,0)) RETURNING id INTO _ws;

  INSERT INTO public.workspace_members (workspace_id, user_id, role, can_invite)
  VALUES (_ws, _uid, 'owner', true);

  SELECT id INTO _plan FROM public.plans WHERE slug = 'familia';
  INSERT INTO public.subscriptions (workspace_id, plan_id, status, current_period_end)
  VALUES (_ws, _plan, 'trialing', CURRENT_DATE + 14);

  INSERT INTO public.categories (workspace_id, name, kind, is_house_cost) VALUES
    (_ws,'Moradia','expense',true),(_ws,'Água','expense',true),(_ws,'Energia','expense',true),
    (_ws,'Internet','expense',true),(_ws,'Mercado','expense',true),(_ws,'Educação','expense',true),
    (_ws,'Saúde','expense',true),(_ws,'Veículos','expense',true),(_ws,'Funcionários','expense',true),
    (_ws,'Manutenção','expense',true),(_ws,'Lazer','expense',true),(_ws,'Assinaturas','expense',true),
    (_ws,'Salário','income',false),(_ws,'Outras receitas','income',false);

  RETURN _ws;
END $$;
GRANT EXECUTE ON FUNCTION public.create_workspace(TEXT, NUMERIC) TO authenticated;

-- WORKSPACE MEMBER LIST with emails (safe view function for managers)
CREATE OR REPLACE FUNCTION public.list_ws_members(_ws UUID)
RETURNS TABLE (user_id UUID, email TEXT, full_name TEXT, role public.workspace_role, hide_balances BOOLEAN)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT m.user_id, p.email, p.full_name, m.role, m.hide_balances
  FROM public.workspace_members m
  LEFT JOIN public.profiles p ON p.id = m.user_id
  WHERE m.workspace_id = _ws AND public.is_ws_member(_ws) $$;
GRANT EXECUTE ON FUNCTION public.list_ws_members(UUID) TO authenticated;