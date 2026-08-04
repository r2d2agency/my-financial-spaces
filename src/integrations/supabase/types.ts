export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      audit_logs: {
        Row: {
          action: string
          created_at: string
          entity: string | null
          entity_id: string | null
          id: string
          meta: Json
          user_id: string | null
          workspace_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          entity?: string | null
          entity_id?: string | null
          id?: string
          meta?: Json
          user_id?: string | null
          workspace_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          entity?: string | null
          entity_id?: string | null
          id?: string
          meta?: Json
          user_id?: string | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      budgets: {
        Row: {
          category_id: string | null
          created_at: string
          id: string
          kind: string
          month: string
          planned_amount: number
          workspace_id: string
        }
        Insert: {
          category_id?: string | null
          created_at?: string
          id?: string
          kind?: string
          month: string
          planned_amount?: number
          workspace_id: string
        }
        Update: {
          category_id?: string | null
          created_at?: string
          id?: string
          kind?: string
          month?: string
          planned_amount?: number
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "budgets_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budgets_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          color: string | null
          created_at: string
          id: string
          is_house_cost: boolean
          kind: Database["public"]["Enums"]["tx_type"]
          name: string
          parent_id: string | null
          workspace_id: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          id?: string
          is_house_cost?: boolean
          kind?: Database["public"]["Enums"]["tx_type"]
          name: string
          parent_id?: string | null
          workspace_id: string
        }
        Update: {
          color?: string | null
          created_at?: string
          id?: string
          is_house_cost?: boolean
          kind?: Database["public"]["Enums"]["tx_type"]
          name?: string
          parent_id?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "categories_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_cards: {
        Row: {
          archived: boolean
          brand: string | null
          closing_day: number
          created_at: string
          credit_limit: number
          due_day: number
          holder_name: string | null
          id: string
          name: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          archived?: boolean
          brand?: string | null
          closing_day?: number
          created_at?: string
          credit_limit?: number
          due_day?: number
          holder_name?: string | null
          id?: string
          name: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          archived?: boolean
          brand?: string | null
          closing_day?: number
          created_at?: string
          credit_limit?: number
          due_day?: number
          holder_name?: string | null
          id?: string
          name?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "credit_cards_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      debt_payments: {
        Row: {
          amount: number
          created_at: string
          debt_id: string
          extra: boolean
          id: string
          paid_date: string
          workspace_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          debt_id: string
          extra?: boolean
          id?: string
          paid_date?: string
          workspace_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          debt_id?: string
          extra?: boolean
          id?: string
          paid_date?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "debt_payments_debt_id_fkey"
            columns: ["debt_id"]
            isOneToOne: false
            referencedRelation: "debts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "debt_payments_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      debts: {
        Row: {
          created_at: string
          creditor: string | null
          due_day: number
          id: string
          initial_amount: number
          installment_amount: number
          installments_paid: number
          installments_total: number
          interest_rate: number
          name: string
          outstanding: number
          priority: number
          status: Database["public"]["Enums"]["debt_status"]
          updated_at: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          creditor?: string | null
          due_day?: number
          id?: string
          initial_amount?: number
          installment_amount?: number
          installments_paid?: number
          installments_total?: number
          interest_rate?: number
          name: string
          outstanding?: number
          priority?: number
          status?: Database["public"]["Enums"]["debt_status"]
          updated_at?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          creditor?: string | null
          due_day?: number
          id?: string
          initial_amount?: number
          installment_amount?: number
          installments_paid?: number
          installments_total?: number
          interest_rate?: number
          name?: string
          outstanding?: number
          priority?: number
          status?: Database["public"]["Enums"]["debt_status"]
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "debts_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_accounts: {
        Row: {
          archived: boolean
          created_at: string
          id: string
          initial_balance: number
          institution: string | null
          kind: Database["public"]["Enums"]["account_kind"]
          name: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          archived?: boolean
          created_at?: string
          id?: string
          initial_balance?: number
          institution?: string | null
          kind?: Database["public"]["Enums"]["account_kind"]
          name: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          archived?: boolean
          created_at?: string
          id?: string
          initial_balance?: number
          institution?: string | null
          kind?: Database["public"]["Enums"]["account_kind"]
          name?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "financial_accounts_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_goals: {
        Row: {
          created_at: string
          current_amount: number
          id: string
          name: string
          target_amount: number
          target_date: string | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          current_amount?: number
          id?: string
          name: string
          target_amount: number
          target_date?: string | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          current_amount?: number
          id?: string
          name?: string
          target_amount?: number
          target_date?: string | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "financial_goals_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          read_at: string | null
          title: string
          user_id: string
          workspace_id: string | null
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          read_at?: string | null
          title: string
          user_id: string
          workspace_id?: string | null
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          read_at?: string | null
          title?: string
          user_id?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notifications_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      plans: {
        Row: {
          active: boolean
          created_at: string
          features: Json
          id: string
          max_accounts: number
          max_users: number
          max_workspaces: number
          name: string
          price_cents: number
          slug: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          features?: Json
          id?: string
          max_accounts?: number
          max_users?: number
          max_workspaces?: number
          name: string
          price_cents?: number
          slug: string
        }
        Update: {
          active?: boolean
          created_at?: string
          features?: Json
          id?: string
          max_accounts?: number
          max_users?: number
          max_workspaces?: number
          name?: string
          price_cents?: number
          slug?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          monthly_income: number | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          monthly_income?: number | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          monthly_income?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      recurring_transactions: {
        Row: {
          account_id: string | null
          active: boolean
          amount: number
          card_id: string | null
          category_id: string | null
          created_at: string
          day_of_month: number
          description: string
          frequency: string
          id: string
          type: Database["public"]["Enums"]["tx_type"]
          workspace_id: string
        }
        Insert: {
          account_id?: string | null
          active?: boolean
          amount: number
          card_id?: string | null
          category_id?: string | null
          created_at?: string
          day_of_month?: number
          description: string
          frequency?: string
          id?: string
          type?: Database["public"]["Enums"]["tx_type"]
          workspace_id: string
        }
        Update: {
          account_id?: string | null
          active?: boolean
          amount?: number
          card_id?: string | null
          category_id?: string | null
          created_at?: string
          day_of_month?: number
          description?: string
          frequency?: string
          id?: string
          type?: Database["public"]["Enums"]["tx_type"]
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recurring_transactions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "financial_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_transactions_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "credit_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_transactions_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_transactions_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          created_at: string
          current_period_end: string | null
          id: string
          plan_id: string | null
          status: Database["public"]["Enums"]["subscription_status"]
          updated_at: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          current_period_end?: string | null
          id?: string
          plan_id?: string | null
          status?: Database["public"]["Enums"]["subscription_status"]
          updated_at?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          current_period_end?: string | null
          id?: string
          plan_id?: string | null
          status?: Database["public"]["Enums"]["subscription_status"]
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          account_id: string | null
          amount: number
          attachment_path: string | null
          card_id: string | null
          category_id: string | null
          competence_date: string
          created_at: string
          created_by: string
          debt_id: string | null
          description: string
          due_date: string | null
          id: string
          installment_group: string | null
          installment_no: number | null
          installment_total: number | null
          invoice_month: string | null
          notes: string | null
          paid_date: string | null
          recurrence: string | null
          responsible_id: string | null
          status: Database["public"]["Enums"]["tx_status"]
          tags: string[]
          to_account_id: string | null
          type: Database["public"]["Enums"]["tx_type"]
          updated_at: string
          workspace_id: string
        }
        Insert: {
          account_id?: string | null
          amount: number
          attachment_path?: string | null
          card_id?: string | null
          category_id?: string | null
          competence_date?: string
          created_at?: string
          created_by?: string
          debt_id?: string | null
          description: string
          due_date?: string | null
          id?: string
          installment_group?: string | null
          installment_no?: number | null
          installment_total?: number | null
          invoice_month?: string | null
          notes?: string | null
          paid_date?: string | null
          recurrence?: string | null
          responsible_id?: string | null
          status?: Database["public"]["Enums"]["tx_status"]
          tags?: string[]
          to_account_id?: string | null
          type: Database["public"]["Enums"]["tx_type"]
          updated_at?: string
          workspace_id: string
        }
        Update: {
          account_id?: string | null
          amount?: number
          attachment_path?: string | null
          card_id?: string | null
          category_id?: string | null
          competence_date?: string
          created_at?: string
          created_by?: string
          debt_id?: string | null
          description?: string
          due_date?: string | null
          id?: string
          installment_group?: string | null
          installment_no?: number | null
          installment_total?: number | null
          invoice_month?: string | null
          notes?: string | null
          paid_date?: string | null
          recurrence?: string | null
          responsible_id?: string | null
          status?: Database["public"]["Enums"]["tx_status"]
          tags?: string[]
          to_account_id?: string | null
          type?: Database["public"]["Enums"]["tx_type"]
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "financial_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "credit_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_to_account_id_fkey"
            columns: ["to_account_id"]
            isOneToOne: false
            referencedRelation: "financial_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      workspace_invites: {
        Row: {
          created_at: string
          email: string
          hide_balances: boolean
          id: string
          invited_by: string
          role: Database["public"]["Enums"]["workspace_role"]
          status: Database["public"]["Enums"]["invite_status"]
          workspace_id: string
        }
        Insert: {
          created_at?: string
          email: string
          hide_balances?: boolean
          id?: string
          invited_by: string
          role?: Database["public"]["Enums"]["workspace_role"]
          status?: Database["public"]["Enums"]["invite_status"]
          workspace_id: string
        }
        Update: {
          created_at?: string
          email?: string
          hide_balances?: boolean
          id?: string
          invited_by?: string
          role?: Database["public"]["Enums"]["workspace_role"]
          status?: Database["public"]["Enums"]["invite_status"]
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_invites_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_members: {
        Row: {
          can_invite: boolean
          created_at: string
          hide_balances: boolean
          id: string
          role: Database["public"]["Enums"]["workspace_role"]
          user_id: string
          workspace_id: string
        }
        Insert: {
          can_invite?: boolean
          created_at?: string
          hide_balances?: boolean
          id?: string
          role?: Database["public"]["Enums"]["workspace_role"]
          user_id: string
          workspace_id: string
        }
        Update: {
          can_invite?: boolean
          created_at?: string
          hide_balances?: boolean
          id?: string
          role?: Database["public"]["Enums"]["workspace_role"]
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_members_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspaces: {
        Row: {
          created_at: string
          currency: string
          expected_income: number
          id: string
          name: string
          onboarding_done: boolean
          owner_id: string
          suspended: boolean
          updated_at: string
        }
        Insert: {
          created_at?: string
          currency?: string
          expected_income?: number
          id?: string
          name: string
          onboarding_done?: boolean
          owner_id: string
          suspended?: boolean
          updated_at?: string
        }
        Update: {
          created_at?: string
          currency?: string
          expected_income?: number
          id?: string
          name?: string
          onboarding_done?: boolean
          owner_id?: string
          suspended?: boolean
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_edit_ws: { Args: { _ws: string }; Returns: boolean }
      can_manage_ws: { Args: { _ws: string }; Returns: boolean }
      create_workspace: {
        Args: { _income?: number; _name: string }
        Returns: string
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_ws_member: { Args: { _ws: string }; Returns: boolean }
      is_ws_owner: { Args: { _ws: string }; Returns: boolean }
      list_ws_members: {
        Args: { _ws: string }
        Returns: {
          email: string
          full_name: string
          hide_balances: boolean
          role: Database["public"]["Enums"]["workspace_role"]
          user_id: string
        }[]
      }
      ws_role: {
        Args: { _ws: string }
        Returns: Database["public"]["Enums"]["workspace_role"]
      }
    }
    Enums: {
      account_kind: "checking" | "savings" | "wallet" | "cash" | "investment"
      app_role: "platform_admin" | "support"
      debt_status: "active" | "paid" | "renegotiated"
      invite_status: "pending" | "accepted" | "revoked"
      subscription_status:
        | "trialing"
        | "active"
        | "past_due"
        | "canceled"
        | "suspended"
      tx_status: "pending" | "paid"
      tx_type:
        | "income"
        | "expense"
        | "transfer"
        | "refund"
        | "debt_payment"
        | "card_payment"
        | "adjustment"
      workspace_role: "owner" | "admin" | "editor" | "viewer" | "consultant"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      account_kind: ["checking", "savings", "wallet", "cash", "investment"],
      app_role: ["platform_admin", "support"],
      debt_status: ["active", "paid", "renegotiated"],
      invite_status: ["pending", "accepted", "revoked"],
      subscription_status: [
        "trialing",
        "active",
        "past_due",
        "canceled",
        "suspended",
      ],
      tx_status: ["pending", "paid"],
      tx_type: [
        "income",
        "expense",
        "transfer",
        "refund",
        "debt_payment",
        "card_payment",
        "adjustment",
      ],
      workspace_role: ["owner", "admin", "editor", "viewer", "consultant"],
    },
  },
} as const
