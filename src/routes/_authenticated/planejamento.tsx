import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { db } from "@/lib/db-browser";
import { useWorkspace } from "@/lib/workspace";
import { addMonths, brl, iso, monthLabel, monthRange, num } from "@/lib/finance";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ChevronLeft, ChevronRight } from "lucide-react";

export const Route = createFileRoute("/_authenticated/planejamento")({
  component: Planejamento,
  head: () => ({
    meta: [
      { title: "Planejamento mensal · Espaço Financeiro" },
      { name: "description", content: "Defina o planejado por categoria e compare com o realizado do mês." },
      { property: "og:title", content: "Planejamento mensal" },
      { property: "og:description", content: "Planejado vs realizado, categoria por categoria." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function Planejamento() {
  const { wsId, canEdit } = useWorkspace();
  const qc = useQueryClient();
  const [ref, setRef] = useState(() => new Date());
  const { start, end } = monthRange(ref);
  const month = start.getMonth() + 1;
  const year = start.getFullYear();

  const { data } = useQuery({
    queryKey: ["plan", wsId, month, year],
    enabled: !!wsId,
    queryFn: async () => {
      const [cats, budgets, tx] = await Promise.all([
        db.from("categories").select("id, name, kind").eq("workspace_id", wsId!).eq("kind", "expense").order("name").execute(),
        db.from("budgets").select("id, category_id, amount").eq("workspace_id", wsId!).eq("period_month", month).eq("period_year", year).execute(),
        db
          .from("transactions")
          .select("amount, category_id, type")
          .eq("workspace_id", wsId!)
          .gte("competence_date", iso(start))
          .lte("competence_date", iso(end))
          .execute(),
      ]);
      return { cats: cats.data ?? [], budgets: budgets.data ?? [], tx: tx.data ?? [] };
    },
  });

  const save = useMutation({
    mutationFn: async (p: { category_id: string; planned: number }) => {
      await db.rpc("save_budget", {
        workspace_id: wsId!,
        category_id: p.category_id,
        amount: p.planned,
        month,
        year
      });
    },
    onSuccess: () => {
      toast.success("Planejamento salvo.");
      qc.invalidateQueries();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const realized = (catId: string) =>
    ((data as any)?.tx ?? []).filter((t: any) => t.category_id === catId && t.type === "expense").reduce((s: number, t: any) => s + num(t.amount), 0);
  const planned = (catId: string) => num(((data as any)?.budgets ?? []).find((b: any) => b.category_id === catId)?.amount);

  const totalPlan = ((data as any)?.cats ?? []).reduce((s: number, c: any) => s + planned(c.id), 0);
  const totalReal = ((data as any)?.cats ?? []).reduce((s: number, c: any) => s + realized(c.id), 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Planejamento mensal</h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => setRef((d) => addMonths(d, -1))}>
            <ChevronLeft className="size-4" />
          </Button>
          <span className="w-36 text-center text-sm capitalize">{monthLabel(ref)}</span>
          <Button variant="outline" size="icon" onClick={() => setRef((d) => addMonths(d, 1))}>
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card><CardContent className="pt-6"><p className="text-xs uppercase text-muted-foreground">Planejado</p><p className="text-2xl font-semibold">{brl(totalPlan)}</p></CardContent></Card>
        <Card><CardContent className="pt-6"><p className="text-xs uppercase text-muted-foreground">Realizado</p><p className="text-2xl font-semibold">{brl(totalReal)}</p></CardContent></Card>
        <Card><CardContent className="pt-6"><p className="text-xs uppercase text-muted-foreground">Diferença</p><p className="text-2xl font-semibold">{brl(totalPlan - totalReal)}</p></CardContent></Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Orçamentos por categoria</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {(data?.cats ?? []).map((c: any) => {
              const p = planned(c.id);
              const r = realized(c.id);
              const pct = p > 0 ? Math.min(100, (r / p) * 100) : 0;
              return (
                <div key={c.id} className="space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-sm font-medium text-foreground">{c.name}</span>
                    <div className="flex items-center gap-3">
                      <Input
                        className="h-8 w-28 text-right text-xs"
                        type="number"
                        defaultValue={p || ""}
                        placeholder="Planejado"
                        disabled={!canEdit}
                        onBlur={(e) => {
                          const v = num(e.target.value);
                          if (v !== p) save.mutate({ category_id: c.id, planned: v });
                        }}
                      />
                      <span className={`text-xs font-semibold ${p > 0 && r > p ? "text-rose-600" : "text-muted-foreground"}`}>
                        {brl(r)} / {brl(p)}
                      </span>
                    </div>
                  </div>
                  <div className="relative h-2 w-full overflow-hidden rounded-full bg-secondary">
                    <div 
                      className={`h-full transition-all ${pct >= 100 ? "bg-rose-500" : pct > 80 ? "bg-amber-500" : "bg-emerald-500"}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Resumo do Planejamento</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Utilização Total</p>
              <p className="text-2xl font-bold">{totalPlan > 0 ? Math.round((totalReal / totalPlan) * 100) : 0}%</p>
              <Progress value={totalPlan > 0 ? (totalReal / totalPlan) * 100 : 0} />
            </div>
            <div className="space-y-1 border-t pt-4">
              <p className="text-sm text-muted-foreground">Folga no Orçamento</p>
              <p className={`text-2xl font-bold ${totalPlan - totalReal < 0 ? "text-rose-600" : "text-emerald-600"}`}>
                {brl(totalPlan - totalReal)}
              </p>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Baseado nas despesas confirmadas e no valor planejado para cada categoria.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
