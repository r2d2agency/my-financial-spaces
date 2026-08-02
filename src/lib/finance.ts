export const brl = (n: number | null | undefined) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(n ?? 0));

export const num = (v: unknown) => Number(v ?? 0);

export const monthLabel = (d: Date) =>
  d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

export const iso = (d: Date) => d.toISOString().slice(0, 10);

export const monthRange = (ref: Date) => {
  const start = new Date(ref.getFullYear(), ref.getMonth(), 1);
  const end = new Date(ref.getFullYear(), ref.getMonth() + 1, 0);
  return { start: iso(start), end: iso(end), startDate: start, endDate: end };
};

export const addMonths = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth() + n, 1);

export const TX_TYPES = [
  { value: "income", label: "Receita" },
  { value: "expense", label: "Despesa" },
  { value: "transfer", label: "Transferência" },
  { value: "refund", label: "Reembolso" },
  { value: "debt_payment", label: "Pagamento de dívida" },
  { value: "card_payment", label: "Pagamento de cartão" },
  { value: "adjustment", label: "Ajuste de saldo" },
] as const;

export const ACCOUNT_KINDS = [
  { value: "checking", label: "Conta corrente" },
  { value: "savings", label: "Poupança" },
  { value: "wallet", label: "Carteira digital" },
  { value: "cash", label: "Dinheiro" },
  { value: "investment", label: "Investimento" },
] as const;

export const ROLES = [
  { value: "owner", label: "Proprietário", desc: "Controle completo, assinatura e propriedade" },
  { value: "admin", label: "Administrador", desc: "Cadastros, lançamentos, dívidas, metas e convites" },
  { value: "editor", label: "Editor", desc: "Lança e edita movimentações e comprovantes" },
  { value: "viewer", label: "Visualizador", desc: "Apenas consulta dashboards e relatórios" },
  { value: "consultant", label: "Consultor / contador", desc: "Consulta e exporta relatórios" },
] as const;

export type Role = (typeof ROLES)[number]["value"];

export const isIncomeType = (t: string) => t === "income" || t === "refund";
export const isExpenseType = (t: string) =>
  t === "expense" || t === "debt_payment" || t === "card_payment";

/** Extra-payment payoff simulation for a debt. */
export function simulatePayoff(
  outstanding: number,
  installment: number,
  monthlyRate: number,
  extra: number,
) {
  const run = (payment: number) => {
    let balance = outstanding;
    let months = 0;
    let interest = 0;
    while (balance > 0.01 && months < 600 && payment > 0) {
      const i = balance * (monthlyRate / 100);
      interest += i;
      balance = balance + i - payment;
      months++;
    }
    return { months, interest };
  };
  const base = run(installment);
  const boosted = run(installment + extra);
  return {
    baseMonths: base.months,
    boostedMonths: boosted.months,
    monthsSaved: Math.max(0, base.months - boosted.months),
    interestSaved: Math.max(0, base.interest - boosted.interest),
  };
}