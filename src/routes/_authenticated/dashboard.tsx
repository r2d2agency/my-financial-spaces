import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useWorkspace } from "@/lib/workspace";
import { brl, monthLabel, num, isIncomeType } from "@/lib/finance";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, TrendingUp, TrendingDown, Wallet, ArrowRight, Minus } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { dbQuery } from "@/lib/db.functions";
import { useState } from "react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
});

function Dashboard() {
  const { wsId } = useWorkspace();
  const [period, setPeriod] = useState({ month: new Date().getMonth() + 1, year: new Date().getFullYear() });
  const dbRpc = useServerFn(dbQuery);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["dashboard", wsId, period],
    enabled: !!wsId,
    retry: false,
    queryFn: async () => {
      const summary = await dbRpc({
        data: {
          action: "rpc",
          table: "transactions",
          rpcName: "get_dashboard_summary",
          rpcArgs: { workspace_id: wsId, month: period.month, year: period.year }
        }
      });
      const cashFlow = await dbRpc({
        data: {
          action: "rpc",
          table: "transactions",
          rpcName: "get_dashboard_cash_flow",
          rpcArgs: { workspace_id: wsId }
        }
      });
      return { summary, cashFlow };
    },
  });

  if (error) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Visão geral</h1>
        <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-6 space-y-3">
          <p className="font-semibold text-destructive">Não foi possível carregar o dashboard</p>
          <p className="text-sm text-destructive/80">{(error as Error).message}</p>
          <Button variant="outline" onClick={() => refetch()}>Tentar novamente</Button>
        </div>
      </div>
    );
  }

  if (isLoading) return <div className="space-y-4"><Skeleton className="h-32 w-full" /><Skeleton className="h-64 w-full" /></div>;

  const summary: any = (data as any)?.summary ?? {};
  const cashFlow: any = (data as any)?.cashFlow ?? {};
  const alerts = summary.alerts ?? { overdue_count: 0, overdue_amount: 0, soon_count: 0 };
  const indicators = summary.summary ?? { total_balance: 0, income: 0, expense: 0, result: 0, to_receive: 0, to_pay: 0, prev_income: 0, prev_expense: 0 };
  const upcoming: any[] = summary.upcoming ?? [];
  const accounts: any[] = summary.accounts ?? [];
  const cards: any[] = summary.cards ?? [];
  const top_categories: any[] = summary.top_categories ?? [];
  const history: any[] = cashFlow.history ?? [];
  const projections: any[] = cashFlow.projections ?? [];
  
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Visão geral</h1>
          <p className="text-sm text-muted-foreground">Acompanhe sua situação financeira e os próximos compromissos.</p>
        </div>
        <div className="flex gap-2">
           <Button variant="outline" size="sm" onClick={() => setPeriod(p => ({...p, month: p.month === 1 ? 12 : p.month - 1, year: p.month === 1 ? p.year - 1 : p.year}))}>{"<"}</Button>
           <div className="text-sm font-medium pt-1">{new Date(period.year, period.month - 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric'})}</div>
           <Button variant="outline" size="sm" onClick={() => setPeriod(p => ({...p, month: p.month === 12 ? 1 : p.month + 1, year: p.month === 12 ? p.year + 1 : p.year}))}>{">"}</Button>
        </div>
      </div>

      {/* Alertas */}
      {(alerts.overdue_count > 0 || alerts.soon_count > 0) && (
        <div className="grid gap-4">
          {alerts.overdue_count > 0 && (
            <div className="bg-destructive/10 border border-destructive/20 text-destructive rounded-lg p-4 flex gap-3 relative overflow-hidden group">
              <div className="absolute inset-0 bg-destructive/5 opacity-0 group-hover:opacity-100 transition-opacity" />
              <AlertCircle className="size-5 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-bold">Itens atrasados</p>
                <p className="text-xs mt-1">
                  {alerts.overdue_count} lançamentos estão vencidos, totalizando {brl(alerts.overdue_amount)}.
                </p>
              </div>
              <Link to="/movimentacoes" search={{ account_id: undefined, card_id: undefined, cost_center_id: undefined, tag_id: undefined }} className="absolute inset-0 z-10" />
            </div>
          )}
          {alerts.soon_count > 0 && (
            <Alert className="border-amber-500/50 bg-amber-500/5 text-amber-600 dark:text-amber-400">
              <AlertCircle className="size-4" />
              <AlertTitle>Próximos compromissos</AlertTitle>
              <AlertDescription className="text-sm">
                {alerts.soon_count} contas vencem nos próximos 7 dias.
              </AlertDescription>
            </Alert>
          )}
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Fluxo de Caixa</CardTitle>
              <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-sm bg-emerald-500" /> Entradas</div>
                <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-sm bg-rose-500" /> Saídas</div>
              </div>
            </CardHeader>
            <CardContent className="h-[300px] pt-4">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={history} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-muted/30" />
                  <XAxis 
                    dataKey="month" 
                    axisLine={false} 
                    tickLine={false} 
                    fontSize={12} 
                    tick={{ fill: 'hsl(var(--muted-foreground))' }}
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    fontSize={12} 
                    tick={{ fill: 'hsl(var(--muted-foreground))' }}
                    tickFormatter={(v) => `R$ ${v / 1000}k`}
                  />
                  <Tooltip 
                    cursor={{ fill: 'hsl(var(--muted)/0.3)' }}
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                    formatter={(v: number) => [brl(v), ""]} 
                  />
                  <Bar dataKey="income" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} barSize={32} />
                  <Bar dataKey="expense" fill="#f43f5e" radius={[4, 4, 0, 0]} barSize={32} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Projeção de Saldo</CardTitle>
              <Badge variant="outline" className="font-normal text-[10px] uppercase tracking-wider">Próximos 90 dias</Badge>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 py-2">
                {projections.map((p: any) => (
                  <div key={p.days} className="p-3 rounded-lg border bg-muted/20">
                    <p className="text-[10px] uppercase font-bold text-muted-foreground">{p.days} dias</p>
                    <p className={cn(
                      "text-sm font-bold mt-1",
                      p.estimated_balance < 0 ? "text-destructive" : "text-foreground"
                    )}>
                      {brl(p.estimated_balance)}
                    </p>
                  </div>
                ))}
              </div>
              {projections.some((p: any) => p.estimated_balance < 0) && (
                <div className="mt-4 p-3 rounded-lg bg-destructive/10 border border-destructive/20 flex items-center gap-2 text-xs text-destructive">
                  <AlertCircle className="size-4" />
                  <span>Atenção: sua projeção indica saldo negativo nos próximos meses.</span>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="grid md:grid-cols-2 gap-6">
            <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">A Receber</CardTitle>
              <Button variant="ghost" size="sm" asChild className="h-7 text-xs">
                <Link to="/movimentacoes" search={{ account_id: undefined, card_id: undefined, cost_center_id: undefined, tag_id: undefined }}>Ver todas</Link>
              </Button>
            </CardHeader>
              <CardContent className="pt-0 space-y-3">
                {upcoming.filter((t: any) => isIncomeType(t.type)).length === 0 ? (
                  <p className="text-xs text-muted-foreground py-4 text-center">Nenhuma receita pendente.</p>
                ) : (
                  upcoming.filter((t: any) => isIncomeType(t.type)).slice(0, 5).map((t: any) => (
                    <div key={t.id} className="flex justify-between items-center group">
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{t.description}</p>
                        <p className="text-[10px] text-muted-foreground">{new Date(t.due_date).toLocaleDateString('pt-BR')}</p>
                      </div>
                      <p className="text-sm font-bold text-emerald-600">{brl(Math.abs(t.amount))}</p>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">A Pagar</CardTitle>
              <Button variant="ghost" size="sm" asChild className="h-7 text-xs">
                <Link to="/movimentacoes" search={{ account_id: undefined, card_id: undefined, cost_center_id: undefined, tag_id: undefined }}>Ver todas</Link>
              </Button>
            </CardHeader>
              <CardContent className="pt-0 space-y-3">
                {upcoming.filter((t: any) => !isIncomeType(t.type)).length === 0 ? (
                  <p className="text-xs text-muted-foreground py-4 text-center">Nenhuma despesa pendente.</p>
                ) : (
                  upcoming.filter((t: any) => !isIncomeType(t.type)).slice(0, 5).map((t: any) => (
                    <div key={t.id} className="flex justify-between items-center">
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{t.description}</p>
                        <p className="text-[10px] text-muted-foreground">{new Date(t.due_date).toLocaleDateString('pt-BR')}</p>
                      </div>
                      <p className="text-sm font-bold text-rose-600">{brl(Math.abs(t.amount))}</p>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Onde está seu dinheiro</CardTitle>
              <Button variant="ghost" size="icon" asChild className="h-8 w-8"><Link to="/contas"><ArrowRight className="size-4"/></Link></Button>
            </CardHeader>
            <CardContent className="pt-0 space-y-4">
              {accounts.map((a: any) => (
                <div key={a.id} className="space-y-1.5">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground truncate mr-2">{a.name}</span>
                    <span className={cn("font-bold", a.balance < 0 ? "text-destructive" : "text-foreground")}>
                      {brl(a.balance)}
                    </span>
                  </div>
                  <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-primary" 
                      style={{ width: `${Math.min(100, Math.max(0, (a.balance / (indicators.total_balance || 1)) * 100))}%` }} 
                    />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Cartões</CardTitle>
              <Button variant="ghost" size="icon" asChild className="h-8 w-8"><Link to="/cartoes"><ArrowRight className="size-4"/></Link></Button>
            </CardHeader>
            <CardContent className="pt-0 space-y-5">
              {cards.map((c: any) => {
                const pct = c.limit > 0 ? (c.used / c.limit) * 100 : 0;
                return (
                  <div key={c.id} className="space-y-2">
                    <div className="flex justify-between items-end">
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{c.name}</p>
                        {c.next_invoice && (
                          <p className="text-[10px] text-muted-foreground">Vence {new Date(c.next_invoice.due_date).toLocaleDateString('pt-BR')}</p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold">{brl(c.used)}</p>
                        <p className="text-[10px] text-muted-foreground">de {brl(c.limit)}</p>
                      </div>
                    </div>
                    <Progress value={pct} className={cn("h-1.5", pct > 90 ? "[&>div]:bg-destructive" : pct > 70 ? "[&>div]:bg-amber-500" : "")} />
                  </div>
                );
              })}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Maiores gastos do mês</CardTitle>
            </CardHeader>
            <CardContent className="pt-0 space-y-4">
              {top_categories.length === 0 ? (
                <p className="text-xs text-muted-foreground py-4 text-center">Nenhum gasto registrado.</p>
              ) : (
                top_categories.map((cat: any) => (
                  <div key={cat.name} className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">{cat.name}</span>
                    <span className="text-sm font-bold">{brl(cat.total)}</span>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
