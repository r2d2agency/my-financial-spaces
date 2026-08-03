import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/lib/workspace";
import { addMonths, brl, iso, monthLabel, monthRange, num, isIncomeType } from "@/lib/finance";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ChevronLeft, ChevronRight } from "lucide-react";

export const Route = createFileRoute("/_authenticated/calendario")({
  component: Calendario,
  head: () => ({
    meta: [
      { title: "Calendário financeiro · Espaço Financeiro" },
      { name: "description", content: "Veja dia a dia o que entra e o que sai, com vencimentos destacados." },
      { property: "og:title", content: "Calendário financeiro" },
      { property: "og:description", content: "Seu mês financeiro dia por dia." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function Calendario() {
  const { wsId } = useWorkspace();
  const [ref, setRef] = useState(() => new Date());
  const { start, end } = monthRange(ref);

  const { data } = useQuery({
    queryKey: ["cal", wsId, iso(start)],
    enabled: !!wsId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transactions")
        .select("id, description, amount, type, status, competence_date")
        .eq("workspace_id", wsId!)
        .gte("competence_date", iso(start))
        .lte("competence_date", iso(end));
      if (error) throw error;
      return data ?? [];
    },
  });

  const daysInMonth = end.getDate();
  const firstWeekday = start.getDay();
  const cells = [...Array(firstWeekday).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Calendário financeiro</h1>
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

      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium text-muted-foreground">
            {["D", "S", "T", "Q", "Q", "S", "S"].map((d, i) => (
              <span key={i}>{d}</span>
            ))}
          </div>
          <div className="mt-1 grid grid-cols-7 gap-1">
            {cells.map((day, i) => {
              if (day === null) return <div key={`e${i}`} />;
              const date = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
              const items = (data ?? []).filter((t) => t.competence_date === date);
              const inc = items.filter((t) => isIncomeType(t.type)).reduce((s, t) => s + num(t.amount), 0);
              const out = items.filter((t) => !isIncomeType(t.type) && t.type !== "transfer").reduce((s, t) => s + num(t.amount), 0);
              return (
                <div key={date} className="min-h-20 rounded-md border border-border p-1 text-left">
                  <span className="text-xs text-muted-foreground">{day}</span>
                  {inc > 0 && <p className="truncate text-[11px] text-primary">+{brl(inc)}</p>}
                  {out > 0 && <p className="truncate text-[11px] text-destructive">-{brl(out)}</p>}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
