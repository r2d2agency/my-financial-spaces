import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { db } from "@/lib/db-browser";
import { useWorkspace } from "@/lib/workspace";
import { TX_TYPES, brl, iso, monthLabel, monthRange, num, addMonths, isIncomeType, ACCOUNT_KINDS } from "@/lib/finance";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight, Check, Trash2, Plus } from "lucide-react";
import { getCurrentUser } from "@/lib/auth-client.functions";
import { useServerFn } from "@tanstack/react-start";

export const Route = createFileRoute("/_authenticated/movimentacoes")({
  component: Movimentacoes,
  head: () => ({
    meta: [
      { title: "Movimentações · Espaço Financeiro" },
      { name: "description", content: "Lance receitas, despesas, transferências e pagamentos com status pago ou pendente." },
      { property: "og:title", content: "Movimentações" },
      { property: "og:description", content: "Todos os lançamentos do seu espaço financeiro." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function Movimentacoes() {
  const { wsId, canEdit, hideBalances } = useWorkspace();
  const qc = useQueryClient();
  const [ref, setRef] = useState(() => new Date());
  const [open, setOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [recDialog, setRecDialog] = useState<{ open: boolean, txId: string, data: any } | null>(null);
  const { start, end } = monthRange(ref);
  const getUser = useServerFn(getCurrentUser);
  const [newCatOpen, setNewCatOpen] = useState(false);
  const [newAccOpen, setNewAccOpen] = useState(false);
  const [newCatName, setNewCatName] = useState("");
  const [newAccName, setNewAccName] = useState("");

  const [form, setForm] = useState({
    type: "expense",
    description: "",
    amount: "",
    competence_date: iso(new Date()),
    status: "pending",
    account_id: "",
    to_account_id: "", // Sprint A: Transferência
    category_id: "",
    card_id: "", // Sprint C
    is_recurring: false,
    recurring_type: "fixed",
    person_name: "",
    cost_center_id: "", // Sprint A
    installments: "1",
    repeat_until: "",
  });

  const { data: meta } = useQuery({
    queryKey: ["meta", wsId],
    enabled: !!wsId,
    queryFn: async () => {
      const [accountsRes, categoriesRes, costCentersRes, cardsRes] = await Promise.all([
        db.from("financial_accounts").select("id, name").eq("workspace_id", wsId!).execute(),
        db.from("categories").select("id, name, kind, subcategory_of").eq("workspace_id", wsId!).execute(),
        db.from("cost_centers").select("id, name, parent_id").eq("workspace_id", wsId!).execute(),
        db.from("credit_cards").select("id, name").eq("workspace_id", wsId!).eq("archived", false).execute(),
      ]);
      return { 
        accounts: Array.isArray(accountsRes?.data) ? accountsRes.data : [], 
        categories: Array.isArray(categoriesRes?.data) ? categoriesRes.data : [],
        costCenters: Array.isArray(costCentersRes?.data) ? costCentersRes.data : [],
        cards: Array.isArray(cardsRes?.data) ? cardsRes.data : []
      };
    },
  });

  const { data: rows } = useQuery({
    queryKey: ["tx", wsId, iso(start)],
    enabled: !!wsId,
    queryFn: async () => {
      const res = await db
        .from("transactions")
        .select("id, type, description, amount, status, competence_date, category_id, is_estimated, recurring_id, nature")
        .eq("workspace_id", wsId!)
        .execute();
      return Array.isArray(res?.data) ? res.data : [];
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      const me = await getUser({});
      const amount = num(form.amount);

      if (form.type === "transfer") {
        const { error } = await db.rpc("execute_transfer", {
          from_account_id: form.account_id,
          to_account_id: form.to_account_id,
          amount,
          description: form.description.trim(),
          date: form.competence_date,
          workspace_id: wsId!
        });
        if (error) throw error;
        return;
      }
      
      let recurring_id = null;
      if (form.is_recurring) {
        const { data: rec, error: recErr } = await db.from("recurring_transactions").insert({
          workspace_id: wsId!,
          type: form.type as any,
          description: form.description.trim(),
          amount: amount,
          is_fixed: form.recurring_type === "fixed",
          category_id: form.category_id || null,
          account_id: form.account_id || null,
          person_name: form.person_name.trim() || null,
          day_of_month: new Date(form.competence_date).getDate() || 5,
          cost_center_id: form.cost_center_id || null,
          repeat_until: form.repeat_until || null,
        });
        if (recErr) throw recErr;
        recurring_id = (rec as any).id;
      }

      // Se for parcelado, gera múltiplas transações
      const installmentsCount = parseInt(form.installments) || 1;
      
      if (installmentsCount > 1) {
        const installmentAmount = amount / installmentsCount;
        const baseDate = new Date(form.competence_date);
        
        for (let i = 0; i < installmentsCount; i++) {
          const currentDate = new Date(baseDate);
          currentDate.setMonth(baseDate.getMonth() + i);
          
          const { error } = await db.from("transactions").insert({
            workspace_id: wsId!,
            type: form.type as any,
            description: `${form.description.trim()} (${i + 1}/${installmentsCount})`,
            amount: installmentAmount,
            status: i === 0 ? (form.status as any) : "pending",
            competence_date: iso(currentDate),
            paid_date: (i === 0 && form.status === "paid") ? iso(currentDate) : null,
            account_id: form.account_id || null,
            category_id: form.category_id || null,
            card_id: form.card_id || null,
            created_by: me?.id,
            recurring_id: recurring_id,
            person_name: form.person_name.trim() || null,
            is_estimated: form.is_recurring && form.recurring_type === "variable",
            cost_center_id: form.cost_center_id || null,
          });
          if (error) throw error;
        }
      } else {
        const { error } = await db.from("transactions").insert({
          workspace_id: wsId!,
          type: form.type as any,
          description: form.description.trim(),
          amount: amount,
          status: form.status as any,
          competence_date: form.competence_date,
          paid_date: form.status === "paid" ? form.competence_date : null,
          account_id: form.account_id || null,
          category_id: form.category_id || null,
          card_id: form.card_id || null,
          created_by: me?.id,
          recurring_id: recurring_id,
          person_name: form.person_name.trim() || null,
          is_estimated: form.is_recurring && form.recurring_type === "variable",
          cost_center_id: form.cost_center_id || null,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Lançamento criado.");
      setOpen(false);
      setForm((f) => ({ ...f, description: "", amount: "" }));
      qc.invalidateQueries();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const createCategory: any = useMutation({
    mutationFn: async () => {
      if (!newCatName.trim()) throw new Error("Informe o nome da categoria");
      const parentId: any = createCategory.parent_id;
      const { data, error } = await db.from("categories").insert({
        workspace_id: wsId!,
        name: newCatName.trim(),
        kind: form.type === "income" ? "income" : "expense",
        subcategory_of: parentId && parentId !== 'none' ? parentId : null
      });
      if (error) throw error;
      return data as any;
    },
    onSuccess: (data: any) => {
      toast.success("Categoria criada.");
      setNewCatOpen(false);
      setNewCatName("");
      qc.invalidateQueries({ queryKey: ["meta", wsId] });
      setForm(f => ({ ...f, category_id: data.id }));
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const createAccount = useMutation({
    mutationFn: async () => {
      if (!newAccName.trim()) throw new Error("Informe o nome da conta");
      const { data, error } = await db.from("financial_accounts").insert({
        workspace_id: wsId!,
        name: newAccName.trim(),
        kind: "checking"
      });
      if (error) throw error;
      return data as any;
    },
    onSuccess: (data: any) => {
      toast.success("Conta criada.");
      setNewAccOpen(false);
      setNewAccName("");
      qc.invalidateQueries({ queryKey: ["meta", wsId] });
      setForm(f => ({ ...f, account_id: data.id }));
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const createCostCenter = useMutation({
    mutationFn: async ({ name, parent_id }: { name: string; parent_id?: string | null }) => {
      const { data, error } = await db.from("cost_centers").insert({
        workspace_id: wsId!,
        name: name.trim(),
        parent_id: parent_id || null
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("Centro de custo criado.");
      qc.invalidateQueries({ queryKey: ["meta", wsId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const settle = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db
        .from("transactions")
        .update({ status: "paid", paid_date: iso(new Date()) })
        .eq("id", id)
        .execute();
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries(),
    onError: (e: Error) => toast.error(e.message),
  });

  const updateTx = useMutation({
    mutationFn: async ({ id, data, scope }: { id: string, data: any, scope: 'single' | 'all' }) => {
      if (scope === 'all' && data.recurring_id) {
        // Atualiza a regra de recorrência
        await db.from("recurring_transactions").update({
          description: data.description,
          amount: num(data.amount),
          category_id: data.category_id || null,
          account_id: data.account_id || null,
          person_name: data.person_name || null,
          cost_center_id: data.cost_center_id || null,
        }).eq("id", data.recurring_id).execute();

        // Atualiza todas as transações pendentes futuras daquela recorrência
        await db.from("transactions").update({
          description: data.description,
          amount: num(data.amount),
          category_id: data.category_id || null,
          account_id: data.account_id || null,
          person_name: data.person_name || null,
          cost_center_id: data.cost_center_id || null,
        }).eq("recurring_id", data.recurring_id).eq("status", "pending").execute();
      } else {
        const { error } = await db.from("transactions").update({
          description: data.description,
          amount: num(data.amount),
          status: data.status,
          competence_date: data.competence_date,
          account_id: data.account_id || null,
          category_id: data.category_id || null,
          card_id: data.card_id || null,
          person_name: data.person_name || null,
          cost_center_id: data.cost_center_id || null,
        }).eq("id", id).execute();
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Lançamento atualizado.");
      setEditOpen(false);
      setRecDialog(null);
      qc.invalidateQueries();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async ({ id, recurring_id, scope }: { id: string, recurring_id?: string, scope: 'single' | 'all' }) => {
      if (scope === 'all' && recurring_id) {
        // Deleta a recorrência
        await db.from("recurring_transactions").delete().eq("id", recurring_id).execute();
        // Deleta todas as transações futuras dessa recorrência
        const { error } = await db.from("transactions").delete().eq("recurring_id", recurring_id).eq("status", "pending").execute();
        if (error) throw error;
      } else {
        const { error } = await db.from("transactions").delete().eq("id", id).execute();
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Excluído com sucesso.");
      setRecDialog(null);
      qc.invalidateQueries();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const catName = (id: string | null) => (meta as any)?.categories.find((c: any) => c.id === id)?.name ?? "—";
  const accName = (id: string | null) => (meta as any)?.accounts.find((a: any) => a.id === id)?.name ?? "—";
  const money = (v: number) => (hideBalances ? "•••" : brl(v));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Movimentações</h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => setRef((d) => addMonths(d, -1))}>
            <ChevronLeft className="size-4" />
          </Button>
          <span className="w-36 text-center text-sm capitalize">{monthLabel(ref)}</span>
          <Button variant="outline" size="icon" onClick={() => setRef((d) => addMonths(d, 1))}>
            <ChevronRight className="size-4" />
          </Button>
          {canEdit && (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button>Novo lançamento</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Novo lançamento</DialogTitle>
                </DialogHeader>
                <div className="space-y-3">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1">
                      <Label>Tipo</Label>
                      <Select value={form.type} onValueChange={(v) => setForm((f) => ({ ...f, type: v }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {TX_TYPES.map((t) => (
                            <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label>Status</Label>
                      <Select value={form.status} onValueChange={(v) => setForm((f) => ({ ...f, status: v }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pending">Pendente</SelectItem>
                          <SelectItem value="paid">Pago</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label>Descrição</Label>
                    <Input value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1">
                      <Label>Valor</Label>
                      <Input type="number" step="0.01" value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} />
                    </div>
                    <div className="space-y-1">
                      <Label>Data</Label>
                      <Input type="date" value={form.competence_date} onChange={(e) => setForm((f) => ({ ...f, competence_date: e.target.value }))} />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label>{isIncomeType(form.type) ? "Cliente / Origem" : "Fornecedor / Destino"}</Label>
                    <Input 
                      placeholder="Nome do cliente ou fornecedor" 
                      value={form.person_name} 
                      onChange={(e) => setForm((f) => ({ ...f, person_name: e.target.value }))} 
                    />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <Label>{form.type === "transfer" ? "Conta de Origem" : "Conta"}</Label>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-5 w-5" 
                          onClick={(e) => {
                            e.preventDefault();
                            setNewAccOpen(true);
                          }}
                        >
                          <Plus className="size-3" />
                        </Button>
                      </div>
                      <Select value={form.account_id} onValueChange={(v) => setForm((f) => ({ ...f, account_id: v }))}>
                        <SelectTrigger><SelectValue placeholder="Opcional" /></SelectTrigger>
                        <SelectContent>
                          {(meta as any)?.accounts.map((a: any) => (
                            <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {form.type === "transfer" ? (
                      <div className="space-y-1">
                        <Label>Conta de Destino</Label>
                        <Select value={form.to_account_id} onValueChange={(v) => setForm((f) => ({ ...f, to_account_id: v }))}>
                          <SelectTrigger><SelectValue placeholder="Selecione o destino" /></SelectTrigger>
                          <SelectContent>
                            {(meta as any)?.accounts.filter((a: any) => a.id !== form.account_id).map((a: any) => (
                              <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <Label>Categoria</Label>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-5 w-5" 
                            onClick={(e) => {
                              e.preventDefault();
                              setNewCatOpen(true);
                            }}
                          >
                            <Plus className="size-3" />
                          </Button>
                        </div>
                        <Select value={form.category_id} onValueChange={(v) => setForm((f) => ({ ...f, category_id: v }))}>
                          <SelectTrigger><SelectValue placeholder="Opcional" /></SelectTrigger>
                          <SelectContent>
                            {(meta as any)?.categories.map((c: any) => (
                              <SelectItem key={c.id} value={c.id}>
                                {c.subcategory_of ? "  └ " : ""}{c.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>
                  
                  {form.type !== "transfer" && (
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <Label>Centro de Custo</Label>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-5 w-5" 
                            onClick={(e) => {
                              e.preventDefault();
                              const name = window.prompt("Nome do centro de custo:");
                              if (name) {
                                const parentId = window.confirm("É um subcentro de custo? Clique OK para selecionar o pai.") 
                                  ? window.prompt("Digite o ID do centro de custo pai (ou deixe vazio):") 
                                  : null;
                                createCostCenter.mutate({ name, parent_id: parentId });
                              }
                            }}
                          >
                            <Plus className="size-3" />
                          </Button>
                        </div>
                        <Select value={form.cost_center_id} onValueChange={(v) => setForm((f) => ({ ...f, cost_center_id: v }))}>
                          <SelectTrigger><SelectValue placeholder="Opcional" /></SelectTrigger>
                          <SelectContent>
                            {(meta as any)?.costCenters?.map((cc: any) => (
                              <SelectItem key={cc.id} value={cc.id}>
                                {cc.parent_id ? "  └ " : ""}{cc.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  )}
                  
                  {form.type === "expense" && (
                    <div className="space-y-1">
                      <Label>Cartão de Crédito</Label>
                      <Select value={form.card_id} onValueChange={(v) => setForm((f) => ({ ...f, card_id: v }))}>
                        <SelectTrigger><SelectValue placeholder="Opcional (Lançar em cartão)" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Nenhum</SelectItem>
                          {(meta as any)?.cards?.map((c: any) => (
                            <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {form.card_id && form.card_id !== 'none' && (
                        <p className="text-[10px] text-muted-foreground italic">
                          Lançamento pendente no cartão até o pagamento da fatura.
                        </p>
                      )}
                    </div>
                  )}
                  
                  <div className="space-y-3 pt-2">
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <input 
                          type="checkbox" 
                          id="is_recurring"
                          checked={form.is_recurring} 
                          onChange={(e) => setForm(f => ({ ...f, is_recurring: e.target.checked, installments: "1" }))}
                          className="size-4 rounded border-gray-300 text-primary focus:ring-primary"
                        />
                        <Label htmlFor="is_recurring" className="cursor-pointer">Recorrente</Label>
                      </div>

                      <div className="flex items-center gap-2">
                        <input 
                          type="checkbox" 
                          id="is_parcelled"
                          checked={parseInt(form.installments) > 1} 
                          onChange={(e) => setForm(f => ({ ...f, installments: e.target.checked ? "2" : "1", is_recurring: false }))}
                          className="size-4 rounded border-gray-300 text-primary focus:ring-primary"
                        />
                        <Label htmlFor="is_parcelled" className="cursor-pointer">Parcelado</Label>
                      </div>
                    </div>

                    {form.is_recurring && (
                      <div className="grid gap-3 sm:grid-cols-2 p-3 bg-muted/50 rounded-lg">
                        <div className="space-y-1">
                          <Label>Tipo de recorrência</Label>
                          <Select value={form.recurring_type} onValueChange={(v) => setForm(f => ({ ...f, recurring_type: v }))}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="fixed">Fixo (Aluguel, Internet...)</SelectItem>
                              <SelectItem value="variable">Variável (Luz, Água...)</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1">
                          <Label>Até quando? (Opcional)</Label>
                          <Input type="date" value={form.repeat_until} onChange={(e) => setForm(f => ({ ...f, repeat_until: e.target.value }))} />
                        </div>
                      </div>
                    )}

                    {parseInt(form.installments) > 1 && (
                      <div className="grid gap-3 sm:grid-cols-2 p-3 bg-muted/50 rounded-lg">
                        <div className="space-y-1">
                          <Label>Quantidade de parcelas</Label>
                          <Input 
                            type="number" 
                            min="2" 
                            max="360" 
                            value={form.installments} 
                            onChange={(e) => setForm(f => ({ ...f, installments: e.target.value }))} 
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">O valor total será dividido entre as parcelas.</Label>
                        </div>
                      </div>
                    )}
                  </div>

                  <Button className="w-full" disabled={create.isPending || !form.description || !form.amount} onClick={() => create.mutate()}>
                    {create.isPending ? "Salvando..." : "Salvar"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      {/* Modais de cadastro rápido */}
      <Dialog open={newCatOpen} onOpenChange={setNewCatOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nova categoria</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Nome da categoria</Label>
              <Input 
                placeholder="Ex: Alimentação, Aluguel..." 
                value={newCatName}
                onChange={(e) => setNewCatName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && createCategory.mutate()}
              />
            </div>
            <div className="space-y-2">
              <Label>Categoria pai (opcional)</Label>
              <Select onValueChange={(v) => {
                // Adicionaremos o parent_id na mutação
                (createCategory as any).parent_id = v;
              }}>
                <SelectTrigger><SelectValue placeholder="Nenhuma" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhuma</SelectItem>
                  {(meta as any)?.categories.filter((c: any) => !c.subcategory_of).map((c: any) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewCatOpen(false)}>Cancelar</Button>
            <Button onClick={() => createCategory.mutate()} disabled={createCategory.isPending}>
              {createCategory.isPending ? "Criando..." : "Criar categoria"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={newAccOpen} onOpenChange={setNewAccOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nova conta</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Nome da conta</Label>
              <Input 
                placeholder="Ex: Nubank, Itaú, Dinheiro..." 
                value={newAccName}
                onChange={(e) => setNewAccName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && createAccount.mutate()}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewAccOpen(false)}>Cancelar</Button>
            <Button onClick={() => createAccount.mutate()} disabled={createAccount.isPending}>
              {createAccount.isPending ? "Criando..." : "Criar conta"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{(rows ?? []).length} lançamentos</CardTitle>
        </CardHeader>
        <CardContent className="divide-y divide-border">
          {(rows ?? []).length === 0 && <p className="py-4 text-sm text-muted-foreground">Nada por aqui neste mês.</p>}
          {(rows ?? []).map((t: any) => (
            <div key={t.id} className="flex flex-wrap items-center justify-between gap-2 py-3 hover:bg-muted/30 px-2 rounded-lg transition-colors group">
              <div className="min-w-0 flex-1 cursor-pointer" onClick={() => {
                setForm({
                  ...form,
                  type: t.type,
                  description: t.description,
                  amount: String(Math.abs(t.amount)),
                  competence_date: iso(new Date(t.competence_date)),
                  status: t.status,
                  account_id: t.account_id || "",
                  category_id: t.category_id || "",
                  person_name: t.person_name || "",
                  cost_center_id: t.cost_center_id || "",
                  is_recurring: !!t.recurring_id,
                });
                // Hack para guardar o ID sendo editado
                (form as any).id = t.id;
                (form as any).recurring_id = t.recurring_id;
                setEditOpen(true);
              }}>
                <p className="truncate font-medium text-foreground">{t.description}</p>
                <p className="text-xs text-muted-foreground">
                  {typeof t.competence_date === "string" ? t.competence_date.split("-").reverse().join("/") : new Date(t.competence_date).toLocaleDateString("pt-BR")} · {catName(t.category_id)} · {accName(t.account_id)}
                  {t.person_name && <span className="ml-2 font-medium text-foreground">({t.person_name})</span>}
                  {t.recurring_id && <span className="ml-2 text-[10px] uppercase tracking-wider text-primary font-bold">● Recorrente</span>}
                  {t.is_estimated && <span className="ml-2 text-[10px] uppercase tracking-wider text-amber-500 font-bold">● Estimado</span>}
                  {t.nature === 'refund' && <span className="ml-2 text-[10px] uppercase tracking-wider text-emerald-500 font-bold">● Estorno</span>}
                  {t.nature === 'reversal' && <span className="ml-2 text-[10px] uppercase tracking-wider text-red-500 font-bold">● Reembolso</span>}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Badge variant={t.status === "paid" ? "secondary" : "outline"}>
                  {t.status === "paid" ? "Pago" : "Pendente"}
                </Badge>
                <span className={isIncomeType(t.type) ? "font-semibold text-primary" : "font-semibold text-foreground"}>
                  {isIncomeType(t.type) ? "+" : "-"} {money(num(t.amount))}
                </span>
                {canEdit && t.status === "pending" && (
                  <Button size="icon" variant="ghost" onClick={() => settle.mutate(t.id)}>
                    <Check className="size-4" />
                  </Button>
                )}
                {canEdit && (
                  <Button 
                    size="icon" 
                    variant="ghost" 
                    className="text-muted-foreground hover:text-destructive"
                    onClick={() => {
                      if (t.recurring_id) {
                        setRecDialog({ open: true, txId: t.id, data: { ...t, action: 'delete' } });
                      } else {
                        remove.mutate({ id: t.id, scope: 'single' });
                      }
                    }}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Modal de Edição */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar lançamento</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
             <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label>Tipo</Label>
                  <Select value={form.type} onValueChange={(v) => setForm((f) => ({ ...f, type: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {TX_TYPES.map((t) => (
                        <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Status</Label>
                  <Select value={form.status} onValueChange={(v) => setForm((f) => ({ ...f, status: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">Pendente</SelectItem>
                      <SelectItem value="paid">Pago</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1">
                <Label>Descrição</Label>
                <Input value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label>Valor</Label>
                  <Input type="number" step="0.01" value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} />
                </div>
                <div className="space-y-1">
                  <Label>Data</Label>
                  <Input type="date" value={form.competence_date} onChange={(e) => setForm((f) => ({ ...f, competence_date: e.target.value }))} />
                </div>
              </div>
              
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label>Conta</Label>
                  <Select value={form.account_id} onValueChange={(v) => setForm((f) => ({ ...f, account_id: v }))}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      {(meta as any)?.accounts.map((a: any) => (
                        <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Categoria</Label>
                  <Select value={form.category_id} onValueChange={(v) => setForm((f) => ({ ...f, category_id: v }))}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      {(meta as any)?.categories.map((c: any) => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Button 
                className="w-full" 
                onClick={() => {
                  const txId = (form as any).id;
                  const recurringId = (form as any).recurring_id;
                  if (recurringId) {
                    setRecDialog({ open: true, txId, data: { ...form, action: 'update', recurring_id: recurringId } });
                  } else {
                    updateTx.mutate({ id: txId, data: form, scope: 'single' });
                  }
                }}
              >
                {updateTx.isPending ? "Salvando..." : "Salvar Alterações"}
              </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Diálogo de Recorrência */}
      <Dialog open={!!recDialog?.open} onOpenChange={(o) => !o && setRecDialog(null)}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Lançamento Recorrente</DialogTitle>
          </DialogHeader>
          <div className="py-4 text-sm text-muted-foreground">
            Este lançamento faz parte de uma recorrência. Deseja aplicar esta ação apenas a este lançamento ou a todos os futuros?
          </div>
          <DialogFooter className="flex-col gap-2 sm:flex-row">
            <Button variant="outline" className="w-full sm:w-auto" onClick={() => {
              if (recDialog?.data.action === 'delete') {
                remove.mutate({ id: recDialog.txId, scope: 'single' });
              } else {
                updateTx.mutate({ id: recDialog!.txId, data: recDialog!.data, scope: 'single' });
              }
            }}>
              Apenas este
            </Button>
            <Button className="w-full sm:w-auto" onClick={() => {
              if (recDialog?.data.action === 'delete') {
                remove.mutate({ id: recDialog.txId, recurring_id: recDialog.data.recurring_id, scope: 'all' });
              } else {
                updateTx.mutate({ id: recDialog!.txId, data: recDialog!.data, scope: 'all' });
              }
            }}>
              Todos os futuros
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
