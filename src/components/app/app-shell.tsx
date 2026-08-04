import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { signOut as localSignOut } from "@/lib/auth-client.functions";
import { useServerFn } from "@tanstack/react-start";
import { db } from "@/lib/db-browser";
import { useWorkspace } from "@/lib/workspace";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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
  Bell,
  ShieldCheck,
} from "lucide-react";
import { QuickTransaction } from "./quick-transaction";

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

  const { data: isPlatformAdmin } = useQuery({
    queryKey: ["is-platform-admin"],
    queryFn: async () => {
      const { data } = await db
        .from("user_roles")
        .select("role")
        .eq("role", "platform_admin")
        .maybeSingle();
      return !!data;
    },
  });

  const { data: notifications } = useQuery({
    queryKey: ["notifications"],
    queryFn: async () => {
      const { data } = await db
        .from("notifications")
        .select("id, title, body, read_at, created_at")
        .order("created_at", { ascending: false })
        .execute();
      return data ?? [];
    },
  });

  const unread = (notifications ?? []).filter((n: any) => !n.read_at).length;

  const markRead = useMutation({
    mutationFn: async () => {
      const ids = (notifications ?? []).filter((n: any) => !n.read_at).map((n: any) => n.id);
      if (!ids.length) return;
      await db.from("notifications").update({ read_at: new Date().toISOString() }).in("id", ids).execute();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const signOut = async () => {
    await qc.cancelQueries();
    qc.clear();
    await localSignOut({});
    localStorage.removeItem("auth_token");
    navigate({ to: "/auth", replace: true });
  };

  const bell = (
    <Popover onOpenChange={(open) => open && unread > 0 && markRead.mutate()}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="relative">
          <Bell className="size-4" />
          {unread > 0 && (
            <Badge className="absolute -right-1 -top-1 h-4 min-w-4 justify-center px-1 text-[10px]">
              {unread}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <p className="border-b border-border px-3 py-2 text-sm font-medium">Notificações</p>
        <div className="max-h-72 divide-y overflow-y-auto">
          {(notifications ?? []).length === 0 && (
            <p className="p-3 text-sm text-muted-foreground">Nenhuma notificação por aqui.</p>
          )}
          {(notifications ?? []).map((n: any) => (
            <div key={n.id} className="p-3">
              <p className="text-sm font-medium">{n.title}</p>
              {n.body && <p className="text-xs text-muted-foreground">{n.body}</p>}
              <p className="mt-1 text-[11px] text-muted-foreground">
                {new Date(n.created_at).toLocaleString("pt-BR")}
              </p>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );

  return (
    <div className="flex min-h-screen bg-muted/20">
      <aside className="hidden w-64 shrink-0 flex-col border-r border-border bg-background lg:flex">
        <div className="flex h-16 items-center gap-2 border-b border-border px-4 font-semibold">
          <span className="grid size-8 place-items-center rounded-lg bg-primary text-primary-foreground">
            <Wallet className="size-4" />
          </span>
          Espaço Financeiro
        </div>
        <div className="border-b border-border p-3 space-y-2">
          <Select value={wsId ?? ""} onValueChange={setWsId}>
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
          <div className="flex flex-col gap-1">
            {current && (
              <p className="px-1 text-[10px] uppercase font-bold tracking-wider text-muted-foreground/60">
                Acesso: {current.role === 'owner' ? 'Proprietário' : current.role === 'admin' ? 'Administrador' : current.role === 'editor' ? 'Editor' : 'Visualizador'}
              </p>
            )}
            <Button 
              asChild 
              variant="outline" 
              size="sm" 
              className="w-full h-8 text-xs border-dashed"
            >
              <Link to="/onboarding">+ Novo Espaço</Link>
            </Button>
          </div>
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
          {isPlatformAdmin && (
            <Link
              to="/admin"
              className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors ${
                pathname.startsWith("/admin")
                  ? "bg-primary/10 font-medium text-primary"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
              }`}
            >
              <ShieldCheck className="size-4" />
              Administração
            </Link>
          )}
        </nav>
        <div className="flex items-center justify-between border-t border-border p-2">
          <Button variant="ghost" className="justify-start" onClick={signOut}>
            <LogOut className="mr-2 size-4" /> Sair
          </Button>
          {bell}
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 items-center justify-between gap-3 border-b border-border bg-background px-4 lg:hidden">
          <span className="font-semibold">Espaço Financeiro</span>
          <div className="flex items-center gap-1">
            {bell}
            <Button size="sm" variant="ghost" onClick={signOut}>
              <LogOut className="size-4" />
            </Button>
          </div>
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
          {isPlatformAdmin && (
            <Link
              to="/admin"
              className="whitespace-nowrap rounded-md px-3 py-1.5 text-xs text-muted-foreground hover:bg-accent"
            >
              Administração
            </Link>
          )}
        </div>
        <main className="min-w-0 flex-1 p-4 sm:p-6">
          {children}
          <QuickTransaction />
        </main>
      </div>
    </div>
  );
}
