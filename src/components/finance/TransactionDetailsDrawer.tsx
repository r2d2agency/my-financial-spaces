import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { brl, isIncomeType, TX_TYPES } from "@/lib/finance";
import { Calendar, CreditCard, User, Tag, Clock, Wallet, FileText, Trash2, Edit } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export const TransactionDetailsDrawer = ({ tx, open, onOpenChange, onSettle, onRevert, onEdit, onDelete }: any) => {
  if (!tx) return null;

  const isIncome = isIncomeType(tx.type);
  const isPaid = tx.status === "paid";
  const typeLabel = TX_TYPES.find(t => t.value === tx.type)?.label;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-md flex flex-col h-full">
        <SheetHeader className="pb-6 border-b">
          <div className="flex items-center justify-between mt-4">
            <SheetTitle className="text-xl font-bold">{tx.description}</SheetTitle>
            <Badge variant={isPaid ? "secondary" : "outline"} className={!isPaid && new Date(tx.competence_date) < new Date() ? "border-destructive text-destructive" : ""}>
              {isPaid ? (isIncome ? "Recebido" : "Pago") : (isIncome ? "A receber" : "Pendente")}
            </Badge>
          </div>
          <div className={`text-2xl font-bold pt-2 ${isIncome ? "text-primary" : "text-foreground"}`}>
            {isIncome ? "+" : "-"} {brl(Math.abs(tx.amount))}
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto py-6 space-y-6">
          <div className="grid grid-cols-2 gap-y-6">
            <DetailItem icon={<Calendar className="size-4" />} label="Vencimento" value={new Date(tx.competence_date).toLocaleDateString("pt-BR")} />
            {isPaid && <DetailItem icon={<Clock className="size-4" />} label="Liquidação" value={tx.paid_date ? new Date(tx.paid_date).toLocaleDateString("pt-BR") : "Sim"} />}
            <DetailItem icon={<Tag className="size-4" />} label="Categoria" value={tx.category_name || "—"} />
            <DetailItem icon={<Wallet className="size-4" />} label="Conta" value={tx.account_name || "—"} />
            <DetailItem icon={<User className="size-4" />} label={isIncome ? "Cliente" : "Fornecedor"} value={tx.person_name || "—"} />
            <DetailItem icon={<FileText className="size-4" />} label="Tipo" value={typeLabel || "—"} />
          </div>

          {(tx.recurring_id || tx.installment_number) && (
             <div className="p-3 bg-muted/50 rounded-lg flex items-center gap-2 text-sm">
               {tx.recurring_id && <Badge variant="outline" className="text-[10px] uppercase font-bold">Recorrente</Badge>}
               {tx.installment_number && <Badge variant="outline" className="text-[10px] uppercase font-bold">{tx.installment_number}/{tx.total_installments}</Badge>}
             </div>
          )}

          {tx.notes && (
            <div className="space-y-2">
              <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Observação</span>
              <p className="text-sm text-foreground bg-muted/30 p-3 rounded-md">{tx.notes}</p>
            </div>
          )}
        </div>

        <SheetFooter className="pt-6 border-t flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center">
          <div className="flex items-center gap-2">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" size="icon" onClick={onEdit} className="h-10 w-10" aria-label="Editar lançamento">
                    <Edit className="size-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Editar lançamento</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" size="icon" onClick={onDelete} className="h-10 w-10 text-destructive hover:text-destructive" aria-label="Excluir lançamento">
                    <Trash2 className="size-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Excluir lançamento</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>

          
          {!isPaid ? (
            <Button className="w-full sm:w-auto px-8" onClick={onSettle}>
              Marcar como {isIncome ? "recebido" : "pago"}
            </Button>
          ) : (
            <Button variant="outline" className="w-full sm:w-auto" onClick={onRevert}>
              Desfazer {isIncome ? "recebimento" : "pagamento"}
            </Button>
          )}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
};

const DetailItem = ({ icon, label, value }: any) => (
  <div className="space-y-1">
    <div className="flex items-center gap-2 text-muted-foreground">
      {icon}
      <span className="text-[10px] uppercase tracking-wider font-semibold">{label}</span>
    </div>
    <div className="text-sm font-medium">{value}</div>
  </div>
);
