import { brl, num } from "@/lib/finance";

export const TransactionSummary = ({ realizado, entradas, saidas, aReceber, aPagar, hideBalances }: any) => {
  const cards = [
    { label: "Resultado", value: realizado, color: "text-foreground" },
    { label: "Entradas", value: entradas, color: "text-primary" },
    { label: "Saídas", value: saidas, color: "text-destructive" },
    { label: "A Receber", value: aReceber, color: "text-emerald-600" },
    { label: "A Pagar", value: aPagar, color: "text-amber-600" },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-4 py-4 px-6 bg-muted/20 border-b border-border">
      {cards.map((c, i) => (
        <div key={i} className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground uppercase tracking-wider">{c.label}</span>
          <span className={`text-lg font-semibold ${c.color}`}>{hideBalances ? "•••" : brl(c.value)}</span>
        </div>
      ))}
    </div>
  );
};
