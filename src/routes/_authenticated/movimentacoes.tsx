import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { toast } from "sonner";
import { db } from "@/lib/db-browser";
import { useWorkspace } from "@/lib/workspace";
import { 
  brl, 
  iso, 
  monthLabel, 
  monthRange, 
  num, 
  addMonths, 
  isIncomeType, 
  TX_TYPES 
} from "@/lib/finance";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  ChevronLeft, 
  ChevronRight, 
  Plus, 
  Search, 
  Filter, 
  MoreHorizontal, 
  CalendarDays
} from "lucide-react";
import { TransactionSummary } from "@/components/finance/TransactionSummary";
import { TransactionDialog } from "@/components/finance/TransactionDialog";
import { Skeleton } from "@/components/ui/skeleton";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";

export const Route = createFileRoute("/_authenticated/movimentacoes")({
  validateSearch: (search: Record<string, unknown>) => ({
    account_id: (search['account_id'] as string) || undefined,
    card_id: (search['card_id'] as string) || undefined,
  }),
  component: Movimentacoes,
});

function TabButton({ active, onClick, label, count }: any) {
  return (
    <Button 
      variant={active ? "secondary" : "ghost"} 
      onClick={onClick}
      className={cn("h-8 px-3 text-xs font-medium", active && "bg-slate-100 text-slate-900")}
    >
      {label} ({count})
    </Button>
  );
}

function StatusBadge({ tx }: any) {
  if (tx.status === 'paid') return <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px]">Pago</Badge>;
  if (tx.status === 'pending') return <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-[10px]">Pendente</Badge>;
  return <Badge variant="outline" className="text-[10px]">{tx.status}</Badge>;
}

function TxIcon({ type }: { type: string }) {
  if (isIncomeType(type)) return <ArrowUpRight className="size-4 text-emerald-600" />;
  if (type === 'transfer') return <ArrowRightLeft className="size-4 text-blue-600" />;
  return <ArrowDownLeft className="size-4 text-rose-600" />;
}

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { ArrowUpRight, ArrowDownLeft, ArrowRightLeft } from "lucide-react";

function Movimentacoes() {
  const { wsId, hideBalances } = useWorkspace();
  const [ref, setRef] = useState(() => new Date());
  const [tab, setTab] = useState<"all" | "income" | "expense" | "transfer">("all");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "paid" | "overdue">("all");
  
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingTx, setEditingTx] = useState<any>(null);

  const { startIso, endIso } = monthRange(ref);

  const { data: meta } = useQuery({
    queryKey: ["meta", wsId],
    enabled: !!wsId,
    queryFn: async () => {
      const [accs, cats] = await Promise.all([
        db.from("financial_accounts").select("id, name").eq("workspace_id", wsId!).execute(),
        db.from("categories").select("id, name").eq("workspace_id", wsId!).execute(),
      ]);
      return {
        accounts: (accs.data as any[]) || [],
        categories: (cats.data as any[]) || [],
      };
    },
  });

  const { data: rows, isLoading, refetch } = useQuery({
    queryKey: ["transactions", wsId, startIso, endIso, tab, statusFilter, search],
    enabled: !!wsId,
    queryFn: async () => {
      const searchParams = Route.useSearch();
      let query = db.from("transactions")
        .select("*, accounts(name), credit_cards(name)")
        .eq("workspace_id", wsId!)
        .gte("competence_date", startIso)
        .lte("competence_date", endIso)
        .order("competence_date", { ascending: false });

      if (tab !== "all") query = query.eq("type", tab);
      if (statusFilter === "pending") query = query.eq("status", "pending");
      else if (statusFilter === "paid") query = query.eq("status", "paid");
      
      if (searchParams.account_id && searchParams.account_id !== 'undefined') query = query.eq("account_id", searchParams.account_id);
      if (searchParams.card_id && searchParams.card_id !== 'undefined') query = query.eq("card_id", searchParams.card_id);
      
      const { data } = await query.execute();
      return Array.isArray(data) ? data : [];
    },
  });

  const stats = useMemo(() => {
    const list = rows || [];
    const valid = list.filter(t => t.status !== 'canceled' && t.type !== 'transfer');
    const entradas = valid.filter(t => isIncomeType(t.type) && t.status === 'paid').reduce((acc, t) => acc + num(t.amount), 0);
    const saidas = valid.filter(t => !isIncomeType(t.type) && t.status === 'paid').reduce((acc, t) => acc + Math.abs(num(t.amount)), 0);
    return { realizado: entradas - saidas, entradas, saidas, aReceber: 0, aPagar: 0 };
  }, [rows]);

  const counts = useMemo(() => {
    const list = rows || [];
    return {
      all: list.length,
      income: list.filter(t => isIncomeType(t.type)).length,
      expense: list.filter(t => !isIncomeType(t.type) && t.type !== 'transfer').length,
      transfer: list.filter(t => t.type === 'transfer').length,
    };
  }, [rows]);

  return (
    <div className="flex flex-col h-full bg-background -mt-6 -mx-6 md:-mx-8 lg:-mx-10 overflow-hidden">
      <header className="bg-white border-b border-border py-4 px-6 flex justify-between items-center sticky top-0 z-10">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Movimentações</h1>
        </div>
        <Button className="bg-blue-600 hover:bg-blue-700" onClick={() => { setEditingTx(null); setIsFormOpen(true); }}>
          <Plus className="size-4 mr-2" />
          Novo lançamento
        </Button>
      </header>

      <TransactionSummary {...stats} hideBalances={hideBalances} />

      <div className="flex-1 overflow-y-auto p-6 bg-slate-50/30">
        {isLoading ? <Skeleton className="h-40 w-full" /> : (
          <div className="bg-white border rounded-xl shadow-sm">
             {/* Listagem simplificada para fins de demonstração da nova UI */}
             {rows?.map((t: any) => (
                <div key={t.id} className="p-4 border-b flex justify-between items-center hover:bg-slate-50 cursor-pointer" onClick={() => { setEditingTx(t); setIsFormOpen(true); }}>
                   <div>
                     <p className="font-semibold">{t.description}</p>
                     <p className="text-xs text-muted-foreground">{new Date(t.competence_date).toLocaleDateString("pt-BR")}</p>
                   </div>
                   <div className="font-bold">{brl(t.amount)}</div>
                </div>
             ))}
          </div>
        )}
      </div>

      <TransactionDialog 
        open={isFormOpen} 
        onOpenChange={setIsFormOpen} 
        tx={editingTx} 
      />
    </div>
  );
}
