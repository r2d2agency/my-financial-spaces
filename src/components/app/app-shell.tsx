import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/lib/workspace";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  LayoutDashboard,
  ArrowLeftRight,
  Home,
  CreditCard,
  TrendingDown,
  Target,
  CalendarDays,
  BarChart3,
  Settings,
  LogOut,
  Wallet,
} from "lucide-react";

const nav = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/movimentacoes", label: "Movimentações", icon: ArrowLeftRight },
  { to: "/casa", label: "Casa e Família", icon: Home },
  { to: "/cartoes", label: "Cartões", icon: CreditCard },
  { to: "/dividas", label: "Dívidas", icon: TrendingDown },
  { to: "/planejamento", label: "Planejamento", icon: Target },
  { to: "/calendario", label: "Calendário", icon: CalendarDays },
  { to: "/relatorios", label: "Relatórios", icon: BarChart3 },
  { to: "/configuracoes", label: "Configurações", icon: Settings },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const { memberships, wsId, setWsId, current } = useWorkspace();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const signOut = async () => {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  return (
    <div className="flex min-h-screen bg-muted/20">
      <aside className="hidden w-64 shrink-0 flex-col border-r border-border bg-background lg:flex">
        <div className="flex h-16 items-center gap-2 border-b border-border px-4 font-semibold">
          <span className="grid size-8 place-items-center rounded-lg bg-primary text-primary-foreground">
            <Wallet className="size-4" />
          </span>
          Espaço Financeiro
        </div>
        <div className="border-b border-border p-3">
          <Select value={wsId ?? undefined} onValueChange={setWsId}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione o espaço" />
            </SelectTrigger>
            <SelectContent>
              {memberships.map((m) => (
                <SelectItem key={m.workspace_id} value={m.workspace_id}>
                  {m.workspaces?.name ?? "Espaço"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {current && (
            <p className="mt-2 px-1 text-xs capitalize text-muted-foreground">
              Seu papel: {current.role}
            </p>
          )}
        </div>
        <nav className="flex-1 space-y-1 p-2">
          {nav.map((n) => {
            const active = pathname.startsWith(n.to);
            return (
              <Link
                key={n.to}
                to={n.to}
                className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors ${
                  active
                    ? "bg-primary/10 font-medium text-primary"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                }`}
              >
                <n.icon className="size-4" />
                {n.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-border p-2">
          <Button variant="ghost" className="w-full justify-start" onClick={signOut}>
            <LogOut className="mr-2 size-4" /> Sair
          </Button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 items-center justify-between gap-3 border-b border-border bg-background px-4 lg:hidden">
          <span className="font-semibold">Espaço Financeiro</span>
          <Button size="sm" variant="ghost" onClick={signOut}>
            <LogOut className="size-4" />
          </Button>
        </header>
        <div className="flex gap-1 overflow-x-auto border-b border-border bg-background px-2 py-2 lg:hidden">
          {nav.map((n) => (
            <Link
              key={n.to}
              to={n.to}
              className="whitespace-nowrap rounded-md px-3 py-1.5 text-xs text-muted-foreground hover:bg-accent"
            >
              {n.label}
            </Link>
          ))}
        </div>
        <main className="min-w-0 flex-1 p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
