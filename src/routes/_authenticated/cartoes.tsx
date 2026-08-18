import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { db } from "@/lib/db-browser";
import { useWorkspace } from "@/lib/workspace";
import { brl, num } from "@/lib/finance";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";

export const Route = createFileRoute("/_authenticated/cartoes")({
  component: Cartoes,
  head: () => ({
    meta: [
      { title: "Cartões de crédito · Espaço Financeiro" },
      { name: "description", content: "Cadastre cartões, limites, fechamento e vencimento e acompanhe o uso da fatura." },
      { property: "og:title", content: "Cartões de crédito" },
      { property: "og:description", content: "Faturas e limites sob controle." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function Cartoes() {
  const { wsId, canEdit, hideBalances } = useWorkspace();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ name: "", brand: "", credit_limit: "", closing_day: "1", due_day: "10" });

  const { data } = useQuery({
    queryKey: ["cards", wsId],
    enabled: !!wsId,
    queryFn: async () => {
      const [cards, tx, bills] = await Promise.all([
        db.from("credit_cards").select("*").eq("workspace_id", wsId!).eq("archived", false).order("name").execute(),
        db.from("transactions").select("amount, card_id, status, competence_date, description").eq("workspace_id", wsId!).not("card_id", "is", null).execute(),
        db.from("credit_card_bills").select("*").eq("workspace_id", wsId!).execute(),
      ]);
      return { 
        cards: cards.data ?? [], 
        tx: tx.data ?? [],
        bills: bills.data ?? []
      };
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      const { error } = await db.from("credit_cards").insert({
        workspace_id: wsId!,
        name: f.name.trim(),
        brand: f.brand.trim() || null,
        credit_limit: num(f.credit_limit),
        closing_day: Number(f.closing_day) || 1,
        due_day: Number(f.due_day) || 10,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Cartão criado.");
      setOpen(false);
      setF({ name: "", brand: "", credit_limit: "", closing_day: "1", due_day: "10" });
      qc.invalidateQueries();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const payBill = useMutation({
    mutationFn: async (p: { card_id: string; amount: number; month: number; year: number }) => {
      // 1. Criar transação de pagamento de fatura no extrato (saída da conta corrente)
      const { data: card } = await db.from("credit_cards").select("name").eq("id", p.card_id).single().execute();
      
      await db.from("transactions").insert({
        workspace_id: wsId!,
        description: `Pagamento Fatura: ${card?.name || "Cartão"} (${p.month}/${p.year})`,
        amount: p.amount,
        type: "expense",
        status: "confirmed",
        competence_date: new Date().toISOString().slice(0, 10),
      });

      // 2. Marcar a fatura como paga
      await db.from("credit_card_bills").insert({
        workspace_id: wsId!,
        card_id: p.card_id,
        amount: p.amount,
        period_month: p.month,
        period_year: p.year,
        status: 'paid',
        paid_at: new Date().toISOString()
      });

      // 3. Opcional: Marcar transações do período como 'paid' no cartão
      // Por simplicidade, o saldo "aberto" é calculado dinamicamente
    },
    onSuccess: () => {
      toast.success("Fatura registrada como paga.");
      qc.invalidateQueries();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const money = (v: number) => (hideBalances ? "•••" : brl(v));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Cartões de crédito</h1>
        {canEdit && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>Novo cartão</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Novo cartão</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div className="space-y-1">
                  <Label>Nome</Label>
                  <Input value={f.name} onChange={(e) => setF((p) => ({ ...p, name: e.target.value }))} />
                </div>
                <div className="space-y-1">
                  <Label>Bandeira</Label>
                  <Input value={f.brand} onChange={(e) => setF((p) => ({ ...p, brand: e.target.value }))} />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label>Limite</Label>
                    <Input type="number" value={f.credit_limit} onChange={(e) => setF((p) => ({ ...p, credit_limit: e.target.value }))} />
                  </div>
                  <div className="space-y-1">
                    <Label>Fechamento</Label>
                    <Input type="number" value={f.closing_day} onChange={(e) => setF((p) => ({ ...p, closing_day: e.target.value }))} />
                  </div>
                  <div className="space-y-1">
                    <Label>Vencimento</Label>
                    <Input type="number" value={f.due_day} onChange={(e) => setF((p) => ({ ...p, due_day: e.target.value }))} />
                  </div>
                </div>
                <Button className="w-full" disabled={!f.name || create.isPending} onClick={() => create.mutate()}>
                  Salvar
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {(data?.cards ?? []).length === 0 && <p className="text-sm text-muted-foreground">Nenhum cartão cadastrado.</p>}
        {(data?.cards ?? []).map((c: any) => {
          const now = new Date();
          const currentMonth = now.getMonth() + 1;
          const currentYear = now.getFullYear();

          // Transações pendentes do cartão
          const used = ((data as any)?.tx ?? []).filter((t: any) => t.card_id === c.id && t.status === "pending").reduce((s: number, t: any) => s + num(t.amount), 0);
          
          // Verificar se a fatura atual já foi paga
          const isBillPaid = ((data as any)?.bills ?? []).some((b: any) => b.card_id === c.id && b.period_month === currentMonth && b.period_year === currentYear && b.status === 'paid');

          const pct = num(c.credit_limit) > 0 ? (used / num(c.credit_limit)) * 100 : 0;
          
          return (
            <Card key={c.id} className="relative overflow-hidden">
              <div className="absolute right-3 top-3">
                <span className="text-[10px] font-bold uppercase text-muted-foreground opacity-50">{c.brand || 'Card'}</span>
              </div>
              <CardHeader>
                <CardTitle className="text-lg">{c.name}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Fatura aberta</span>
                    <span>Limite {money(num(c.credit_limit))}</span>
                  </div>
                  <p className="text-2xl font-bold text-foreground">{money(used)}</p>
                  <Progress value={Math.min(100, pct)} className="h-2" />
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px] text-muted-foreground">
                  <div className="rounded-md bg-muted/50 p-2 text-center">
                    <p className="uppercase opacity-70">Fechamento</p>
                    <p className="text-sm font-semibold text-foreground">Dia {c.closing_day}</p>
                  </div>
                  <div className="rounded-md bg-muted/50 p-2 text-center">
                    <p className="uppercase opacity-70">Vencimento</p>
                    <p className="text-sm font-semibold text-foreground">Dia {c.due_day}</p>
                  </div>
                </div>

                <div className="space-y-2 pt-2">
                  <Button 
                    variant={isBillPaid ? "outline" : "default"} 
                    size="sm" 
                    className="w-full"
                    disabled={used <= 0 || isBillPaid || payBill.isPending}
                    onClick={() => payBill.mutate({ card_id: c.id, amount: used, month: currentMonth, year: currentYear })}
                  >
                    {isBillPaid ? "Fatura Paga" : "Pagar Fatura"}
                  </Button>
                  
                  <div className="flex justify-center">
                    <Link 
                      to="/movimentacoes" 
                      search={{ account_id: undefined }}
                      className="text-[10px] text-muted-foreground hover:text-primary transition-colors underline underline-offset-4"
                    >
                      Ver lançamentos deste cartão
                    </Link>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
