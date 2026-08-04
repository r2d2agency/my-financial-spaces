import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { db } from "@/lib/db-browser";
import { useWorkspace } from "@/lib/workspace";
import { addMonths, brl, iso, monthLabel, monthRange, num, isIncomeType } from "@/lib/finance";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export const Route = createFileRoute("/_authenticated/relatorios")({
  component: Relatorios,
  head: () => ({
    meta: [
      { title: "Relatórios · Espaço Financeiro" },
      { name: "description", content: "Evolução de receitas e despesas nos últimos 6 meses e distribuição por categoria." },
      { property: "og:title", content: "Relatórios financeiros" },
      { property: "og:description", content: "Entenda para onde vai o seu dinheiro." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const COLORS = ["#10b981", "#0ea5e9", "#f59e0b", "#ef4444", "#8b5cf6", "#14b8a6", "#f43f5e", "#64748b"];

function Relatorios() {
  const { wsId } = useWorkspace();
  const now = new Date();
  
  // Passado: 6 meses atrás até hoje
  const pastFrom = monthRange(addMonths(now, -5)).start;
  // Futuro: Hoje até 6 meses à frente
  const futureEnd = monthRange(addMonths(now, 6)).end;

  const { data } = useQuery({
    queryKey: ["report-all", wsId],
    enabled: !!wsId,
    queryFn: async () => {
      const [tx, cats, recurring] = await Promise.all([
        db
          .from("transactions")
          .select("amount, type, competence_date, category_id, is_estimated")
          .eq("workspace_id", wsId!)
          .gte("competence_date", iso(pastFrom))
          .execute(),
        db.from("categories").select("id, name").eq("workspace_id", wsId!).execute(),
        db.from("recurring_transactions").select("amount, type, day_of_month, category_id").eq("workspace_id", wsId!).execute(),
      ]);
      return { 
        tx: tx.data ?? [], 
        cats: cats.data ?? [],
        recurring: recurring.data ?? []
      };
    },
  });

  // Histórico (6 meses)
  const pastMonths = Array.from({ length: 6 }, (_, i) => addMonths(now, -5 + i));
  const pastSeries = pastMonths.map((m) => {
    const key = iso(m).slice(0, 7);
    const items = ((data as any)?.tx ?? []).filter((t: any) => {
      const dateStr = typeof t.competence_date === 'string' ? t.competence_date : iso(new Date(t.competence_date));
      return dateStr.startsWith(key);
    });
    return {
      mes: monthLabel(m).slice(0, 3),
      receitas: items.filter((t: any) => isIncomeType(t.type)).reduce((s: number, t: any) => s + num(t.amount), 0),
      despesas: items.filter((t: any) => !isIncomeType(t.type) && t.type !== "transfer").reduce((s: number, t: any) => s + num(t.amount), 0),
    };
  });

  // Projeção (Próximos 6 meses)
  const projectionMonths = Array.from({ length: 6 }, (_, i) => addMonths(now, i + 1));
  const projectionSeries = projectionMonths.map((m) => {
    const key = iso(m).slice(0, 7);
    
    // Lançamentos já confirmados/agendados no futuro
    const existing = ((data as any)?.tx ?? []).filter((t: any) => {
      const dateStr = typeof t.competence_date === 'string' ? t.competence_date : iso(new Date(t.competence_date));
      return dateStr.startsWith(key);
    });

    // Adiciona os recorrentes que ainda não foram lançados como transação
    const rec = (data as any)?.recurring ?? [];
    const recIncome = rec.filter((r: any) => isIncomeType(r.type)).reduce((s: number, r: any) => s + num(r.amount), 0);
    const recExpense = rec.filter((r: any) => !isIncomeType(r.type)).reduce((s: number, r: any) => s + num(r.amount), 0);

    return {
      mes: monthLabel(m).slice(0, 3),
      receitas: existing.filter((t: any) => isIncomeType(t.type)).reduce((s: number, t: any) => s + num(t.amount), 0) + recIncome,
      despesas: existing.filter((t: any) => !isIncomeType(t.type) && t.type !== "transfer").reduce((s: number, t: any) => s + num(t.amount), 0) + recExpense,
    };
  });

  const byCat = ((data as any)?.cats ?? [])
    .map((c: any) => ({
      name: c.name,
      value: ((data as any)?.tx ?? [])
        .filter((t: any) => t.category_id === c.id && !isIncomeType(t.type) && t.type !== "transfer")
        .reduce((s: number, t: any) => s + num(t.amount), 0),
    }))
    .filter((c: any) => c.value > 0)
    .sort((a: any, b: any) => b.value - a.value)
    .slice(0, 8);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight text-foreground">Relatórios & Projeções</h1>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Histórico (Últimos 6 meses)</CardTitle>
          </CardHeader>
          <CardContent className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={pastSeries}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="mes" fontSize={12} />
                <YAxis fontSize={12} />
                <Tooltip formatter={(v) => brl(Number(v))} />
                <Legend />
                <Bar dataKey="receitas" fill="oklch(0.65 0.15 150)" name="Entradas" radius={4} />
                <Bar dataKey="despesas" fill="oklch(0.6 0.18 20)" name="Saídas" radius={4} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="border-primary/20 bg-primary/5">
          <CardHeader>
            <CardTitle className="text-base text-primary">Projeção (Próximos 6 meses)</CardTitle>
          </CardHeader>
          <CardContent className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={projectionSeries}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border opacity-50" />
                <XAxis dataKey="mes" fontSize={12} />
                <YAxis fontSize={12} />
                <Tooltip formatter={(v) => brl(Number(v))} />
                <Legend />
                <Bar dataKey="receitas" fill="oklch(0.65 0.15 150)" opacity={0.6} name="Entradas Previstas" radius={4} />
                <Bar dataKey="despesas" fill="oklch(0.6 0.18 20)" opacity={0.6} name="Saídas Previstas" radius={4} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Despesas por categoria (Geral)</CardTitle>
          </CardHeader>
          <CardContent className="h-80">
            {byCat.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sem dados suficientes.</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={byCat} dataKey="value" nameKey="name" outerRadius={110} label>
                    {byCat.map((_: any, i: number) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v) => brl(Number(v))} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Resumo do Mês</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {pastSeries[5] && (
              <>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Total Recebido</p>
                  <p className="text-2xl font-bold text-emerald-600">{brl(pastSeries[5].receitas)}</p>
                </div>
                <div className="space-y-1 border-t pt-4">
                  <p className="text-sm text-muted-foreground">Total Gasto</p>
                  <p className="text-2xl font-bold text-rose-600">{brl(pastSeries[5].despesas)}</p>
                </div>
                <div className="space-y-1 border-t pt-4">
                  <p className="text-sm text-muted-foreground">Saldo do Período</p>
                  <p className="text-2xl font-bold">{brl(pastSeries[5].receitas - pastSeries[5].despesas)}</p>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
