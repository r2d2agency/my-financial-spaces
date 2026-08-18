import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useWorkspace } from "@/lib/workspace";
import { brl, monthLabel, num, isIncomeType } from "@/lib/finance";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, Plus, TrendingUp, TrendingDown, Wallet, CreditCard, ArrowRight } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { dbQuery } from "@/lib/db.functions";
import { useState } from "react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
});

function Dashboard() {
  const { wsId } = useWorkspace();
  const [period, setPeriod] = useState({ month: new Date().getMonth() + 1, year: new Date().getFullYear() });
  const dbRpc = useServerFn(dbQuery);

  const { data, isLoading } = useQuery({
    queryKey: ["dashboard", wsId, period],
    enabled: !!wsId,
    queryFn: async () => {
      const summary = await dbRpc({
        action: "rpc",
        table: "transactions",
        rpcName: "get_dashboard_summary",
        rpcArgs: { workspace_id: wsId, month: period.month, year: period.year }
      });
      const cashFlow = await dbRpc({
        action: "rpc",
        table: "transactions",
        rpcName: "get_dashboard_cash_flow",
        rpcArgs: { workspace_id: wsId }
      });
      return { summary, cashFlow };
    },
  });

  if (isLoading) return <div className="space-y-4"><Skeleton className="h-32 w-full" /><Skeleton className="h-64 w-full" /></div>;

  const { summary, cashFlow } = data || {};
  const { s } = summary || {};
  
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

      {/* Indicadores Principais */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Saldo atual", val: summary.summary.total_balance, icon: Wallet },
          { label: "Entradas", val: summary.summary.income, icon: TrendingUp },
          { label: "Saídas", val: summary.summary.expense, icon: TrendingDown },
          { label: "Resultado", val: summary.summary.result, icon: Wallet }
        ].map(i => (
          <Card key={i.label}>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground font-medium uppercase">{i.label}</p>
              <p className="text-xl font-bold mt-1">{brl(i.val)}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Alertas */}
      {(summary.alerts.overdue_count > 0 || summary.alerts.soon_count > 0) && (
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertTitle>Precisa da sua atenção</AlertTitle>
          <AlertDescription className="text-sm">
             {summary.alerts.overdue_count > 0 && <span>{summary.alerts.overdue_count} itens atrasados no valor de {brl(summary.alerts.overdue_amount)}. </span>}
             {summary.alerts.soon_count > 0 && <span>{summary.alerts.soon_count} contas vencem nos próximos dias.</span>}
          </AlertDescription>
        </Alert>
      )}

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
           <Card>
             <CardHeader><CardTitle className="text-base">Fluxo de Caixa</CardTitle></CardHeader>
             <CardContent className="h-64">
               <ResponsiveContainer width="100%" height="100%">
                 <BarChart data={cashFlow.history}>
                   <CartesianGrid strokeDasharray="3 3" />
                   <XAxis dataKey="month" />
                   <YAxis />
                   <Tooltip formatter={(v: number) => brl(v)} />
                   <Bar dataKey="income" fill="green" name="Entradas" />
                   <Bar dataKey="expense" fill="red" name="Saídas" />
                 </BarChart>
               </ResponsiveContainer>
             </CardContent>
           </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle className="text-base">Cartões</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {summary.cards.map((c: any) => (
                <div key={c.id} className="flex justify-between items-center text-sm">
                  <span>{c.name}</span>
                  <span className="font-medium">{brl(c.used)} / {brl(c.limit)}</span>
                </div>
              ))}
              <Button variant="outline" className="w-full" asChild><Link to="/cartoes">Ver cartões</Link></Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
