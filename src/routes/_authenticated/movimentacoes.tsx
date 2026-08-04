import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { db } from "@/lib/db-browser";
import { useWorkspace } from "@/lib/workspace";
import { TX_TYPES, brl, iso, monthLabel, monthRange, num, addMonths, isIncomeType } from "@/lib/finance";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight, Check, Trash2 } from "lucide-react";
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
  const { start, end } = monthRange(ref);
  const getUser = useServerFn(getCurrentUser);

  const [form, setForm] = useState({
    type: "expense",
    description: "",
    amount: "",
    competence_date: iso(new Date()),
    status: "pending",
    account_id: "",
    category_id: "",
    is_recurring: false,
    recurring_type: "fixed", // "fixed" ou "variable" (estimated)
  });

  const { data: meta } = useQuery({
    queryKey: ["meta", wsId],
    enabled: !!wsId,
    queryFn: async () => {
      const [accounts, categories] = await Promise.all([
        db.from("financial_accounts").select("id, name").eq("workspace_id", wsId!).execute(),
        db.from("categories").select("id, name, kind").eq("workspace_id", wsId!).execute(),
      ]);
      return { accounts: accounts.data ?? [], categories: categories.data ?? [] };
    },
  });

  const { data: rows } = useQuery({
    queryKey: ["tx", wsId, iso(start)],
    enabled: !!wsId,
    queryFn: async () => {
      const { data, error } = await db
        .from("transactions")
        .select("id, type, description, amount, status, competence_date, category_id, is_estimated, recurring_id")
        .eq("workspace_id", wsId!)
        .execute(); // Simplificando para o db-browser básico
      if (error) throw error;
      return data ?? [];
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      const me = await getUser({});
      const amount = num(form.amount);
      
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
          day_of_month: new Date(form.competence_date).getDate() || 5,
        });
        if (recErr) throw recErr;
        recurring_id = rec.id;
      }

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
        created_by: me?.id,
        recurring_id: recurring_id,
        is_estimated: form.is_recurring && form.recurring_type === "variable",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Lançamento criado.");
      setOpen(false);
      setForm((f) => ({ ...f, description: "", amount: "" }));
      qc.invalidateQueries();
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

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.from("transactions").delete().eq("id", id).execute();
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries(),
    onError: (e: Error) => toast.error(e.message),
  });

  const catName = (id: string | null) => (meta as any)?.categories.find((c: any) => c.id === id)?.name ?? "—";
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
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1">
                      <Label>Conta</Label>
                      <Select value={form.account_id} onValueChange={(v) => setForm((f) => ({ ...f, account_id: v }))}>
                        <SelectTrigger><SelectValue placeholder="Opcional" /></SelectTrigger>
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
                        <SelectTrigger><SelectValue placeholder="Opcional" /></SelectTrigger>
                        <SelectContent>
                          {(meta as any)?.categories.map((c: any) => (
                            <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4 py-2">
                    <div className="flex items-center gap-2">
                      <input 
                        type="checkbox" 
                        id="is_recurring"
                        checked={form.is_recurring} 
                        onChange={(e) => setForm(f => ({ ...f, is_recurring: e.target.checked }))}
                        className="size-4 rounded border-gray-300 text-primary focus:ring-primary"
                      />
                      <Label htmlFor="is_recurring" className="cursor-pointer">Recorrente</Label>
                    </div>

                    {form.is_recurring && (
                      <div className="flex items-center gap-3">
                        <label className="flex items-center gap-1 text-sm cursor-pointer">
                          <input 
                            type="radio" 
                            name="rec_type" 
                            checked={form.recurring_type === "fixed"} 
                            onChange={() => setForm(f => ({ ...f, recurring_type: "fixed" }))}
                          />
                          Fixo
                        </label>
                        <label className="flex items-center gap-1 text-sm cursor-pointer">
                          <input 
                            type="radio" 
                            name="rec_type" 
                            checked={form.recurring_type === "variable"} 
                            onChange={() => setForm(f => ({ ...f, recurring_type: "variable" }))}
                          />
                          Variável (Estimativa)
                        </label>
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

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{(rows ?? []).length} lançamentos</CardTitle>
        </CardHeader>
        <CardContent className="divide-y divide-border">
          {(rows ?? []).length === 0 && <p className="py-4 text-sm text-muted-foreground">Nada por aqui neste mês.</p>}
          {(rows ?? []).map((t: any) => (
            <div key={t.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
              <div className="min-w-0">
                <p className="truncate font-medium text-foreground">{t.description}</p>
                <p className="text-xs text-muted-foreground">
                  {typeof t.competence_date === "string" ? t.competence_date.split("-").reverse().join("/") : new Date(t.competence_date).toLocaleDateString("pt-BR")} · {catName(t.category_id)}
                  {t.recurring_id && <span className="ml-2 text-[10px] uppercase tracking-wider text-primary font-bold">● Recorrente</span>}
                  {t.is_estimated && <span className="ml-2 text-[10px] uppercase tracking-wider text-amber-500 font-bold">● Estimado</span>}
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
                  <Button size="icon" variant="ghost" onClick={() => remove.mutate(t.id)}>
                    <Trash2 className="size-4" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
