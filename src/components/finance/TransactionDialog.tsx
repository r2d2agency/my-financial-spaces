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
import { Badge } from "@/components/ui/badge";

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
    cost_center_id: "",
    tag_ids: [] as string[],
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
        is_recurring: !!tx.recurring_id || !!tx.parent_transaction_id,
        recurring_type: tx.total_installments ? "installments" : "fixed",
        installments: String(tx.total_installments || "2"),
        installment_mode: "equal",
        frequency: "monthly",
        repeat_until: "",
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
        is_recurring: false,
        recurring_type: "fixed",
        installments: "2",
        installment_mode: "equal",
        frequency: "monthly",
        repeat_until: "",
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

      if (!isEdit && form.is_recurring && form.recurring_type === "installments") {
        await db.rpc("create_recurring_installments", {
          workspace_id: wsId!,
          type: form.type,
          description: form.description.trim(),
          amount: String(Math.abs(num(form.amount))),
          status: (form.is_liquidated && !isCard) ? "paid" : "pending",
          date: form.competence_date,
          account_id: isCard ? null : (form.account_id || null),
          category_id: form.category_id || null,
          person_name: form.person_name.trim() || null,
          notes: form.notes.trim() || null,
          installments: parseInt(form.installments),
          is_fixed_amount: form.installment_mode === "fixed"
        });
        return;
      }

      if (!isEdit && form.is_recurring && form.recurring_type === "fixed") {
        // Criar na tabela de recorrência
        const rec = await db.from("recurring_transactions").insert({
          workspace_id: wsId!,
          type: form.type as any,
          description: form.description.trim(),
          amount,
          frequency: form.frequency,
          day_of_month: new Date(form.competence_date).getDate(),
          is_fixed_amount: true,
          repeat_until: form.repeat_until || null,
          category_id: form.category_id || null,
          account_id: isCard ? null : (form.account_id || null),
          notes: form.notes.trim() || null,
        });

        // Criar a primeira transação
        await db.from("transactions").insert({
          workspace_id: wsId!,
          type: form.type as any,
          description: form.description.trim(),
          amount,
          status: (form.is_liquidated && !isCard) ? "paid" : "pending",
          competence_date: form.competence_date,
          account_id: isCard ? null : (form.account_id || null),
          card_id: isCard ? (form.card_id || null) : null,
          category_id: form.category_id || null,
          person_name: form.person_name.trim() || null,
          notes: form.notes.trim() || null,
          recurring_id: rec.data.id,
          created_by: me?.id
        });
        return;
      }

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
            
            <div className="space-y-4 p-4 border rounded-lg bg-slate-50/50">
              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="recurring" 
                  checked={form.is_recurring} 
                  onCheckedChange={(v) => setForm(f => ({ ...f, is_recurring: !!v }))} 
                />
                <Label htmlFor="recurring" className="font-semibold text-slate-900">Esta conta se repete?</Label>
              </div>

              {form.is_recurring && (
                <div className="space-y-4 pt-2 border-t animate-in fade-in slide-in-from-top-2">
                  <div className="space-y-2">
                    <Label className="text-xs">Tipo de Repetição</Label>
                    <Tabs 
                      value={form.recurring_type} 
                      onValueChange={(v) => setForm(f => ({ ...f, recurring_type: v }))} 
                      className="w-full"
                    >
                      <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="fixed" className="text-xs">Fixa (Mensal)</TabsTrigger>
                        <TabsTrigger value="installments" className="text-xs">Parcelada</TabsTrigger>
                      </TabsList>
                    </Tabs>
                  </div>

                  {form.recurring_type === 'installments' ? (
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-xs">Número de Parcelas</Label>
                        <Input 
                          type="number" 
                          min="2" 
                          value={form.installments} 
                          onChange={e => setForm(f => ({ ...f, installments: e.target.value }))} 
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs">Modo do Valor</Label>
                        <select 
                          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-xs"
                          value={form.installment_mode}
                          onChange={e => setForm(f => ({ ...f, installment_mode: e.target.value }))}
                        >
                          <option value="equal">Dividir valor total</option>
                          <option value="fixed">Valor fixo por parcela</option>
                        </select>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-xs">Frequência</Label>
                        <select 
                          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-xs"
                          value={form.frequency}
                          onChange={e => setForm(f => ({ ...f, frequency: e.target.value }))}
                        >
                          <option value="weekly">Semanal</option>
                          <option value="monthly">Mensal</option>
                          <option value="annually">Anual</option>
                        </select>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs">Repetir até (opcional)</Label>
                        <Input 
                          type="date" 
                          className="text-xs"
                          value={form.repeat_until} 
                          onChange={e => setForm(f => ({ ...f, repeat_until: e.target.value }))} 
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
            
            <Button variant="ghost" className="w-full justify-between" onClick={() => setShowAdvanced(!showAdvanced)}>
              Mais detalhes {showAdvanced ? <ChevronDown className="rotate-180" /> : <ChevronDown />}
            </Button>
            
            {showAdvanced && (
              <div className="p-4 border rounded-lg bg-slate-50 space-y-4 animate-in fade-in slide-in-from-top-2">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs">Centro de Custo</Label>
                    <div className="flex gap-1">
                      <select 
                        className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-xs ring-offset-background"
                        value={form.cost_center_id}
                        onChange={e => setForm(f => ({ ...f, cost_center_id: e.target.value }))}
                      >
                        <option value="">Nenhum</option>
                        {meta?.costCenters?.map((cc: any) => (
                          <option key={cc.id} value={cc.id}>{cc.name}</option>
                        ))}
                      </select>
                      <Button size="icon" variant="outline" className="h-9 w-9 shrink-0" onClick={() => window.open('/cadastros/centros-de-custo', '_blank')}><Plus className="size-3"/></Button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Tags</Label>
                    <div className="flex gap-1">
                      <div className="flex-1 flex flex-wrap gap-1 p-1 border rounded bg-white min-h-[36px]">
                         {meta?.tags?.map((t: any) => (
                           <Badge 
                             key={t.id} 
                             variant={form.tag_ids.includes(t.id) ? "default" : "outline"}
                             className="text-[10px] cursor-pointer h-5"
                             onClick={() => {
                               const newTags = form.tag_ids.includes(t.id) 
                                 ? form.tag_ids.filter(id => id !== t.id)
                                 : [...form.tag_ids, t.id];
                               setForm(f => ({ ...f, tag_ids: newTags }));
                             }}
                           >
                             {t.name}
                           </Badge>
                         ))}
                      </div>
                      <Button size="icon" variant="outline" className="h-9 w-9 shrink-0" onClick={() => window.open('/cadastros/tags', '_blank')}><Plus className="size-3"/></Button>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground italic">Observações / Notas</Label>
                  <Input 
                    placeholder="Algum detalhe adicional..." 
                    value={form.notes} 
                    onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} 
                  />
                </div>
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
