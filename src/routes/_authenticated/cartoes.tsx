import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
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
      const [cards, tx] = await Promise.all([
        supabase.from("credit_cards").select("*").eq("workspace_id", wsId!).eq("archived", false).order("name"),
        supabase.from("transactions").select("amount, card_id, status").eq("workspace_id", wsId!).not("card_id", "is", null),
      ]);
      return { cards: cards.data ?? [], tx: tx.data ?? [] };
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("credit_cards").insert({
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

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {(data?.cards ?? []).length === 0 && <p className="text-sm text-muted-foreground">Nenhum cartão cadastrado.</p>}
        {(data?.cards ?? []).map((c) => {
          const used = (data?.tx ?? []).filter((t) => t.card_id === c.id && t.status === "pending").reduce((s, t) => s + num(t.amount), 0);
          const pct = num(c.credit_limit) > 0 ? (used / num(c.credit_limit)) * 100 : 0;
          return (
            <Card key={c.id}>
              <CardHeader>
                <CardTitle className="text-base">{c.name}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-muted-foreground">
                <p>{c.brand ?? "—"} · fecha dia {c.closing_day} · vence dia {c.due_day}</p>
                <p className="text-foreground">Fatura aberta: {money(used)}</p>
                <Progress value={Math.min(100, pct)} />
                <p className="text-xs">Limite {money(num(c.credit_limit))}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
