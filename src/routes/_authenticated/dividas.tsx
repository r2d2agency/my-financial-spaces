import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/lib/workspace";
import { brl, num, simulatePayoff } from "@/lib/finance";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";

export const Route = createFileRoute("/_authenticated/dividas")({
  component: Dividas,
  head: () => ({
    meta: [
      { title: "Dívidas e financiamentos · Espaço Financeiro" },
      { name: "description", content: "Controle saldo devedor, parcelas e simule a antecipação de pagamentos para economizar juros." },
      { property: "og:title", content: "Dívidas e financiamentos" },
      { property: "og:description", content: "Simule antecipações e saia do vermelho mais rápido." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function Dividas() {
  const { wsId, canEdit, hideBalances } = useWorkspace();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [extra, setExtra] = useState("");
  const [f, setF] = useState({
    name: "",
    creditor: "",
    outstanding: "",
    interest_rate: "",
    installment_amount: "",
    installments_total: "12",
    installments_paid: "0",
    due_day: "10",
  });

  const { data: debts } = useQuery({
    queryKey: ["debts", wsId],
    enabled: !!wsId,
    queryFn: async () => {
      const { data, error } = await supabase.from("debts").select("*").eq("workspace_id", wsId!).order("priority");
      if (error) throw error;
      return data ?? [];
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("debts").insert({
        workspace_id: wsId!,
        name: f.name.trim(),
        creditor: f.creditor.trim() || null,
        initial_amount: num(f.outstanding),
        outstanding: num(f.outstanding),
        interest_rate: num(f.interest_rate),
        installment_amount: num(f.installment_amount),
        installments_total: Number(f.installments_total) || 1,
        installments_paid: Number(f.installments_paid) || 0,
        due_day: Number(f.due_day) || 10,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Dívida cadastrada.");
      setOpen(false);
      qc.invalidateQueries();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const pay = useMutation({
    mutationFn: async (d: { id: string; amount: number; outstanding: number; paid: number }) => {
      const { error } = await supabase.from("debt_payments").insert({
        workspace_id: wsId!,
        debt_id: d.id,
        amount: d.amount,
        paid_date: new Date().toISOString().slice(0, 10),
      });
      if (error) throw error;
      const rest = Math.max(0, d.outstanding - d.amount);
      const { error: e2 } = await supabase
        .from("debts")
        .update({ outstanding: rest, installments_paid: d.paid + 1, status: rest <= 0.01 ? "paid" : "active" })
        .eq("id", d.id);
      if (e2) throw e2;
    },
    onSuccess: () => {
      toast.success("Pagamento registrado.");
      qc.invalidateQueries();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const money = (v: number) => (hideBalances ? "•••" : brl(v));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Dívidas e financiamentos</h1>
        {canEdit && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>Nova dívida</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Nova dívida</DialogTitle>
              </DialogHeader>
              <div className="grid gap-3 sm:grid-cols-2">
                {[
                  ["name", "Nome"],
                  ["creditor", "Credor"],
                  ["outstanding", "Saldo devedor"],
                  ["interest_rate", "Juros % a.m."],
                  ["installment_amount", "Valor da parcela"],
                  ["installments_total", "Total de parcelas"],
                  ["installments_paid", "Parcelas pagas"],
                  ["due_day", "Dia de vencimento"],
                ].map((row) => {
                  const k = row[0] as string;
                  return (
                    <div key={k} className="space-y-1">
                      <Label>{row[1]}</Label>
                      <Input
                        value={(f as Record<string, string>)[k] ?? ""}
                        onChange={(e) => setF((p) => ({ ...p, [k]: e.target.value }))}
                      />
                    </div>
                  );
                })}
              </div>
              <Button className="mt-3 w-full" disabled={!f.name || create.isPending} onClick={() => create.mutate()}>
                Salvar
              </Button>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Simulação de antecipação</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="max-w-xs space-y-1">
            <Label>Valor extra mensal</Label>
            <Input type="number" value={extra} onChange={(e) => setExtra(e.target.value)} placeholder="Ex: 300" />
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        {(debts ?? []).length === 0 && <p className="text-sm text-muted-foreground">Nenhuma dívida cadastrada.</p>}
        {(debts ?? []).map((d: any) => {
          const sim = simulatePayoff(num(d.outstanding), num(d.installment_amount), num(d.interest_rate), num(extra));
          const pct = d.installments_total > 0 ? (d.installments_paid / d.installments_total) * 100 : 0;
          return (
            <Card key={d.id}>
              <CardHeader>
                <CardTitle className="text-base">
                  {d.name} {d.status === "paid" && <span className="text-xs text-primary">· quitada</span>}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-muted-foreground">
                <p className="text-lg font-semibold text-foreground">{money(num(d.outstanding))}</p>
                <p>
                  Parcela {money(num(d.installment_amount))} · {d.installments_paid}/{d.installments_total} · juros{" "}
                  {num(d.interest_rate)}% a.m.
                </p>
                <Progress value={Math.min(100, pct)} />
                {num(extra) > 0 && (
                  <div className="rounded-md bg-muted p-3 text-xs">
                    Pagando {brl(num(extra))} a mais por mês: quita em{" "}
                    <strong className="text-foreground">{sim.boostedMonths} meses</strong> (em vez de {sim.baseMonths}),
                    economizando {brl(sim.interestSaved)} em juros.
                  </div>
                )}
                {canEdit && d.status === "active" && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      pay.mutate({
                        id: d.id,
                        amount: num(d.installment_amount) + num(extra),
                        outstanding: num(d.outstanding),
                        paid: d.installments_paid,
                      })
                    }
                  >
                    Registrar pagamento
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
