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
import { Badge } from "@/components/ui/badge";
import { 
  ChevronLeft, 
  ChevronRight, 
  Plus, 
  Search, 
  Filter, 
  MoreHorizontal, 
  ArrowRightLeft,
  ArrowUpRight,
  ArrowDownLeft,
  CalendarDays,
  X
} from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { getCurrentUser } from "@/lib/auth-client.functions";
import { TransactionSummary } from "@/components/finance/TransactionSummary";
import { TransactionDetailsDrawer } from "@/components/finance/TransactionDetailsDrawer";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from "@/components/ui/dropdown-menu";

export const Route = createFileRoute("/_authenticated/movimentacoes")({
  component: Movimentacoes,
  head: () => ({
    title: "Movimentações · Espaço Financeiro",
    meta: [
      { name: "description", content: "Gestão completa de fluxo de caixa, receitas e despesas." },
    ],
  }),
});

function Movimentacoes() {
  const { wsId, canEdit, hideBalances } = useWorkspace();
  const qc = useQueryClient();
  const getUser = useServerFn(getCurrentUser);
  
  // Estados de Filtro
  const [ref, setRef] = useState(() => new Date());
  const [tab, setTab] = useState<"all" | "income" | "expense" | "transfer">("all");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "paid" | "overdue">("all");
  
  // Estados de UI
  const [selectedTx, setSelectedTx] = useState<any>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);

  const { start, end, startIso, endIso } = monthRange(ref);

  // Queries de Metadados (Contas e Categorias)
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

  // Query Principal de Movimentações
  const { data: rows, isLoading, isError, refetch } = useQuery({
    queryKey: ["transactions", wsId, startIso, endIso, tab, statusFilter, search],
    enabled: !!wsId,
    queryFn: async () => {
      let query = db.from("transactions")
        .select("*")
        .eq("workspace_id", wsId!)
        .gte("competence_date", startIso)
        .lte("competence_date", endIso)
        .order("competence_date", { ascending: false });

      if (tab !== "all") {
        query = query.eq("type", tab);
      }

      if (statusFilter === "pending") {
        query = query.eq("status", "pending");
      } else if (statusFilter === "paid") {
        query = query.eq("status", "paid");
      } else if (statusFilter === "overdue") {
        query = query.eq("status", "pending").lte("competence_date", iso(new Date()));
      }

      if (search) {
        query = query.ilike("description", search);
      }

      const { data } = await query.execute();
      return Array.isArray(data) ? data : [];
    },
  });

  // Cálculos dos Indicadores (Memoria)
  const stats = useMemo(() => {
    const list = rows || [];
    const valid = list.filter(t => t.status !== 'canceled' && t.type !== 'transfer');
    
    const entradas = valid.filter(t => isIncomeType(t.type) && t.status === 'paid').reduce((acc, t) => acc + num(t.amount), 0);
    const saidas = valid.filter(t => !isIncomeType(t.type) && t.status === 'paid').reduce((acc, t) => acc + Math.abs(num(t.amount)), 0);
    const aReceber = valid.filter(t => isIncomeType(t.type) && t.status === 'pending').reduce((acc, t) => acc + num(t.amount), 0);
    const aPagar = valid.filter(t => !isIncomeType(t.type) && t.status === 'pending').reduce((acc, t) => acc + Math.abs(num(t.amount)), 0);
    
    return {
      realizado: entradas - saidas,
      entradas,
      saidas,
      aReceber,
      aPagar
    };
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

  // Mutações
  const settle = useMutation({
    mutationFn: async ({ id, paid_date }: any) => {
      await db.rpc("settle_transaction", { id, workspace_id: wsId, paid_date: paid_date || iso(new Date()) });
    },
    onSuccess: () => {
      toast.success("Movimentação liquidada.");
      qc.invalidateQueries({ queryKey: ["transactions"] });
      setIsDetailsOpen(false);
    },
    onError: (e: Error) => toast.error(e.message)
  });

  const revert = useMutation({
    mutationFn: async (id: string) => {
      await db.rpc("revert_settlement", { id, workspace_id: wsId });
    },
    onSuccess: () => {
      toast.success("Liquidação desfeita.");
      qc.invalidateQueries({ queryKey: ["transactions"] });
      setIsDetailsOpen(false);
    },
    onError: (e: Error) => toast.error(e.message)
  });

  const remove = useMutation({
    mutationFn: async ({ id, scope }: any) => {
      // Implementação simplificada de delete por enquanto
      await db.from("transactions").delete().eq("id", id).eq("workspace_id", wsId!).execute();
    },
    onSuccess: () => {
      toast.success("Lançamento excluído.");
      qc.invalidateQueries({ queryKey: ["transactions"] });
      setIsDetailsOpen(false);
    },
    onError: (e: Error) => toast.error(e.message)
  });

  const getAccountName = (id: string) => meta?.accounts.find((a: any) => a.id === id)?.name || "—";
  const getCategoryName = (id: string) => meta?.categories.find((c: any) => c.id === id)?.name || "—";

  return (
    <div className="flex flex-col h-full bg-background -mt-6 -mx-6 md:-mx-8 lg:-mx-10 overflow-hidden">
      {/* Cabeçalho Operacional */}
      <header className="bg-white border-b border-border py-4 px-6 flex flex-col md:flex-row md:items-center justify-between gap-4 sticky top-0 z-10">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">Movimentações</h1>
          <p className="text-xs text-muted-foreground hidden md:block">Gerencie seu fluxo de caixa e pendências</p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center bg-slate-50 border border-border rounded-md px-1 py-1">
            <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500 hover:text-slate-900" onClick={() => setRef(addMonths(ref, -1))}>
              <ChevronLeft className="size-4" />
            </Button>
            <div className="px-4 text-sm font-semibold text-slate-700 min-w-[140px] text-center capitalize">
              {monthLabel(ref)}
            </div>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500 hover:text-slate-900" onClick={() => setRef(addMonths(ref, 1))}>
              <ChevronRight className="size-4" />
            </Button>
          </div>
          
          <Button className="bg-blue-600 hover:bg-blue-700 shadow-sm" onClick={() => {}}>
            <Plus className="size-4 mr-2" />
            Novo lançamento
          </Button>
        </div>
      </header>

      {/* Faixa de Resumo */}
      <TransactionSummary {...stats} hideBalances={hideBalances} />

      {/* Filtros e Abas */}
      <div className="bg-white px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/50">
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
          <TabButton active={tab === "all"} onClick={() => setTab("all")} label="Todas" count={counts.all} />
          <TabButton active={tab === "income"} onClick={() => setTab("income")} label="Receitas" count={counts.income} />
          <TabButton active={tab === "expense"} onClick={() => setTab("expense")} label="Despesas" count={counts.expense} />
          <TabButton active={tab === "transfer"} onClick={() => setTab("transfer")} label="Transferências" count={counts.transfer} />
        </div>

        <div className="flex items-center gap-2">
          <div className="relative w-full md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input 
              placeholder="Buscar movimentação..." 
              className="pl-9 h-9 bg-slate-50 border-border focus:bg-white" 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-9 gap-2">
                <Filter className="size-4" />
                <span>{statusFilter === 'all' ? 'Filtros' : `Filtros (${statusFilter === 'overdue' ? 'Atrasados' : statusFilter})`}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={() => setStatusFilter("all")}>Todos</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setStatusFilter("pending")}>Pendentes</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setStatusFilter("paid")}>Realizados</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setStatusFilter("overdue")}>Atrasados</DropdownMenuItem>
              {statusFilter !== 'all' && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setStatusFilter("all")} className="text-destructive">Limpar Filtros</DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Listagem */}
      <div className="flex-1 overflow-y-auto min-h-0 bg-slate-50/30">
        {isLoading ? (
          <div className="p-6 space-y-4">
            {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-16 w-full rounded-lg" />)}
          </div>
        ) : isError ? (
          <div className="p-12 text-center">
            <p className="text-destructive font-medium">Erro ao carregar movimentações.</p>
            <Button variant="link" onClick={() => refetch()}>Tentar novamente</Button>
          </div>
        ) : (rows ?? []).length === 0 ? (
          <div className="p-20 text-center flex flex-col items-center gap-4">
            <div className="size-16 bg-slate-100 rounded-full flex items-center justify-center text-slate-400">
              <CalendarDays className="size-8" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-slate-900">Nenhuma movimentação neste período</h3>
              <p className="text-sm text-muted-foreground">Comece adicionando uma receita ou despesa para organizar seu espaço.</p>
            </div>
            <Button className="mt-2" onClick={() => {}}>+ Novo lançamento</Button>
          </div>
        ) : (
          <div className="px-6 py-4">
            <div className="bg-white border border-border rounded-xl overflow-hidden shadow-sm">
              {/* Tabela Desktop */}
              <table className="w-full text-left hidden md:table">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-border text-[11px] uppercase tracking-wider text-slate-500 font-bold">
                    <th className="px-4 py-3 font-bold">Descrição</th>
                    <th className="px-4 py-3 font-bold">Vencimento</th>
                    <th className="px-4 py-3 font-bold">Conta</th>
                    <th className="px-4 py-3 font-bold">Status</th>
                    <th className="px-4 py-3 font-bold text-right">Valor</th>
                    <th className="px-4 py-3 w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {rows?.map((t: any) => (
                    <tr key={t.id} className="group hover:bg-slate-50/50 transition-colors cursor-pointer" onClick={() => {
                      setSelectedTx({
                        ...t,
                        account_name: getAccountName(t.account_id),
                        category_name: getCategoryName(t.category_id)
                      });
                      setIsDetailsOpen(true);
                    }}>
                      <td className="px-4 py-3">
                        <div className="flex flex-col">
                          <span className="text-sm font-semibold text-slate-800">{t.description}</span>
                          <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-tight">
                            {getCategoryName(t.category_id)} {t.person_name ? `• ${t.person_name}` : ""}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600">
                        {new Date(t.competence_date).toLocaleDateString("pt-BR")}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600">
                        {getAccountName(t.account_id)}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge tx={t} />
                      </td>
                      <td className={`px-4 py-3 text-sm font-bold text-right ${isIncomeType(t.type) ? "text-emerald-600" : "text-slate-900"}`}>
                        {isIncomeType(t.type) ? "+" : "-"} {hideBalances ? "•••" : brl(Math.abs(t.amount))}
                      </td>
                      <td className="px-4 py-3">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                            <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100">
                              <MoreHorizontal className="size-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => {}}>Editar</DropdownMenuItem>
                            {t.status === 'pending' ? (
                              <DropdownMenuItem onClick={() => settle.mutate({ id: t.id })}>
                                Marcar como {isIncomeType(t.type) ? 'recebido' : 'pago'}
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem onClick={() => revert.mutate(t.id)}>Desfazer liquidação</DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="text-destructive" onClick={() => remove.mutate({ id: t.id })}>Excluir</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Lista Mobile */}
              <div className="md:hidden divide-y divide-border/50">
                {rows?.map((t: any) => (
                  <div key={t.id} className="px-4 py-4 active:bg-slate-50 flex items-center justify-between gap-4" onClick={() => {
                    setSelectedTx({
                      ...t,
                      account_name: getAccountName(t.account_id),
                      category_name: getCategoryName(t.category_id)
                    });
                    setIsDetailsOpen(true);
                  }}>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <TxIcon type={t.type} />
                        <span className="text-sm font-bold text-slate-800 truncate">{t.description}</span>
                      </div>
                      <div className="flex items-center gap-2 text-[10px] text-muted-foreground font-medium uppercase">
                        <span>{new Date(t.competence_date).toLocaleDateString("pt-BR")}</span>
                        <span>•</span>
                        <span className="truncate">{getCategoryName(t.category_id)}</span>
                      </div>
                    </div>
                    <div className="text-right flex flex-col items-end gap-1">
                      <span className={`text-sm font-bold ${isIncomeType(t.type) ? "text-emerald-600" : "text-slate-900"}`}>
                        {isIncomeType(t.type) ? "+" : "-"} {hideBalances ? "•••" : brl(Math.abs(t.amount))}
                      </span>
                      <StatusBadge tx={t} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      <TransactionDetailsDrawer 
        tx={selectedTx} 
        open={isDetailsOpen} 
        onOpenChange={setIsDetailsOpen}
        onSettle={() => settle.mutate({ id: selectedTx.id })}
        onRevert={() => revert.mutate(selectedTx.id)}
        onEdit={() => { /* abrir formulário de edição */ }}
        onDelete={() => remove.mutate({ id: selectedTx.id })}
      />
    </div>
  );
}

const TabButton = ({ active, onClick, label, count }: any) => (
  <button 
    onClick={onClick}
    className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all flex items-center gap-2 whitespace-nowrap ${
      active ? "bg-blue-50 text-blue-700" : "text-slate-500 hover:bg-slate-50 hover:text-slate-700"
    }`}
  >
    {label}
    {count > 0 && <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${active ? "bg-blue-100" : "bg-slate-100"}`}>{count}</span>}
  </button>
);

const StatusBadge = ({ tx }: { tx: any }) => {
  const isPaid = tx.status === 'paid';
  const isIncome = isIncomeType(tx.type);
  const isOverdue = !isPaid && new Date(tx.competence_date) < new Date();

  if (isPaid) {
    return (
      <Badge variant="secondary" className="bg-emerald-50 text-emerald-700 hover:bg-emerald-50 border-emerald-200 text-[10px] uppercase font-bold py-0 h-5">
        {isIncome ? "Recebido" : "Pago"}
      </Badge>
    );
  }

  if (isOverdue) {
    return (
      <Badge variant="outline" className="border-rose-200 text-rose-700 bg-rose-50 text-[10px] uppercase font-bold py-0 h-5">
        Atrasado
      </Badge>
    );
  }

  return (
    <Badge variant="outline" className="text-slate-500 border-slate-200 text-[10px] uppercase font-bold py-0 h-5">
      {isIncome ? "A receber" : "Pendente"}
    </Badge>
  );
};

const TxIcon = ({ type }: { type: string }) => {
  if (type === 'transfer') return <ArrowRightLeft className="size-3 text-slate-400" />;
  if (isIncomeType(type)) return <ArrowUpRight className="size-3 text-emerald-500" />;
  return <ArrowDownLeft className="size-3 text-slate-400" />;
};
