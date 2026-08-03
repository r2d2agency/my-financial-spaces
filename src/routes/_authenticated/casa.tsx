import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { db } from "@/lib/db-browser";
import { useWorkspace } from "@/lib/workspace";
import { brl, iso, monthLabel, monthRange, num } from "@/lib/finance";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

export const Route = createFileRoute("/_authenticated/casa")({
  component: Casa,
  head: () => ({
    meta: [
      { title: "Casa e Família · Espaço Financeiro" },
      { name: "description", content: "Custos de moradia e da família: moradia, água, energia, mercado, educação e mais." },
      { property: "og:title", content: "Casa e Família" },
      { property: "og:description", content: "Acompanhe o custo real da sua casa mês a mês." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function Casa() {
  const { wsId, hideBalances } = useWorkspace();
  const now = new Date();
  const { start, end } = monthRange(now);

  const { data } = useQuery({
    queryKey: ["casa", wsId, iso(start)],
    enabled: !!wsId,
    queryFn: async () => {
      const [cats, tx] = await Promise.all([
        supabase.from("categories").select("id, name, is_house_cost").eq("workspace_id", wsId!).eq("is_house_cost", true),
        supabase
          .from("transactions")
          .select("amount, category_id, type")
          .eq("workspace_id", wsId!)
          .gte("competence_date", iso(start))
          .lte("competence_date", iso(end)),
      ]);
      return { cats: cats.data ?? [], tx: tx.data ?? [] };
    },
  });

  const cats = data?.cats ?? [];
  const totals = (cats as any[])
    .map((c: any) => ({
      name: c.name,
      total: ((data as any)?.tx ?? [])
        .filter((t: any) => t.category_id === c.id && t.type === "expense")
        .reduce((s: number, t: any) => s + num(t.amount), 0),
    }))
    .sort((a: any, b: any) => b.total - a.total);
  const grand = totals.reduce((s: number, t: any) => s + t.total, 0);
  const money = (v: number) => (hideBalances ? "•••" : brl(v));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Casa e Família</h1>
        <p className="text-sm capitalize text-muted-foreground">{monthLabel(now)}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Custo total da casa</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-semibold text-foreground">{money(grand)}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Por categoria</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {totals.length === 0 && <p className="text-sm text-muted-foreground">Sem categorias de moradia.</p>}
          {totals.map((t: any) => (
            <div key={t.name}>
              <div className="flex justify-between text-sm">
                <span className="text-foreground">{t.name}</span>
                <span className="text-muted-foreground">{money(t.total)}</span>
              </div>
              <Progress className="mt-1" value={grand > 0 ? (t.total / grand) * 100 : 0} />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
