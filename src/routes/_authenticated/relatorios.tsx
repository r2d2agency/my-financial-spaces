import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
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
  const from = monthRange(addMonths(now, -5)).start;
  const { end } = monthRange(now);

  const { data } = useQuery({
    queryKey: ["report", wsId, iso(from)],
    enabled: !!wsId,
    queryFn: async () => {
      const [tx, cats] = await Promise.all([
        supabase
          .from("transactions")
          .select("amount, type, competence_date, category_id")
          .eq("workspace_id", wsId!)
          .gte("competence_date", iso(from))
          .lte("competence_date", iso(end)),
        supabase.from("categories").select("id, name").eq("workspace_id", wsId!),
      ]);
      return { tx: tx.data ?? [], cats: cats.data ?? [] };
    },
  });

  const months = Array.from({ length: 6 }, (_, i) => addMonths(now, -5 + i));
  const series = months.map((m) => {
    const key = iso(m).slice(0, 7);
    const items = ((data as any)?.tx ?? []).filter((t: any) => t.competence_date.startsWith(key));
    return {
      mes: monthLabel(m).slice(0, 3),
      receitas: items.filter((t: any) => isIncomeType(t.type)).reduce((s: number, t: any) => s + num(t.amount), 0),
      despesas: items.filter((t: any) => !isIncomeType(t.type) && t.type !== "transfer").reduce((s: number, t: any) => s + num(t.amount), 0),
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
      <h1 className="text-2xl font-bold tracking-tight text-foreground">Relatórios</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Últimos 6 meses</CardTitle>
        </CardHeader>
        <CardContent className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={series}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="mes" fontSize={12} />
              <YAxis fontSize={12} />
              <Tooltip formatter={(v) => brl(Number(v))} />
              <Legend />
              <Bar dataKey="receitas" fill="#10b981" radius={4} />
              <Bar dataKey="despesas" fill="#ef4444" radius={4} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Despesas por categoria</CardTitle>
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
    </div>
  );
}
