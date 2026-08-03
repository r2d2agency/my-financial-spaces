import { createFileRoute, useNavigate, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ACCOUNT_KINDS, ROLES, brl, num } from "@/lib/finance";

export const Route = createFileRoute("/onboarding")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw redirect({ to: "/auth", replace: true });
  },
  component: Onboarding,
  head: () => ({
    meta: [
      { title: "Configurar espaço · Espaço Financeiro" },
      { name: "description", content: "Assistente de criação do seu espaço financeiro: renda, contas, cartões, despesas fixas, dívidas e metas." },
      { property: "og:title", content: "Configurar espaço financeiro" },
      { property: "og:description", content: "Crie seu espaço em poucos passos." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

type Account = { name: string; kind: string; initial_balance: string };
type Card_ = { name: string; credit_limit: string; closing_day: string; due_day: string };
type Fixed = { description: string; amount: string; day_of_month: string };
type Debt = { name: string; outstanding: string; installment_amount: string; installments_total: string; due_day: string };
type Invite = { email: string; role: string; hide_balances: boolean };
type Goal = { name: string; target_amount: string };

const steps = ["Espaço", "Contas", "Cartões", "Despesas fixas", "Dívidas", "Equipe", "Metas"];

function Onboarding() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState("Minha Vida Financeira");
  const [income, setIncome] = useState("");
  const [accounts, setAccounts] = useState<Account[]>([{ name: "Conta corrente", kind: "checking", initial_balance: "" }]);
  const [cards, setCards] = useState<Card_[]>([]);
  const [fixed, setFixed] = useState<Fixed[]>([]);
  const [debts, setDebts] = useState<Debt[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);

  const finish = async () => {
    setSaving(true);
    try {
      const { data: wsId, error } = await supabase.rpc("create_workspace", {
        _name: name.trim() || "Meu espaço",
        _income: num(income),
      });
      if (error) throw error;
      const ws = wsId as unknown as string;

      const rows = accounts.filter((a) => a.name.trim());
      if (rows.length) {
        const { error: e } = await supabase.from("financial_accounts").insert(
          rows.map((a) => ({
            workspace_id: ws,
            name: a.name.trim(),
            kind: a.kind as never,
            initial_balance: num(a.initial_balance),
          })),
        );
        if (e) throw e;
      }

      const cardRows = cards.filter((c) => c.name.trim());
      if (cardRows.length) {
        const { error: e } = await supabase.from("credit_cards").insert(
          cardRows.map((c) => ({
            workspace_id: ws,
            name: c.name.trim(),
            credit_limit: num(c.credit_limit),
            closing_day: Number(c.closing_day) || 1,
            due_day: Number(c.due_day) || 10,
          })),
        );
        if (e) throw e;
      }

      const fixedRows = fixed.filter((f) => f.description.trim());
      if (fixedRows.length) {
        const { error: e } = await supabase.from("recurring_transactions").insert(
          fixedRows.map((f) => ({
            workspace_id: ws,
            type: "expense" as never,
            description: f.description.trim(),
            amount: num(f.amount),
            frequency: "monthly",
            day_of_month: Number(f.day_of_month) || 5,
          })),
        );
        if (e) throw e;
      }

      const debtRows = debts.filter((d) => d.name.trim());
      if (debtRows.length) {
        const { error: e } = await supabase.from("debts").insert(
          debtRows.map((d) => ({
            workspace_id: ws,
            name: d.name.trim(),
            initial_amount: num(d.outstanding),
            outstanding: num(d.outstanding),
            installment_amount: num(d.installment_amount),
            installments_total: Number(d.installments_total) || 1,
            due_day: Number(d.due_day) || 10,
          })),
        );
        if (e) throw e;
      }

      const inviteRows = invites.filter((i) => i.email.trim());
      if (inviteRows.length) {
        const { data: me } = await supabase.auth.getUser();
        const { error: e } = await supabase.from("workspace_invites").insert(
          inviteRows.map((i) => ({
            workspace_id: ws,
            email: i.email.trim().toLowerCase(),
            role: i.role as never,
            hide_balances: i.hide_balances,
            invited_by: me.user!.id,
          })),
        );
        if (e) throw e;
      }

      const goalRows = goals.filter((g) => g.name.trim());
      if (goalRows.length) {
        const { error: e } = await supabase.from("financial_goals").insert(
          goalRows.map((g) => ({
            workspace_id: ws,
            name: g.name.trim(),
            target_amount: num(g.target_amount),
          })),
        );
        if (e) throw e;
      }

      await supabase.from("workspaces").update({ onboarding_done: true }).eq("id", ws);
      localStorage.setItem("ef.workspace", ws);
      await qc.invalidateQueries();
      toast.success("Espaço criado!");
      navigate({ to: "/dashboard", replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao criar o espaço.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-muted/30 px-4 py-10">
      <div className="mx-auto max-w-2xl">
        <div className="mb-6 flex flex-wrap gap-2">
          {steps.map((s, i) => (
            <span
              key={s}
              className={`rounded-full px-3 py-1 text-xs ${
                i === step
                  ? "bg-primary text-primary-foreground"
                  : i < step
                    ? "bg-primary/10 text-primary"
                    : "bg-background text-muted-foreground"
              }`}
            >
              {i + 1}. {s}
            </span>
          ))}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{steps[step]}</CardTitle>
            <CardDescription>
              {step === 0 && "Dê um nome ao espaço e informe a renda mensal esperada."}
              {step === 1 && "Cadastre contas bancárias, carteira ou dinheiro."}
              {step === 2 && "Cartões de crédito com limite, fechamento e vencimento."}
              {step === 3 && "Despesas fixas mensais (aluguel, energia, internet...)."}
              {step === 4 && "Dívidas e financiamentos em andamento."}
              {step === 5 && "Convide pessoas e defina as permissões."}
              {step === 6 && "Metas financeiras que você quer alcançar."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {step === 0 && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="ws">Nome do espaço</Label>
                  <Input id="ws" value={name} onChange={(e) => setName(e.target.value)} />
                  <div className="flex flex-wrap gap-2 pt-1">
                    {["Minha Vida Financeira", "Casa e Família", "Pequeno Negócio"].map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setName(p)}
                        className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground hover:bg-accent"
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="inc">Renda mensal esperada</Label>
                  <Input id="inc" type="number" step="0.01" value={income} onChange={(e) => setIncome(e.target.value)} />
                  {income && <p className="text-xs text-muted-foreground">{brl(num(income))}</p>}
                </div>
              </>
            )}

            {step === 1 &&
              accounts.map((a, i) => (
                <div key={i} className="grid gap-2 sm:grid-cols-3">
                  <Input
                    placeholder="Nome"
                    value={a.name}
                    onChange={(e) =>
                      setAccounts((p) => p.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))
                    }
                  />
                  <Select
                    value={a.kind}
                    onValueChange={(v) => setAccounts((p) => p.map((x, j) => (j === i ? { ...x, kind: v } : x)))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ACCOUNT_KINDS.map((k) => (
                        <SelectItem key={k.value} value={k.value}>
                          {k.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    placeholder="Saldo inicial"
                    type="number"
                    step="0.01"
                    value={a.initial_balance}
                    onChange={(e) =>
                      setAccounts((p) => p.map((x, j) => (j === i ? { ...x, initial_balance: e.target.value } : x)))
                    }
                  />
                </div>
              ))}
            {step === 1 && (
              <Button variant="outline" size="sm" onClick={() => setAccounts((p) => [...p, { name: "", kind: "checking", initial_balance: "" }])}>
                + Adicionar conta
              </Button>
            )}

            {step === 2 &&
              cards.map((c, i) => (
                <div key={i} className="grid gap-2 sm:grid-cols-4">
                  <Input placeholder="Cartão" value={c.name} onChange={(e) => setCards((p) => p.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
                  <Input placeholder="Limite" type="number" value={c.credit_limit} onChange={(e) => setCards((p) => p.map((x, j) => (j === i ? { ...x, credit_limit: e.target.value } : x)))} />
                  <Input placeholder="Fechamento" type="number" value={c.closing_day} onChange={(e) => setCards((p) => p.map((x, j) => (j === i ? { ...x, closing_day: e.target.value } : x)))} />
                  <Input placeholder="Vencimento" type="number" value={c.due_day} onChange={(e) => setCards((p) => p.map((x, j) => (j === i ? { ...x, due_day: e.target.value } : x)))} />
                </div>
              ))}
            {step === 2 && (
              <Button variant="outline" size="sm" onClick={() => setCards((p) => [...p, { name: "", credit_limit: "", closing_day: "1", due_day: "10" }])}>
                + Adicionar cartão
              </Button>
            )}

            {step === 3 &&
              fixed.map((f, i) => (
                <div key={i} className="grid gap-2 sm:grid-cols-3">
                  <Input placeholder="Descrição" value={f.description} onChange={(e) => setFixed((p) => p.map((x, j) => (j === i ? { ...x, description: e.target.value } : x)))} />
                  <Input placeholder="Valor" type="number" step="0.01" value={f.amount} onChange={(e) => setFixed((p) => p.map((x, j) => (j === i ? { ...x, amount: e.target.value } : x)))} />
                  <Input placeholder="Dia" type="number" value={f.day_of_month} onChange={(e) => setFixed((p) => p.map((x, j) => (j === i ? { ...x, day_of_month: e.target.value } : x)))} />
                </div>
              ))}
            {step === 3 && (
              <Button variant="outline" size="sm" onClick={() => setFixed((p) => [...p, { description: "", amount: "", day_of_month: "5" }])}>
                + Adicionar despesa fixa
              </Button>
            )}

            {step === 4 &&
              debts.map((d, i) => (
                <div key={i} className="grid gap-2 sm:grid-cols-5">
                  <Input placeholder="Dívida" value={d.name} onChange={(e) => setDebts((p) => p.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
                  <Input placeholder="Saldo" type="number" value={d.outstanding} onChange={(e) => setDebts((p) => p.map((x, j) => (j === i ? { ...x, outstanding: e.target.value } : x)))} />
                  <Input placeholder="Parcela" type="number" value={d.installment_amount} onChange={(e) => setDebts((p) => p.map((x, j) => (j === i ? { ...x, installment_amount: e.target.value } : x)))} />
                  <Input placeholder="Nº parcelas" type="number" value={d.installments_total} onChange={(e) => setDebts((p) => p.map((x, j) => (j === i ? { ...x, installments_total: e.target.value } : x)))} />
                  <Input placeholder="Dia venc." type="number" value={d.due_day} onChange={(e) => setDebts((p) => p.map((x, j) => (j === i ? { ...x, due_day: e.target.value } : x)))} />
                </div>
              ))}
            {step === 4 && (
              <Button variant="outline" size="sm" onClick={() => setDebts((p) => [...p, { name: "", outstanding: "", installment_amount: "", installments_total: "12", due_day: "10" }])}>
                + Adicionar dívida
              </Button>
            )}

            {step === 5 &&
              invites.map((iv, i) => (
                <div key={i} className="grid gap-2 sm:grid-cols-3">
                  <Input placeholder="E-mail" type="email" value={iv.email} onChange={(e) => setInvites((p) => p.map((x, j) => (j === i ? { ...x, email: e.target.value } : x)))} />
                  <Select value={iv.role} onValueChange={(v) => setInvites((p) => p.map((x, j) => (j === i ? { ...x, role: v } : x)))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ROLES.filter((r) => r.value !== "owner").map((r) => (
                        <SelectItem key={r.value} value={r.value}>
                          {r.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <label className="flex items-center gap-2 text-sm text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={iv.hide_balances}
                      onChange={(e) => setInvites((p) => p.map((x, j) => (j === i ? { ...x, hide_balances: e.target.checked } : x)))}
                    />
                    Ocultar saldos
                  </label>
                </div>
              ))}
            {step === 5 && (
              <Button variant="outline" size="sm" onClick={() => setInvites((p) => [...p, { email: "", role: "editor", hide_balances: false }])}>
                + Convidar pessoa
              </Button>
            )}

            {step === 6 &&
              goals.map((g, i) => (
                <div key={i} className="grid gap-2 sm:grid-cols-2">
                  <Input placeholder="Meta" value={g.name} onChange={(e) => setGoals((p) => p.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
                  <Input placeholder="Valor alvo" type="number" value={g.target_amount} onChange={(e) => setGoals((p) => p.map((x, j) => (j === i ? { ...x, target_amount: e.target.value } : x)))} />
                </div>
              ))}
            {step === 6 && (
              <Button variant="outline" size="sm" onClick={() => setGoals((p) => [...p, { name: "", target_amount: "" }])}>
                + Adicionar meta
              </Button>
            )}

            <div className="flex justify-between pt-4">
              <Button variant="ghost" disabled={step === 0} onClick={() => setStep((s) => s - 1)}>
                Voltar
              </Button>
              {step < steps.length - 1 ? (
                <Button onClick={() => setStep((s) => s + 1)}>Continuar</Button>
              ) : (
                <Button onClick={finish} disabled={saving}>
                  {saving ? "Criando..." : "Concluir"}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
