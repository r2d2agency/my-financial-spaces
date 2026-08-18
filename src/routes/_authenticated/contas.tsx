import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { db } from "@/lib/db-browser";
import { useWorkspace } from "@/lib/workspace";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger,
  DialogFooter,
  DialogDescription
} from "@/components/ui/dialog";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { 
  Plus, 
  Wallet, 
  Trash2, 
  Building2, 
  Pencil, 
  ArrowLeftRight, 
  History, 
  ChevronRight,
  Archive,
  Star,
  Landmark,
  CreditCard,
  PiggyBank,
  Banknote,
  TrendingUp,
  MoreVertical
} from "lucide-react";
import { useState, useMemo } from "react";
import { toast } from "sonner";
import { brl, ACCOUNT_KINDS } from "@/lib/finance";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from "@/components/ui/dropdown-menu";

export const Route = createFileRoute("/_authenticated/contas")({
  component: ContasPage,
});

function getKindIcon(kind: string) {
  switch (kind) {
    case 'checking': return <Landmark className="size-5" />;
    case 'digital': return <CreditCard className="size-5" />;
    case 'savings': return <PiggyBank className="size-5" />;
    case 'wallet': return <Wallet className="size-5" />;
    case 'cash': return <Banknote className="size-5" />;
    case 'investment': return <TrendingUp className="size-5" />;
    default: return <Building2 className="size-5" />;
  }
}

function ContasPage() {
  const { wsId, canEdit } = useWorkspace();
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<any>(null);

  const { data: accounts, isLoading } = useQuery({
    queryKey: ["accounts", wsId],
    queryFn: async () => {
      if (!wsId) return [];
      const res = await db.from("financial_accounts").select("*").eq("workspace_id", wsId).order("is_default", { ascending: false }).execute();
      const list = Array.isArray(res?.data) ? res.data : [];
      
      // Enriquecer com saldo atual via RPC para cada conta
      const enriched = await Promise.all(list.map(async (acc) => {
        const bal = await db.rpc("get_account_balance", { account_id: acc.id, workspace_id: wsId });
        return { ...acc, current_balance: bal?.data?.current_balance ?? acc.initial_balance };
      }));
      
      return enriched;
    },
    enabled: !!wsId,
  });

  const saveAccount = useMutation({
    mutationFn: async (formData: any) => {
      const payload = {
        ...formData,
        initial_balance: parseFloat(formData.initial_balance || "0"),
        is_default: formData.is_default === 'on',
        archived: formData.archived === 'on',
      };

      if (editingAccount) {
        const { error } = await db.from("financial_accounts").update(payload).eq("id", editingAccount.id).execute();
        if (error) throw error;
        return editingAccount;
      } else {
        const { data, error } = await db.from("financial_accounts").insert({
          ...payload,
          workspace_id: wsId,
        });
        if (error) throw error;
        return data;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      setIsOpen(false);
      setEditingAccount(null);
      toast.success(editingAccount ? "Conta atualizada!" : "Conta criada com sucesso!");
    },
  });

  const toggleArchive = useMutation({
    mutationFn: async ({ id, archived }: { id: string, archived: boolean }) => {
      return await db.from("financial_accounts").update({ archived }).eq("id", id).execute();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      toast.success("Status da conta atualizado!");
    }
  });

  const deleteAccount = useMutation({
    mutationFn: async (id: string) => {
      // Verificar se há transações
      const { data: trans } = await db.from("transactions").select("id").eq("account_id", id).limit(1).execute();
      if (trans && trans.length > 0) {
        throw new Error("Não é possível excluir uma conta que possui movimentações. Arquive-a em vez disso.");
      }
      return await db.from("financial_accounts").delete().eq("id", id).execute();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      toast.success("Conta removida!");
    },
    onError: (err: any) => {
      toast.error(err.message);
    }
  });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data = Object.fromEntries(formData);
    saveAccount.mutate(data);
  };

  const totalBalance = useMemo(() => {
    return (accounts || [])
      .filter(a => !a.archived)
      .reduce((acc, curr) => acc + Number(curr.current_balance), 0);
  }, [accounts]);

  const activeAccounts = accounts?.filter(a => !a.archived) || [];
  const archivedAccounts = accounts?.filter(a => a.archived) || [];

  return (
    <div className="space-y-6 pb-20 md:pb-0">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Contas Bancárias</h1>
          <p className="text-muted-foreground">Visualize e gerencie seus saldos e disponibilidades.</p>
        </div>
        <div className="flex items-center gap-2">
          <Card className="bg-primary/5 border-primary/20 px-4 py-2 flex flex-col justify-center min-w-[160px]">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Patrimônio Líquido</span>
            <span className={`text-lg font-bold ${totalBalance >= 0 ? 'text-emerald-600' : 'text-destructive'}`}>
              {brl(totalBalance)}
            </span>
          </Card>
          <Dialog open={isOpen} onOpenChange={(open) => {
            setIsOpen(open);
            if (!open) setEditingAccount(null);
          }}>
            <DialogTrigger asChild>
              <Button className="gap-2 h-12 md:h-10" onClick={() => setEditingAccount(null)}>
                <Plus className="size-4" /> Nova Conta
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>{editingAccount ? "Editar Conta" : "Cadastrar Nova Conta"}</DialogTitle>
                <DialogDescription>
                  Configure os detalhes da sua conta bancária ou carteira.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nome da Conta</Label>
                  <Input id="name" name="name" placeholder="Ex: Nubank Principal, Dinheiro" defaultValue={editingAccount?.name} required />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="kind">Tipo</Label>
                    <Select name="kind" defaultValue={editingAccount?.kind || "checking"}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ACCOUNT_KINDS.map(k => (
                          <SelectItem key={k.value} value={k.value}>{k.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="initial_balance">Saldo Inicial</Label>
                    <Input id="initial_balance" name="initial_balance" type="number" step="0.01" defaultValue={editingAccount?.initial_balance || "0"} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="initial_balance_date">Data do Saldo Inicial</Label>
                  <Input 
                    id="initial_balance_date" 
                    name="initial_balance_date" 
                    type="date" 
                    defaultValue={editingAccount?.initial_balance_date ? new Date(editingAccount.initial_balance_date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]} 
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="institution">Instituição / Banco (Opcional)</Label>
                  <Input id="institution" name="institution" placeholder="Ex: Nubank, Banco do Brasil" defaultValue={editingAccount?.institution} />
                </div>
                
                <div className="flex items-center gap-2 pt-2">
                   <input type="checkbox" id="is_default" name="is_default" defaultChecked={editingAccount?.is_default} className="size-4 rounded border-gray-300 text-primary focus:ring-primary" />
                   <Label htmlFor="is_default" className="text-sm font-normal cursor-pointer">Definir como conta padrão para novos lançamentos</Label>
                </div>

                <DialogFooter className="pt-4">
                  <Button type="submit" className="w-full" disabled={saveAccount.isPending}>
                    {saveAccount.isPending ? "Salvando..." : editingAccount ? "Atualizar Conta" : "Salvar Conta"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid gap-6">
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 uppercase tracking-widest text-[10px]">Ativas</Badge>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {activeAccounts.map((acc: any) => (
              <Card key={acc.id} className="relative overflow-hidden group hover:shadow-md transition-shadow border-l-4 border-l-primary">
                <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-lg text-primary">
                      {getKindIcon(acc.kind)}
                    </div>
                    <div>
                      <CardTitle className="text-base font-semibold flex items-center gap-2">
                        {acc.name}
                        {acc.is_default && <Star className="size-3 fill-amber-400 text-amber-400" title="Conta Padrão" />}
                      </CardTitle>
                      <p className="text-xs text-muted-foreground">
                        {acc.institution || 'Carteira'}
                      </p>
                    </div>
                  </div>
                  
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="size-8">
                        <MoreVertical className="size-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => { setEditingAccount(acc); setIsOpen(true); }}>
                        <Pencil className="size-4 mr-2" /> Editar
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => toggleArchive.mutate({ id: acc.id, archived: true })}>
                        <Archive className="size-4 mr-2" /> Arquivar
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem className="text-destructive" onClick={() => deleteAccount.mutate(acc.id)}>
                        <Trash2 className="size-4 mr-2" /> Excluir
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </CardHeader>
                <CardContent className="pt-4">
                  <div className="flex flex-col">
                    <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-tighter">Saldo Disponível</span>
                    <div className={`text-2xl font-bold tracking-tight ${Number(acc.current_balance) >= 0 ? 'text-foreground' : 'text-destructive'}`}>
                      {brl(acc.current_balance)}
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="bg-muted/30 p-2 flex justify-between gap-2 border-t">
                  <Button variant="ghost" size="sm" className="w-full text-xs h-8 gap-2" asChild>
                    <Link to="/movimentacoes" search={{ account_id: acc.id }}>
                      <History className="size-3" /> Extrato
                    </Link>
                  </Button>
                </CardFooter>
              </Card>
            ))}
            
            {activeAccounts.length === 0 && !isLoading && (
              <div className="col-span-full py-12 text-center border-2 border-dashed rounded-xl bg-muted/30">
                <Building2 className="size-12 mx-auto text-muted-foreground/30 mb-4" />
                <h3 className="font-medium">Nenhuma conta ativa</h3>
                <p className="text-sm text-muted-foreground">Cadastre suas contas para acompanhar seus saldos.</p>
              </div>
            )}
          </div>
        </section>

        {archivedAccounts.length > 0 && (
          <section className="space-y-4">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="bg-muted text-muted-foreground uppercase tracking-widest text-[10px]">Arquivadas</Badge>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 opacity-60 grayscale hover:grayscale-0 transition-all">
              {archivedAccounts.map((acc: any) => (
                <Card key={acc.id} className="bg-muted/20 border-dashed">
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <div className="flex items-center gap-2">
                      <Archive className="size-4 text-muted-foreground" />
                      <span className="font-medium text-sm">{acc.name}</span>
                    </div>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-8 text-[10px] uppercase"
                      onClick={() => toggleArchive.mutate({ id: acc.id, archived: false })}
                    >
                      Reativar
                    </Button>
                  </CardHeader>
                  <CardContent>
                    <div className="text-lg font-semibold text-muted-foreground">
                      {brl(acc.current_balance)}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
