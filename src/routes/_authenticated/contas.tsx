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
import { Plus, Wallet, Trash2, Building2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/contas")({
  component: ContasPage,
});

function ContasPage() {
  const { wsId } = useWorkspace();
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);

  const { data: accounts, isLoading } = useQuery({
    queryKey: ["accounts", wsId],
    queryFn: async () => {
      if (!wsId) return [];
      return await db.from("financial_accounts").select("*").eq("workspace_id", wsId).execute();
    },
    enabled: !!wsId,
  });

  const createAccount = useMutation({
    mutationFn: async (formData: any) => {
      return await db.from("financial_accounts").insert({
        ...formData,
        workspace_id: wsId,
        initial_balance: parseFloat(formData.initial_balance || "0"),
      }).execute();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      setIsOpen(false);
      toast.success("Conta criada com sucesso!");
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
    createAccount.mutate(Object.fromEntries(formData));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Contas Bancárias</h1>
          <p className="text-muted-foreground">Gerencie suas contas, carteiras e investimentos.</p>
        </div>
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="size-4" /> Nova Conta
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Cadastrar Nova Conta</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nome da Conta</Label>
                <Input id="name" name="name" placeholder="Ex: Nubank, Carteira, Itaú" required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="kind">Tipo</Label>
                  <Select name="kind" defaultValue="checking">
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
                  <Input id="initial_balance" name="initial_balance" type="number" step="0.01" defaultValue="0" />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="institution">Instituição (Opcional)</Label>
                <Input id="institution" name="institution" placeholder="Ex: Banco do Brasil" />
              </div>
              <Button type="submit" className="w-full" disabled={createAccount.isPending}>
                {createAccount.isPending ? "Salvando..." : "Salvar Conta"}
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
              <Button 
                variant="ghost" 
                size="icon" 
                className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:bg-destructive/10"
                onClick={() => deleteAccount.mutate(acc.id)}
              >
                <Trash2 className="size-4" />
              </Button>
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
