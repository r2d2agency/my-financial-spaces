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
      const [tx, accounts, cards, debts, goals] = await Promise.all([
        db.from("transactions")
          .select("type, amount, status, competence_date, description, due_date")
          .eq("workspace_id", wsId!)
          .gte("competence_date", iso(start))
          .lte("competence_date", iso(end))
          .execute(),
        db.from("financial_accounts").select("id, name, initial_balance").eq("workspace_id", wsId!).eq("archived", false).execute(),
        db.from("credit_cards").select("id, name, credit_limit").eq("workspace_id", wsId!).eq("archived", false).execute(),
        db.from("debts").select("id, name, outstanding, installment_amount").eq("workspace_id", wsId!).eq("status", "active").execute(),
        db.from("financial_goals").select("id, name, target_amount, current_amount").eq("workspace_id", wsId!).execute(),
      ]);
      if (tx.error) throw tx.error;
      return {
        tx: tx.data ?? [],
        accounts: accounts.data ?? [],
        cards: cards.data ?? [],
        debts: debts.data ?? [],
        goals: goals.data ?? [],
      };
    },
  });

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
          <Link to="/movimentacoes">Nova movimentação</Link>
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Saldo estimado", value: money(balance) },
          { label: "Receitas do mês", value: money(income) },
          { label: "Despesas do mês", value: money(expense) },
          { label: "A pagar (pendente)", value: money(pending) },
        ].map((k) => (
          <Card key={k.label}>
            <CardContent className="pt-6">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">{k.label}</p>
              <p className="mt-1 text-2xl font-semibold text-foreground">{k.value}</p>
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

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Metas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {(data?.goals ?? []).length === 0 && <p className="text-muted-foreground">Nenhuma meta cadastrada.</p>}
            {(data?.goals ?? []).map((g: any) => {
              const pct = num(g.target_amount) > 0 ? (num(g.current_amount) / num(g.target_amount)) * 100 : 0;
              return (
                <div key={g.id}>
                  <div className="flex justify-between text-muted-foreground">
                    <span>{g.name}</span>
                    <span>{Math.min(100, Math.round(pct))}%</span>
                  </div>
                  <Progress value={Math.min(100, pct)} className="mt-1" />
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
