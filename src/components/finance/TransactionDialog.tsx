import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { db } from "@/lib/db-browser";
import { useWorkspace } from "@/lib/workspace";
import { TX_TYPES, iso, num } from "@/lib/finance";
import { getCurrentUser } from "@/lib/auth-client.functions";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Loader2, ChevronDown, Plus } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface TransactionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tx?: any;
}

export function TransactionDialog({ open, onOpenChange, tx }: TransactionDialogProps) {
  const { wsId } = useWorkspace();
  const qc = useQueryClient();
  const getUser = useServerFn(getCurrentUser);
  const isEdit = !!tx;

  const [form, setForm] = useState({
    type: "expense",
    description: "",
    amount: "",
    competence_date: iso(new Date()),
    status: "pending",
    account_id: "",
    card_id: "",
    category_id: "",
    person_name: "",
    notes: "",
    account_dest_id: "",
    is_liquidated: false,
    payment_method: "account", // "account" | "credit_card"
    is_recurring: false,
    recurring_type: "fixed", // "fixed" | "installments"
    installments: "2",
    installment_mode: "equal", // "equal" (total/n) | "fixed" (n * amount)
    frequency: "monthly",
    repeat_until: "",
  });

  const [showAdvanced, setShowAdvanced] = useState(false);

  useEffect(() => {
    if (tx && open) {
      setForm({
        type: tx.type || "expense",
        description: tx.description || "",
        amount: String(Math.abs(tx.amount || 0)),
        competence_date: tx.competence_date ? iso(new Date(tx.competence_date)) : iso(new Date()),
        status: tx.status || "pending",
        account_id: tx.account_id || "",
        card_id: tx.card_id || "",
        category_id: tx.category_id || "",
        person_name: tx.person_name || "",
        notes: tx.notes || "",
        account_dest_id: "",
        is_liquidated: tx.status === 'paid',
        payment_method: tx.card_id ? "credit_card" : "account",
      });
    } else if (open) {
      setForm({
        type: "expense",
        description: "",
        amount: "",
        competence_date: iso(new Date()),
        status: "pending",
        account_id: "",
        card_id: "",
        category_id: "",
        person_name: "",
        notes: "",
        account_dest_id: "",
        is_liquidated: false,
        payment_method: "account",
      });
    }
  }, [tx, open]);

  const { data: meta } = useQuery({
    queryKey: ["meta", wsId],
    enabled: !!wsId && open,
    queryFn: async () => {
      const [accs, cats, cards] = await Promise.all([
        db.from("financial_accounts").select("id, name").eq("workspace_id", wsId!).execute(),
        db.from("categories").select("id, name").eq("workspace_id", wsId!).execute(),
        db.from("credit_cards").select("id, name").eq("workspace_id", wsId!).execute(),
      ]);
      return {
        accounts: (accs.data as any[]) || [],
        categories: (cats.data as any[]) || [],
        cards: (cards.data as any[]) || [],
      };
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      const me = await getUser({});
      const amount = form.type === "income" ? Math.abs(num(form.amount)) : -Math.abs(num(form.amount));
      
      const isCard = form.type === 'expense' && form.payment_method === 'credit_card';

      const data = {
        workspace_id: wsId!,
        type: form.type as any,
        description: form.description.trim(),
        amount,
        status: (form.is_liquidated && !isCard) ? "paid" : "pending",
        competence_date: form.competence_date,
        paid_date: (form.is_liquidated && !isCard) ? form.competence_date : null,
        account_id: isCard ? null : (form.account_id || null),
        card_id: isCard ? (form.card_id || null) : null,
        category_id: form.category_id || null,
        person_name: form.person_name.trim() || null,
        notes: form.notes.trim() || null,
        updated_by: me?.id,
      };

      if (isEdit) {
        const { error } = await db.from("transactions").update(data).eq("id", tx.id).eq("workspace_id", wsId!).execute();
        if (error) throw error;
      } else {
        const { error } = await db.from("transactions").insert({ ...data, created_by: me?.id }).execute();
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(isEdit ? "Alterações salvas." : "Lançamento criado.");
      qc.invalidateQueries({ queryKey: ["transactions"] });
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error("Erro ao salvar: " + e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar lançamento" : "Novo lançamento"}</DialogTitle>
        </DialogHeader>

        <div className="grid gap-6 py-4">
          <Tabs value={form.type} onValueChange={(v) => setForm(f => ({ ...f, type: v }))} className="w-full">
            <TabsList className="grid w-full grid-cols-3 h-12">
              <TabsTrigger value="income">Receita</TabsTrigger>
              <TabsTrigger value="expense">Despesa</TabsTrigger>
              <TabsTrigger value="transfer">Transferência</TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Descrição</Label>
              <Input 
                placeholder={form.type === 'expense' ? "Ex: Aluguel" : "Ex: Gestão de tráfego"}
                value={form.description} 
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Valor</Label>
                <Input type="number" step="0.01" placeholder="R$ 0,00" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Vencimento</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start text-left font-normal">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {form.competence_date ? format(new Date(form.competence_date), "dd/MM/yyyy") : <span>Selecione</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={new Date(form.competence_date)} onSelect={(d) => d && setForm(f => ({ ...f, competence_date: iso(d) }))} initialFocus /></PopoverContent>
                </Popover>
              </div>
            </div>

            {form.type !== 'transfer' && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{form.type === "income" ? "Cliente" : "Fornecedor"}</Label>
                  <div className="flex gap-2">
                    <Input placeholder="Nome..." value={form.person_name} onChange={e => setForm(f => ({ ...f, person_name: e.target.value }))} />
                    <Button size="icon" variant="outline" className="shrink-0"><Plus className="size-4"/></Button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Categoria</Label>
                  <div className="flex gap-2">
                    <Input placeholder="Categoria..." value={form.category_id} onChange={e => setForm(f => ({ ...f, category_id: e.target.value }))} />
                    <Button size="icon" variant="outline" className="shrink-0"><Plus className="size-4"/></Button>
                  </div>
                </div>
              </div>
            )}

            {form.type === 'expense' && (
              <div className="space-y-2">
                <Label>Forma de Pagamento</Label>
                <Tabs value={form.payment_method} onValueChange={(v) => setForm(f => ({ ...f, payment_method: v }))} className="w-full">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="account">Conta Bancária</TabsTrigger>
                    <TabsTrigger value="credit_card">Cartão de Crédito</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
            )}

            <div className="space-y-2">
              <Label>
                {form.type === 'expense' && form.payment_method === 'credit_card' 
                  ? 'Cartão' 
                  : (form.type === 'income' ? 'Conta de recebimento' : form.type === 'expense' ? 'Conta de pagamento' : 'Conta')}
              </Label>
              
              {form.type === 'expense' && form.payment_method === 'credit_card' ? (
                <select 
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  value={form.card_id}
                  onChange={e => setForm(f => ({ ...f, card_id: e.target.value }))}
                >
                  <option value="">Selecione um cartão...</option>
                  {meta?.cards.map((c: any) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              ) : (
                <select 
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  value={form.account_id}
                  onChange={e => setForm(f => ({ ...f, account_id: e.target.value }))}
                >
                  <option value="">Selecione uma conta...</option>
                  {meta?.accounts.map((a: any) => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
              )}
            </div>

            {!(form.type === 'expense' && form.payment_method === 'credit_card') && (
              <div className="flex items-center space-x-2">
                <Checkbox id="liq" checked={form.is_liquidated} onCheckedChange={(v) => setForm(f => ({ ...f, is_liquidated: !!v }))} />
                <Label htmlFor="liq">{form.type === 'income' ? 'Já recebi este valor' : 'Já paguei esta despesa'}</Label>
              </div>
            )}
            
            <Button variant="ghost" className="w-full justify-between" onClick={() => setShowAdvanced(!showAdvanced)}>
              Mais opções {showAdvanced ? <ChevronDown className="rotate-180" /> : <ChevronDown />}
            </Button>
            
            {showAdvanced && (
              <div className="p-4 border rounded-lg bg-slate-50 space-y-4">
                <p className="text-xs text-muted-foreground">Funcionalidades avançadas (Competência, Centro de custo, Recorrência, etc.) seriam expandidas aqui.</p>
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button disabled={save.isPending} onClick={() => save.mutate()}>
            {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isEdit ? "Salvar alterações" : "Criar lançamento"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
