import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { db } from "@/lib/db-browser";
import { useWorkspace } from "@/lib/workspace";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from "@/components/ui/dialog";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Plus, Wallet, Trash2, Building2, Pencil } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/contas")({
  component: ContasPage,
});

function ContasPage() {
  const { wsId } = useWorkspace();
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<any>(null);

  const { data: accounts, isLoading } = useQuery({
    queryKey: ["accounts", wsId],
    queryFn: async () => {
      if (!wsId) return [];
      const res = await db.from("financial_accounts").select("*").eq("workspace_id", wsId).execute();
      return Array.isArray(res?.data) ? res.data : [];
    },
    enabled: !!wsId,
  });

  const saveAccount = useMutation({
    mutationFn: async (formData: any) => {
      const payload = {
        ...formData,
        initial_balance: parseFloat(formData.initial_balance || "0"),
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

  const deleteAccount = useMutation({
    mutationFn: async (id: string) => {
      return await db.from("financial_accounts").delete().eq("id", id).execute();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      toast.success("Conta removida!");
    },
  });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    saveAccount.mutate(Object.fromEntries(formData));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Contas Bancárias</h1>
          <p className="text-muted-foreground">Gerencie suas contas, carteiras e investimentos.</p>
        </div>
        <Dialog open={isOpen} onOpenChange={(open) => {
          setIsOpen(open);
          if (!open) setEditingAccount(null);
        }}>
          <DialogTrigger asChild>
            <Button className="gap-2" onClick={() => setEditingAccount(null)}>
              <Plus className="size-4" /> Nova Conta
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingAccount ? "Editar Conta" : "Cadastrar Nova Conta"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nome da Conta</Label>
                <Input id="name" name="name" placeholder="Ex: Nubank, Carteira, Itaú" defaultValue={editingAccount?.name} required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="kind">Tipo</Label>
                  <Select name="kind" defaultValue={editingAccount?.kind || "checking"}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="checking">Conta Corrente</SelectItem>
                      <SelectItem value="savings">Poupança</SelectItem>
                      <SelectItem value="wallet">Dinheiro / Carteira</SelectItem>
                      <SelectItem value="investment">Investimento</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="initial_balance">Saldo Inicial</Label>
                  <Input id="initial_balance" name="initial_balance" type="number" step="0.01" defaultValue={editingAccount?.initial_balance || "0"} />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="institution">Instituição (Opcional)</Label>
                <Input id="institution" name="institution" placeholder="Ex: Banco do Brasil" defaultValue={editingAccount?.institution} />
              </div>
              <Button type="submit" className="w-full" disabled={saveAccount.isPending}>
                {saveAccount.isPending ? "Salvando..." : editingAccount ? "Atualizar Conta" : "Salvar Conta"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {accounts?.map((acc: any) => (
          <Card key={acc.id} className="relative overflow-hidden group">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{acc.name}</CardTitle>
              <Wallet className="size-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(acc.initial_balance)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {acc.institution || (acc.kind === 'wallet' ? 'Dinheiro' : 'Outros')}
              </p>
              <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="hover:bg-primary/10 text-primary"
                  onClick={() => {
                    setEditingAccount(acc);
                    setIsOpen(true);
                  }}
                >
                  <Pencil className="size-4" />
                </Button>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="text-destructive hover:bg-destructive/10"
                  onClick={() => deleteAccount.mutate(acc.id)}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
        {!isLoading && accounts?.length === 0 && (
          <div className="col-span-full py-12 text-center border-2 border-dashed rounded-lg bg-muted/50">
            <Building2 className="size-12 mx-auto text-muted-foreground/50 mb-4" />
            <h3 className="font-medium">Nenhuma conta cadastrada</h3>
            <p className="text-sm text-muted-foreground">Adicione sua primeira conta para começar a gerenciar.</p>
          </div>
        )}
      </div>
    </div>
  );
}
