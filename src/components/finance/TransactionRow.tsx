import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MoreHorizontal } from "lucide-react";
import { brl, isIncomeType } from "@/lib/finance";

export const TransactionRow = ({ tx, onClick, onSettle }: any) => {
  const isIncome = isIncomeType(tx.type);
  
  return (
    <div className="flex items-center justify-between py-3 px-4 hover:bg-muted/30 border-b border-border/50 transition-colors group cursor-pointer" onClick={onClick}>
      <div className="flex flex-col min-w-0 flex-1">
        <p className="text-sm font-medium truncate">{tx.description}</p>
        <p className="text-xs text-muted-foreground">
          {new Date(tx.competence_date).toLocaleDateString("pt-BR")} · {tx.category_name || "Sem categoria"}
        </p>
      </div>
      <div className="flex items-center gap-4">
        <Badge variant={tx.status === "paid" ? "secondary" : "outline"} className="hidden md:flex">
          {tx.status === "paid" ? "Realizado" : "Pendente"}
        </Badge>
        <span className={`text-sm font-semibold w-24 text-right ${isIncome ? "text-primary" : "text-foreground"}`}>
          {isIncome ? "+" : "-"} {brl(Math.abs(tx.amount))}
        </span>
        <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100 transition-opacity">
          <MoreHorizontal className="size-4" />
        </Button>
      </div>
    </div>
  );
};
