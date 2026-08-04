import { createFileRoute, useNavigate, redirect } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { getCurrentUser } from "@/lib/auth-client.functions";
import { useServerFn } from "@tanstack/react-start";
import { db } from "@/lib/db-browser";
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
    const user = await getCurrentUser();
    if (!user) throw redirect({ to: "/auth", replace: true });
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
  const getUser = useServerFn(getCurrentUser);

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
      const { data: wsId, error } = await db.rpc("create_workspace", {
        _name: (name || "Meu espaço").trim(),
        _income: parseFloat(String(income || 0)) || 0,
        _user_id: (await getUser({}))?.id,
      });
      if (error) throw error;
      const ws = wsId as unknown as string;

      const rows = accounts.filter((a) => a.name.trim());
      if (rows.length) {
        const { error: e } = await db.from("financial_accounts").insert(
          rows.map((a) => ({
            workspace_id: ws,
            name: a.name.trim(),
            kind: a.kind as never,
            initial_balance: num(a.initial_balance),
          }))
        );
        if (e) throw e;
      }

      const cardRows = cards.filter((c) => c.name.trim());
      if (cardRows.length) {
        const { error: e } = await db.from("credit_cards").insert(
          cardRows.map((c) => ({
            workspace_id: ws,
            name: c.name.trim(),
            credit_limit: num(c.credit_limit),
            closing_day: Number(c.closing_day) || 1,
            due_day: Number(c.due_day) || 10,
          }))
        );
        if (e) throw e;
      }

      const fixedRows = fixed.filter((f) => f.description.trim());
      if (fixedRows.length) {
        const { error: e } = await db.from("recurring_transactions").insert(
          fixedRows.map((f) => ({
            workspace_id: ws,
            type: "expense" as never,
            description: f.description.trim(),
            amount: num(f.amount),
            frequency: "monthly",
            day_of_month: Number(f.day_of_month) || 5,
          }))
        );
        if (e) throw e;
      }

      const debtRows = debts.filter((d) => d.name.trim());
      if (debtRows.length) {
        const { error: e } = await db.from("debts").insert(
          debtRows.map((d) => ({
            workspace_id: ws,
            name: d.name.trim(),
            initial_amount: num(d.outstanding),
            outstanding: num(d.outstanding),
            installment_amount: num(d.installment_amount),
            installments_total: Number(d.installments_total) || 1,
            due_day: Number(d.due_day) || 10,
          }))
        );
        if (e) throw e;
      }

      const inviteRows = invites.filter((i) => i.email.trim());
      if (inviteRows.length) {
        const me = await getUser({});
        const { error: e } = await db.from("workspace_invites").insert(
          inviteRows.map((i) => ({
            workspace_id: ws,
            email: i.email.trim().toLowerCase(),
            role: i.role as never,
            hide_balances: i.hide_balances,
            invited_by: me?.id,
          }))
        );
        if (e) throw e;
      }

      const goalRows = goals.filter((g) => g.name.trim());
      if (goalRows.length) {
        const { error: e } = await db.from("financial_goals").insert(
          goalRows.map((g) => ({
            workspace_id: ws,
            name: g.name.trim(),
            target_amount: num(g.target_amount),
          }))
        );
        if (e) throw e;
      }

      await db.from("workspaces").update({ onboarding_done: true }).eq("id", ws).execute();
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
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap gap-2">
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
          <Button 
            variant="ghost" 
            size="sm" 
            className="text-muted-foreground hover:text-primary"
            onClick={() => {
              setName("Meu Espaço");
              setIncome("0");
              finish();
            }}
            disabled={saving}
          >
            Pular configuração (Criar vazio)
          </Button>
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

            {step === 1 && (
              <div className="space-y-4">
                <div className="hidden grid-cols-3 gap-2 px-1 text-xs font-medium text-muted-foreground sm:grid">
                  <span>Nome da Conta</span>
                  <span>Tipo de Conta</span>
                  <span>Saldo Atual</span>
                </div>
                {accounts.map((a, i) => (
                  <div key={i} className="grid gap-2 sm:grid-cols-3">
                    <div className="space-y-1 sm:space-y-0">
                      <Label className="text-[10px] uppercase sm:hidden">Nome da Conta</Label>
                      <Input
                        placeholder="Ex: Nubank, Carteira..."
                        value={a.name}
                        onChange={(e) =>
                          setAccounts((p) => p.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))
                        }
                      />
                    </div>
                    <div className="space-y-1 sm:space-y-0">
                      <Label className="text-[10px] uppercase sm:hidden">Tipo</Label>
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
                    </div>
                    <div className="space-y-1 sm:space-y-0">
                      <Label className="text-[10px] uppercase sm:hidden">Saldo Inicial</Label>
                      <Input
                        placeholder="0,00"
                        type="number"
                        step="0.01"
                        value={a.initial_balance}
                        onChange={(e) =>
                          setAccounts((p) => p.map((x, j) => (j === i ? { ...x, initial_balance: e.target.value } : x)))
                        }
                      />
                    </div>
                  </div>
                ))}
                <Button variant="outline" size="sm" onClick={() => setAccounts((p) => [...p, { name: "", kind: "checking", initial_balance: "" }])}>
                  + Adicionar conta
                </Button>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-4">
                <div className="hidden grid-cols-4 gap-2 px-1 text-xs font-medium text-muted-foreground sm:grid">
                  <span>Nome do Cartão</span>
                  <span>Limite (R$)</span>
                  <span>Fechamento (Dia)</span>
                  <span>Vencimento (Dia)</span>
                </div>
                {cards.map((c, i) => (
                  <div key={i} className="grid gap-2 sm:grid-cols-4">
                    <div className="space-y-1 sm:space-y-0">
                      <Label className="text-[10px] uppercase sm:hidden">Nome</Label>
                      <Input placeholder="Ex: Visa Gold" value={c.name} onChange={(e) => setCards((p) => p.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
                    </div>
                    <div className="space-y-1 sm:space-y-0">
                      <Label className="text-[10px] uppercase sm:hidden">Limite</Label>
                      <Input placeholder="0,00" type="number" value={c.credit_limit} onChange={(e) => setCards((p) => p.map((x, j) => (j === i ? { ...x, credit_limit: e.target.value } : x)))} />
                    </div>
                    <div className="space-y-1 sm:space-y-0">
                      <Label className="text-[10px] uppercase sm:hidden">Dia Fechamento</Label>
                      <Input placeholder="1 a 31" type="number" min="1" max="31" value={c.closing_day} onChange={(e) => setCards((p) => p.map((x, j) => (j === i ? { ...x, closing_day: e.target.value } : x)))} />
                    </div>
                    <div className="space-y-1 sm:space-y-0">
                      <Label className="text-[10px] uppercase sm:hidden">Dia Vencimento</Label>
                      <Input placeholder="1 a 31" type="number" min="1" max="31" value={c.due_day} onChange={(e) => setCards((p) => p.map((x, j) => (j === i ? { ...x, due_day: e.target.value } : x)))} />
                    </div>
                  </div>
                ))}
                <Button variant="outline" size="sm" onClick={() => setCards((p) => [...p, { name: "", credit_limit: "", closing_day: "1", due_day: "10" }])}>
                  + Adicionar cartão
                </Button>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-4">
                <div className="hidden grid-cols-3 gap-2 px-1 text-xs font-medium text-muted-foreground sm:grid">
                  <span>Descrição (Ex: Aluguel)</span>
                  <span>Valor (R$)</span>
                  <span>Dia do Vencimento</span>
                </div>
                {fixed.map((f, i) => (
                  <div key={i} className="grid gap-2 sm:grid-cols-3">
                    <div className="space-y-1 sm:space-y-0">
                      <Label className="text-[10px] uppercase sm:hidden">Descrição</Label>
                      <Input placeholder="Ex: Internet, Luz..." value={f.description} onChange={(e) => setFixed((p) => p.map((x, j) => (j === i ? { ...x, description: e.target.value } : x)))} />
                    </div>
                    <div className="space-y-1 sm:space-y-0">
                      <Label className="text-[10px] uppercase sm:hidden">Valor</Label>
                      <Input placeholder="0,00" type="number" step="0.01" value={f.amount} onChange={(e) => setFixed((p) => p.map((x, j) => (j === i ? { ...x, amount: e.target.value } : x)))} />
                    </div>
                    <div className="space-y-1 sm:space-y-0">
                      <Label className="text-[10px] uppercase sm:hidden">Dia Vencimento</Label>
                      <Input placeholder="1 a 31" type="number" value={f.day_of_month} onChange={(e) => setFixed((p) => p.map((x, j) => (j === i ? { ...x, day_of_month: e.target.value } : x)))} />
                    </div>
                  </div>
                ))}
                <Button variant="outline" size="sm" onClick={() => setFixed((p) => [...p, { description: "", amount: "", day_of_month: "5" }])}>
                  + Adicionar despesa fixa
                </Button>
              </div>
            )}

            {step === 4 && (
              <div className="space-y-4">
                <div className="hidden grid-cols-5 gap-2 px-1 text-xs font-medium text-muted-foreground sm:grid">
                  <span>Nome/Dívida</span>
                  <span>Saldo Devedor</span>
                  <span>Valor Parcela</span>
                  <span>Total Parcelas</span>
                  <span>Vencimento</span>
                </div>
                {debts.map((d, i) => (
                  <div key={i} className="grid gap-2 sm:grid-cols-5">
                    <div className="space-y-1 sm:space-y-0">
                      <Label className="text-[10px] uppercase sm:hidden">Dívida</Label>
                      <Input placeholder="Ex: Financiamento" value={d.name} onChange={(e) => setDebts((p) => p.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
                    </div>
                    <div className="space-y-1 sm:space-y-0">
                      <Label className="text-[10px] uppercase sm:hidden">Saldo Total</Label>
                      <Input placeholder="0,00" type="number" value={d.outstanding} onChange={(e) => setDebts((p) => p.map((x, j) => (j === i ? { ...x, outstanding: e.target.value } : x)))} />
                    </div>
                    <div className="space-y-1 sm:space-y-0">
                      <Label className="text-[10px] uppercase sm:hidden">Parcela</Label>
                      <Input placeholder="0,00" type="number" value={d.installment_amount} onChange={(e) => setDebts((p) => p.map((x, j) => (j === i ? { ...x, installment_amount: e.target.value } : x)))} />
                    </div>
                    <div className="space-y-1 sm:space-y-0">
                      <Label className="text-[10px] uppercase sm:hidden">Nº Parc.</Label>
                      <Input placeholder="Ex: 12" type="number" value={d.installments_total} onChange={(e) => setDebts((p) => p.map((x, j) => (j === i ? { ...x, installments_total: e.target.value } : x)))} />
                    </div>
                    <div className="space-y-1 sm:space-y-0">
                      <Label className="text-[10px] uppercase sm:hidden">Dia</Label>
                      <Input placeholder="1-31" type="number" value={d.due_day} onChange={(e) => setDebts((p) => p.map((x, j) => (j === i ? { ...x, due_day: e.target.value } : x)))} />
                    </div>
                  </div>
                ))}
                <Button variant="outline" size="sm" onClick={() => setDebts((p) => [...p, { name: "", outstanding: "", installment_amount: "", installments_total: "12", due_day: "10" }])}>
                  + Adicionar dívida
                </Button>
              </div>
            )}

            {step === 5 && (
              <div className="space-y-4">
                <div className="hidden grid-cols-3 gap-2 px-1 text-xs font-medium text-muted-foreground sm:grid">
                  <span>E-mail do convidado</span>
                  <span>Perfil / Permissão</span>
                  <span>Privacidade</span>
                </div>
                {invites.map((iv, i) => (
                  <div key={i} className="grid gap-2 sm:grid-cols-3">
                    <div className="space-y-1 sm:space-y-0">
                      <Label className="text-[10px] uppercase sm:hidden">E-mail</Label>
                      <Input placeholder="Ex: contato@email.com" type="email" value={iv.email} onChange={(e) => setInvites((p) => p.map((x, j) => (j === i ? { ...x, email: e.target.value } : x)))} />
                    </div>
                    <div className="space-y-1 sm:space-y-0">
                      <Label className="text-[10px] uppercase sm:hidden">Permissão</Label>
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
                    </div>
                    <div className="flex items-center gap-2 pt-1 sm:pt-0">
                      <input
                        type="checkbox"
                        id={`hide-${i}`}
                        checked={iv.hide_balances}
                        onChange={(e) => setInvites((p) => p.map((x, j) => (j === i ? { ...x, hide_balances: e.target.checked } : x)))}
                        className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                      />
                      <Label htmlFor={`hide-${i}`} className="cursor-pointer text-xs text-muted-foreground">
                        Ocultar saldos financeiros
                      </Label>
                    </div>
                  </div>
                ))}
                <Button variant="outline" size="sm" onClick={() => setInvites((p) => [...p, { email: "", role: "editor", hide_balances: false }])}>
                  + Convidar pessoa
                </Button>
              </div>
            )}

            {step === 6 && (
              <div className="space-y-4">
                <div className="hidden grid-cols-2 gap-2 px-1 text-xs font-medium text-muted-foreground sm:grid">
                  <span>Nome da Meta (Ex: Viagem)</span>
                  <span>Valor Alvo (R$)</span>
                </div>
                {goals.map((g, i) => (
                  <div key={i} className="grid gap-2 sm:grid-cols-2">
                    <div className="space-y-1 sm:space-y-0">
                      <Label className="text-[10px] uppercase sm:hidden">Nome da Meta</Label>
                      <Input placeholder="Ex: Reserva de Emergência" value={g.name} onChange={(e) => setGoals((p) => p.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
                    </div>
                    <div className="space-y-1 sm:space-y-0">
                      <Label className="text-[10px] uppercase sm:hidden">Valor Objetivo</Label>
                      <Input placeholder="0,00" type="number" value={g.target_amount} onChange={(e) => setGoals((p) => p.map((x, j) => (j === i ? { ...x, target_amount: e.target.value } : x)))} />
                    </div>
                  </div>
                ))}
                <Button variant="outline" size="sm" onClick={() => setGoals((p) => [...p, { name: "", target_amount: "" }])}>
                  + Adicionar meta
                </Button>
              </div>
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
