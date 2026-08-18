import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { db } from "@/lib/db-browser";
import type { Role } from "@/lib/finance";

export type Membership = {
  workspace_id: string;
  role: Role;
  hide_balances: boolean;
  workspaces: { id: string; name: string; expected_income: number; onboarding_done: boolean } | null;
};

type Ctx = {
  memberships: Membership[];
  current: Membership | null;
  wsId: string | null;
  role: Role | null;
  canEdit: boolean;
  canManage: boolean;
  isOwner: boolean;
  hideBalances: boolean;
  setWsId: (id: string) => void;
  refetch: () => void;
  loading: boolean;
};

const WorkspaceContext = createContext<Ctx | null>(null);
const STORAGE_KEY = "ef.workspace";

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const [wsId, setWsIdState] = useState<string | null>(null);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["memberships"],
    queryFn: async () => {
      const { data, error } = await db
        .from("workspace_members")
        .select("*")
        .order("created_at", { ascending: true })
        .execute();
      if (error) throw error;
      
      // Enriquecer manualmente para simular o join workspaces(...) removido para evitar erro de sintaxe SQL puro
      const memberships = (data ?? []) as any[];
      for (const m of memberships) {
        const { data: ws } = await db.from("workspaces").select("*").eq("id", m.workspace_id).maybeSingle();
        m.workspaces = ws;
      }
      return memberships as unknown as Membership[];
    },
  });

  const memberships = data ?? [];

  useEffect(() => {
    if (!memberships.length) return;
    const stored = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
    const valid = memberships.find((m) => m.workspace_id === (wsId ?? stored));
    const next = valid?.workspace_id ?? memberships[0]?.workspace_id ?? null;
    if (next !== wsId) setWsIdState(next);
  }, [memberships, wsId]);

  const setWsId = (id: string) => {
    localStorage.setItem(STORAGE_KEY, id);
    setWsIdState(id);
    qc.invalidateQueries();
  };

  const current = memberships.find((m) => m.workspace_id === wsId) ?? null;
  const role = current?.role ?? null;

  const value = useMemo<Ctx>(
    () => ({
      memberships,
      current,
      wsId,
      role,
      canEdit: role === "owner" || role === "admin" || role === "manager" || role === "operator",
      canManage: role === "owner" || role === "admin",
      isOwner: role === "owner",
      hideBalances: !!current?.hide_balances,
      setWsId,
      refetch,
      loading: isLoading,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [memberships, current, wsId, role, isLoading],
  );

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error("useWorkspace must be used inside WorkspaceProvider");
  return ctx;
}