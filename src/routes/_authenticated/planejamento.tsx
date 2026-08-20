import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { toast } from "sonner";
import { dbQuery } from "@/lib/db.functions";
import { useWorkspace } from "@/lib/workspace";
import { addMonths, brl, monthLabel, num, isIncomeType, isExpenseType } from "@/lib/finance";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { 
  ChevronLeft, 
  ChevronRight, 
  Copy, 
  AlertCircle, 
  CheckCircle2, 
  TrendingUp, 
  TrendingDown,
  ArrowUpRight,
  ArrowDownRight,
  Target,
  Info
} from "lucide-react";
import { 
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { 
  Drawer, 
  DrawerContent, 
  DrawerHeader, 
  DrawerTitle, 
  DrawerDescription 
} from "@/components/ui/drawer";

export const Route = createFileRoute("/_authenticated/planejamento")({
  component: Planejamento,
  head: () => ({
    title: "Planejamento Financeiro · Espaço Financeiro",
    meta: [
      { name: "description", content: "Planeje receitas e despesas. Compare planejado, previsto e realizado." },
    ],
  }),
});

function Planejamento() {
  const { wsId, canEdit } = useWorkspace();
  const qc = useQueryClient();
  const [ref, setRef] = useState(() => new Date());
  const month = ref.getMonth() + 1;
  const year = ref.getFullYear();

  const [selectedCategory, setSelectedCategory] = useState<any>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["financial-planning", wsId, month, year],
    enabled: !!wsId,
    queryFn: async () => {
      return dbQuery({ 
        data: { 
          action: "rpc", 
          rpcName: "get_financial_planning", 
          rpcArgs: { workspace_id: wsId, month, year } 
        } 
      });
    },
  });

  const saveBudget = useMutation({
    mutationFn: async (p: { category_id: string; amount: number }) => {
      await dbQuery({ 
        data: { 
          action: "rpc", 
          rpcName: "save_budget_item", 
          rpcArgs: { 
            workspace_id: wsId, 
            category_id: p.category_id, 
            amount: p.amount, 
            month, 
            year 
          } 
        } 
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["financial-planning"] });
    },
    onError: (e: Error) => toast.error("Erro ao salvar: " + e.message),
  });

  const copyPrevious = useMutation({
    mutationFn: async () => {
      await dbQuery({ 
        data: { 
          action: "rpc", 
          rpcName: "copy_previous_budget", 
          rpcArgs: { workspace_id: wsId, current_month: month, current_year: year } 
        } 
      });
    },
    onSuccess: (res: any) => {
      toast.success(`${res.count} orçamentos copiados com sucesso!`);
      qc.invalidateQueries({ queryKey: ["financial-planning"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const processedData = useMemo(() => {
    if (!data) return null;

    const categories = data.categories.map((cat: any) => {
      const budget = data.budgets.find((b: any) => b.category_id === cat.id);
      const stat = data.stats.find((s: any) => s.category_id === cat.id);
      
      const planned = num(budget?.amount);
      const realized = Math.abs(num(stat?.realized));
      const predicted = Math.abs(num(stat?.predicted));
      const committed = realized + predicted;
      
      const isIncome = isIncomeType(cat.type);
      const isExpense = isExpenseType(cat.type);

      // Regra de status
      let status: 'normal' | 'warning' | 'danger' | 'success' = 'normal';
      let statusText = '';
      
      if (isExpense) {
        if (planned > 0) {
          const pct = (committed / planned) * 100;
          if (pct > 100) {
            status = 'danger';
            statusText = `${brl(committed - planned)} acima do planejado`;
          } else if (pct > 80) {
            status = 'warning';
            statusText = 'Próximo do limite';
          }
        }
      } else if (isIncome) {
        if (planned > 0 && committed < planned) {
          statusText = `${brl(planned - committed)} para a meta`;
        } else if (planned > 0 && committed >= planned) {
          status = 'success';
          statusText = 'Meta atingida!';
        }
      }

      return {
        ...cat,
        planned,
        realized,
        predicted,
        committed,
        isIncome,
        isExpense,
        status,
        statusText,
        available: isExpense ? Math.max(0, planned - committed) : 0,
        pct: planned > 0 ? (committed / planned) * 100 : 0
      };
    });

    const income = categories.filter((c: any) => c.isIncome);
    const expenses = categories.filter((c: any) => c.isExpense);

    const totals = {
      plannedIncome: income.reduce((s: number, c: any) => s + c.planned, 0),
      realizedIncome: income.reduce((s: number, c: any) => s + c.realized, 0),
      committedIncome: income.reduce((s: number, c: any) => s + c.committed, 0),
      
      plannedExpense: expenses.reduce((s: number, c: any) => s + c.planned, 0),
      realizedExpense: expenses.reduce((s: number, c: any) => s + c.realized, 0),
      committedExpense: expenses.reduce((s: number, c: any) => s + c.committed, 0),
    };

    return { 
      income, 
      expenses, 
      totals,
      resultPlanned: totals.plannedIncome - totals.plannedExpense,
      resultCommitted: totals.committedIncome - totals.committedExpense,
      resultRealized: totals.realizedIncome - totals.realizedExpense
    };
  }, [data]);

  if (isLoading) return <div className="p-8 text-center text-muted-foreground">Carregando planejamento...</div>;

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-20">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Planejamento</h1>
          <p className="text-sm text-slate-500">Planeje receitas e despesas antes que elas aconteçam.</p>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="flex items-center bg-white border rounded-lg p-1 shadow-sm">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setRef(addMonths(ref, -1))}>
              <ChevronLeft className="size-4" />
            </Button>
            <span className="w-40 text-center text-sm font-semibold capitalize px-2">{monthLabel(ref)}</span>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setRef(addMonths(ref, 1))}>
              <ChevronRight className="size-4" />
            </Button>
          </div>
          
          <Button 
            variant="outline" 
            size="sm" 
            className="hidden sm:flex"
            disabled={!canEdit || copyPrevious.isPending}
            onClick={() => copyPrevious.mutate()}
          >
            <Copy className="size-4 mr-2" /> Copiar Mês Anterior
          </Button>
        </div>
      </div>

      {/* Resumo */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card className="shadow-none border-slate-200">
          <CardContent className="p-4 space-y-1">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Receitas Plan.</p>
            <p className="text-lg font-bold text-emerald-600">{brl(processedData?.totals.plannedIncome)}</p>
          </CardContent>
        </Card>
        <Card className="shadow-none border-slate-200">
          <CardContent className="p-4 space-y-1">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Despesas Plan.</p>
            <p className="text-lg font-bold text-rose-600">{brl(processedData?.totals.plannedExpense)}</p>
          </CardContent>
        </Card>
        <Card className="shadow-none border-slate-200 border-l-4 border-l-blue-500">
          <CardContent className="p-4 space-y-1">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Resultado Plan.</p>
            <p className={cn("text-lg font-bold", (processedData?.resultPlanned || 0) >= 0 ? "text-slate-900" : "text-rose-600")}>
              {brl(processedData?.resultPlanned)}
            </p>
          </CardContent>
        </Card>
        <Card className="shadow-none border-slate-200">
          <CardContent className="p-4 space-y-1">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Res. Previsto</p>
            <p className={cn("text-lg font-bold", (processedData?.resultCommitted || 0) >= 0 ? "text-slate-900" : "text-rose-600")}>
              {brl(processedData?.resultCommitted)}
            </p>
          </CardContent>
        </Card>
        <Card className="shadow-none border-slate-200">
          <CardContent className="p-4 space-y-1">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Res. Realizado</p>
            <p className={cn("text-lg font-bold", (processedData?.resultRealized || 0) >= 0 ? "text-slate-900" : "text-rose-600")}>
              {brl(processedData?.resultRealized)}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-8">
        {/* Orçamento de Despesas */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold flex items-center gap-2">
              <TrendingDown className="size-5 text-rose-500" />
              Orçamento de Despesas
            </h2>
          </div>
          
          <div className="space-y-3">
            {processedData?.expenses.length === 0 && (
              <p className="text-sm text-muted-foreground bg-slate-50 p-4 rounded-lg border border-dashed">
                Nenhuma categoria de despesa encontrada para planejar.
              </p>
            )}
            
            {processedData?.expenses.map((c: any) => (
              <BudgetCard 
                key={c.id} 
                item={c} 
                canEdit={canEdit} 
                onSave={(v) => saveBudget.mutate({ category_id: c.id, amount: v })}
                onDetail={() => setSelectedCategory(c)}
              />
            ))}
          </div>
        </section>

        {/* Metas de Receitas */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold flex items-center gap-2">
              <TrendingUp className="size-5 text-emerald-500" />
              Metas de Receitas
            </h2>
          </div>
          
          <div className="space-y-3">
             {processedData?.income.length === 0 && (
              <p className="text-sm text-muted-foreground bg-slate-50 p-4 rounded-lg border border-dashed">
                Nenhuma categoria de receita encontrada para planejar.
              </p>
            )}
            
            {processedData?.income.map((c: any) => (
              <BudgetCard 
                key={c.id} 
                item={c} 
                canEdit={canEdit} 
                onSave={(v) => saveBudget.mutate({ category_id: c.id, amount: v })}
                onDetail={() => setSelectedCategory(c)}
              />
            ))}
          </div>
        </section>
      </div>

      {/* Drawer de Detalhes (Opcional, pode ser ver em Movimentações futuramente) */}
      <Drawer open={!!selectedCategory} onOpenChange={(o) => !o && setSelectedCategory(null)}>
        <DrawerContent>
          <div className="mx-auto w-full max-w-lg">
            <DrawerHeader>
              <DrawerTitle className="flex items-center gap-2">
                <Target className="size-5 text-primary" />
                {selectedCategory?.name}
              </DrawerTitle>
              <DrawerDescription>Resumo de utilização para este mês.</DrawerDescription>
            </DrawerHeader>
            
            <div className="p-6 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Planejado</p>
                  <p className="text-xl font-bold text-slate-900">{brl(selectedCategory?.planned)}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Comprometido</p>
                  <p className="text-xl font-bold text-slate-900">{brl(selectedCategory?.committed)}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Realizado (Pago)</p>
                  <p className="text-lg font-semibold text-emerald-600">{brl(selectedCategory?.realized)}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Previsto (Pendente)</p>
                  <p className="text-lg font-semibold text-amber-600">{brl(selectedCategory?.predicted)}</p>
                </div>
              </div>

              {selectedCategory?.statusText && (
                <div className={cn(
                  "p-3 rounded-lg flex items-center gap-2 text-sm",
                  selectedCategory.status === 'danger' ? "bg-rose-50 text-rose-700" :
                  selectedCategory.status === 'warning' ? "bg-amber-50 text-amber-700" :
                  selectedCategory.status === 'success' ? "bg-emerald-50 text-emerald-700" : "bg-slate-50 text-slate-600"
                )}>
                  <Info className="size-4" />
                  {selectedCategory.statusText}
                </div>
              )}

              <Button 
                className="w-full" 
                variant="outline"
                onClick={() => toast.info("Funcionalidade de ver movimentações em desenvolvimento.")}
              >
                Ver todas as movimentações
              </Button>
            </div>
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  );
}

function BudgetCard({ item, canEdit, onSave, onDetail }: { item: any, canEdit: boolean, onSave: (v: number) => void, onDetail: () => void }) {
  const [val, setVal] = useState(item.planned || "");

  const handleBlur = () => {
    const n = num(val);
    if (n !== item.planned) {
      onSave(n);
    }
  };

  return (
    <Card className="shadow-none border-slate-200 hover:border-slate-300 transition-colors group">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex flex-col cursor-pointer" onClick={onDetail}>
            <span className="text-sm font-bold text-slate-900 group-hover:text-primary transition-colors">
              {item.name}
            </span>
            <div className="flex items-center gap-2 mt-0.5">
              {item.status === 'danger' && <AlertCircle className="size-3 text-rose-500" />}
              {item.status === 'warning' && <AlertCircle className="size-3 text-amber-500" />}
              {item.status === 'success' && <CheckCircle2 className="size-3 text-emerald-500" />}
              <span className={cn(
                "text-[10px] font-medium",
                item.status === 'danger' ? "text-rose-600" : 
                item.status === 'warning' ? "text-amber-600" : 
                item.status === 'success' ? "text-emerald-600" : "text-slate-500"
              )}>
                {item.statusText || (item.isExpense ? `${brl(item.available)} disponível` : `${brl(item.committed)} acumulado`)}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative">
              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 font-bold">R$</span>
              <Input
                className="h-8 w-24 pl-6 text-right text-xs font-bold border-slate-200"
                type="number"
                value={val}
                onChange={(e) => setVal(e.target.value)}
                onBlur={handleBlur}
                disabled={!canEdit}
                placeholder="Meta"
              />
            </div>
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="flex justify-between items-center text-[10px] text-slate-500 font-bold uppercase tracking-tighter">
            <div className="flex gap-2">
              <span className="flex items-center gap-0.5"><ArrowDownRight className="size-2.5 text-emerald-500" /> {brl(item.realized)}</span>
              <span className="flex items-center gap-0.5"><Info className="size-2.5 text-amber-500" /> {brl(item.predicted)}</span>
            </div>
            <span className="text-slate-900">{Math.round(item.pct)}%</span>
          </div>
          
          <div className="relative h-2 w-full overflow-hidden rounded-full bg-slate-100">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div 
                    className={cn(
                      "h-full transition-all duration-500",
                      item.isIncome ? "bg-emerald-500" : (
                        item.status === 'danger' ? "bg-rose-500" : 
                        item.status === 'warning' ? "bg-amber-500" : "bg-blue-500"
                      )
                    )}
                    style={{ width: `${Math.min(100, item.pct)}%` }}
                  />
                </TooltipTrigger>
                <TooltipContent>
                  <p className="text-xs">
                    Comprometido: {brl(item.committed)} 
                    {item.planned > 0 && ` (${Math.round(item.pct)}%)`}
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
