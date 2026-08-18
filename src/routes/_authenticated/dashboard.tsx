import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { db } from "@/lib/db-browser";
import { useWorkspace } from "@/lib/workspace";
import { brl, iso, monthLabel, monthRange, num, isIncomeType } from "@/lib/finance";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
  head: () => ({
    meta: [
      { title: "Dashboard · Espaço Financeiro" },
      { name: "description", content: "Visão geral do mês: saldo, receitas, despesas, cartões, dívidas e metas." },
      { property: "og:title", content: "Dashboard · Espaço Financeiro" },
      { property: "og:description", content: "Acompanhe seu mês financeiro em um só lugar." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function Dashboard() {
  const { wsId, hideBalances, loading, memberships } = useWorkspace();
  const now = new Date();
  const { start, end } = monthRange(now);

  const { data } = useQuery({
    queryKey: ["dashboard", wsId, iso(start)],
    enabled: !!wsId,
    queryFn: async () => {
      const results = await Promise.all([
        db.from("transactions")
          .select("type, amount, status, competence_date, description, due_date")
          .eq("workspace_id", wsId!)
          .gte("competence_date", iso(start))
          .lte("competence_date", iso(end))
          .execute(),
        db.from("financial_accounts").select("id, name, initial_balance").eq("workspace_id", wsId!).eq("archived", false).execute(),
        db.from("credit_cards").select("id, name, credit_limit").eq("workspace_id", wsId!).eq("archived", false).execute(),
        db.from("debts").select("id, name, outstanding, installment_amount").eq("workspace_id", wsId!).eq("status", "active").execute(),
        db.from("financial_goals").select("id, name, target_amount, current_amount, color").eq("workspace_id", wsId!).eq("archived", false).execute(),
        db.from("budgets").select("amount, category_id").eq("workspace_id", wsId!).eq("period_month", now.getMonth() + 1).eq("period_year", now.getFullYear()).execute(),
      ]);
      
      return {
        tx: results[0].data ?? [],
        accounts: results[1].data ?? [],
        cards: results[2].data ?? [],
        debts: results[3].data ?? [],
        goals: results[4].data ?? [],
        budgets: results[5].data ?? [],
      };
    },
  });

  // Since I manually added a promise but the destructuring was fixed, let's just re-read the query logic to be sure
  // I will refactor the destructuring and use query data correctly.

  if (!loading && memberships.length === 0) {
    return (
      <Card className="mx-auto max-w-lg">
        <CardHeader>
          <CardTitle>Você ainda não tem um espaço</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Crie seu primeiro espaço financeiro para começar.
          </p>
          <Button asChild className="mt-4">
            <Link to="/onboarding">Criar espaço</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  const tx = data?.tx ?? [];
  const income = tx.filter((t: any) => isIncomeType(t.type)).reduce((s: number, t: any) => s + num(t.amount), 0);
  const expense = tx.filter((t: any) => !isIncomeType(t.type) && t.type !== "transfer").reduce((s: number, t: any) => s + num(t.amount), 0);
  const pending = tx.filter((t: any) => t.status === "pending" && !isIncomeType(t.type)).reduce((s: number, t: any) => s + num(t.amount), 0);
  const balance = (data?.accounts ?? []).reduce((s: number, a: any) => s + num(a.initial_balance), 0) + income - expense;
  const debtTotal = (data?.debts ?? []).reduce((s: number, d: any) => s + num(d.outstanding), 0);

  const byDay = Object.values(
    (tx as any[]).reduce<Record<string, { dia: string; receitas: number; despesas: number }>>((acc: any, t: any) => {
      const key = typeof t.competence_date === 'string' ? t.competence_date : iso(new Date(t.competence_date));
      acc[key] ??= { dia: key.slice(8, 10), receitas: 0, despesas: 0 };
      if (isIncomeType(t.type)) acc[key].receitas += num(t.amount);
      else if (t.type !== "transfer") acc[key].despesas += num(t.amount);
      return acc;
    }, {}),
  ).sort((a: any, b: any) => a.dia.localeCompare(b.dia));

  const money = (v: number) => (hideBalances ? "•••••" : brl(v));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Dashboard</h1>
          <p className="text-sm capitalize text-muted-foreground">{monthLabel(now)}</p>
        </div>
        <Button asChild>
          <Link to="/movimentacoes" search={(prev: any) => ({ ...prev, account_id: undefined, card_id: undefined })}>Nova movimentação</Link>
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Saldo estimado", value: money(balance), trend: "Disponível em conta" },
          { label: "Receitas do mês", value: money(income), trend: "Entradas confirmadas" },
          { label: "Despesas do mês", value: money(expense), trend: "Saídas confirmadas" },
          { label: "Uso do Orçamento", value: `${data?.budgets?.length ? Math.round((expense / data.budgets.reduce((s: number, b: any) => s + num(b.amount), 0)) * 100) : 0}%`, trend: "vs planejado" },
        ].map((k) => (
          <Card key={k.label} className="overflow-hidden border-none bg-background shadow-sm ring-1 ring-border">
            <CardContent className="p-5">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{k.label}</p>
              <div className="mt-2 flex items-baseline justify-between">
                <p className="text-2xl font-bold tracking-tight text-foreground">{k.value}</p>
              </div>
              <p className="mt-1 text-[10px] text-muted-foreground">{k.trend}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Receitas x Despesas por dia</CardTitle>
        </CardHeader>
        <CardContent className="h-72">
          {byDay.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma movimentação neste mês.</p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byDay}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="dia" fontSize={12} />
                <YAxis fontSize={12} />
                <Tooltip formatter={(v) => brl(Number(v))} />
                <Bar dataKey="receitas" fill="hsl(var(--primary))" radius={4} />
                <Bar dataKey="despesas" fill="hsl(var(--destructive))" radius={4} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Dívidas ativas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p className="text-2xl font-semibold text-foreground">{money(debtTotal)}</p>
            {(data?.debts ?? []).slice(0, 4).map((d: any) => (
              <div key={d.id} className="flex justify-between text-muted-foreground">
                <span>{d.name}</span>
                <span>{money(num(d.outstanding))}</span>
              </div>
            ))}
            <Button asChild variant="link" className="px-0">
              <Link to="/dividas">Ver dívidas e simulações</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Cartões</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            {(data?.cards ?? []).length === 0 && <p>Nenhum cartão cadastrado.</p>}
            {(data?.cards ?? []).map((c: any) => (
              <div key={c.id} className="flex justify-between">
                <span>{c.name}</span>
                <span>{money(num(c.credit_limit))}</span>
              </div>
            ))}
            <Button asChild variant="link" className="px-0">
              <Link to="/cartoes">Gerenciar cartões</Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="lg:col-span-1">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base font-semibold">Metas Financeiras</CardTitle>
            <Button asChild variant="ghost" size="sm" className="h-8 px-2 text-xs">
              <Link to="/planejamento">Ver mais</Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            {(data?.goals ?? []).length === 0 && <p className="text-muted-foreground">Nenhuma meta ativa.</p>}
            {(data?.goals ?? []).map((g: any) => {
              const pct = num(g.target_amount) > 0 ? (num(g.current_amount) / num(g.target_amount)) * 100 : 0;
              return (
                <div key={g.id}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="font-medium text-foreground">{g.name}</span>
                    <span className="text-muted-foreground">{money(num(g.current_amount))} / {money(num(g.target_amount))}</span>
                  </div>
                  <div className="relative h-2 w-full overflow-hidden rounded-full bg-secondary">
                    <div 
                      className="h-full bg-primary transition-all"
                      style={{ width: `${Math.min(100, pct)}%`, backgroundColor: g.color || 'hsl(var(--primary))' }}
                    />
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
