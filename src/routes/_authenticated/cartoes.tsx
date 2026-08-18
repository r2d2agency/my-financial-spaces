import { createFileRoute } from "@tanstack/react-router";
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { CreditCard, Calendar, ChevronRight, History, CreditCardIcon, Landmark, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export const Route = createFileRoute("/_authenticated/cartoes")({
  component: Cartoes,
  head: () => ({
    meta: [
      { title: "Cartões de Crédito · Espaço Financeiro" },
      { name: "description", content: "Gestão completa de cartões, limites e faturas." },
    ],
  }),
});

function Cartoes() {
  const { wsId, canEdit, hideBalances } = useWorkspace();
  const qc = useQueryClient();
  const [openAdd, setOpenAdd] = useState(false);
  const [openPay, setOpenPay] = useState(false);
  const [selectedCard, setSelectedCard] = useState<any>(null);
  const [payForm, setPayForm] = useState({ account_id: "", date: new Date().toISOString().slice(0, 10), amount: 0 });
  
  const [f, setF] = useState({ 
    name: "", 
    institution: "", 
    last_digits: "", 
    brand: "", 
    credit_limit: "", 
    closing_day: "5", 
    due_day: "15",
    default_payment_account_id: ""
  });

  const { data: cards, isLoading: loadingCards } = useQuery({
    queryKey: ["cards", wsId],
    enabled: !!wsId,
    queryFn: async () => {
      const res = await db.from("credit_cards").select("*").eq("workspace_id", wsId!).eq("archived", false).order("name");
      const cardsList = (res.data as any[]) || [];
      
      // Para cada cartão, buscar transações pendentes para calcular o limite utilizado
      const enrichedCards = await Promise.all(cardsList.map(async (card) => {
        const txs = await db.from("transactions")
          .select("amount")
          .eq("card_id", card.id)
          .eq("status", "pending")
          .execute();
        
        const used = (txs.data as any[])?.reduce((sum, t) => sum + Math.abs(num(t.amount)), 0) || 0;
        return { ...card, used_amount: used };
      }));
      
      return enrichedCards;
    },
  });

  const { data: meta } = useQuery({
    queryKey: ["meta", wsId],
    enabled: !!wsId,
    queryFn: async () => {
      const accs = await db.from("financial_accounts").select("id, name").eq("workspace_id", wsId!);
      return { accounts: (accs.data as any[]) || [] };
    }
  });

  const create = useMutation({
    mutationFn: async () => {
      const { error } = await db.from("credit_cards").insert({
        workspace_id: wsId!,
        name: f.name.trim(),
        institution: f.institution.trim() || null,
        last_digits: f.last_digits.trim() || null,
        brand: f.brand.trim() || null,
        credit_limit: num(f.credit_limit),
        closing_day: Number(f.closing_day) || 5,
        due_day: Number(f.due_day) || 15,
        default_payment_account_id: f.default_payment_account_id || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Cartão cadastrado com sucesso.");
      setOpenAdd(false);
      qc.invalidateQueries({ queryKey: ["cards"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const payBill = useMutation({
    mutationFn: async () => {
      const res = await db.rpc("pay_credit_card_invoice", {
        invoice_id: selectedCard.current_invoice.id, // Simplificado para teste
        account_id: payForm.account_id,
        payment_date: payForm.date,
        amount: payForm.amount,
        workspace_id: wsId!
      });
      if (res.error) throw res.error;
    },
    onSuccess: () => {
      toast.success("Fatura paga com sucesso.");
      setOpenPay(false);
      qc.invalidateQueries();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const money = (v: number) => (hideBalances ? "R$ •••" : brl(v));

  if (loadingCards) return <div className="flex h-64 items-center justify-center"><Loader2 className="animate-spin text-primary" /></div>;

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Meus Cartões</h1>
          <p className="text-muted-foreground">Gerencie seus limites, faturas e vencimentos em um só lugar.</p>
        </div>
        <div className="flex gap-2">
          {canEdit && (
            <Button onClick={() => setOpenAdd(true)}>
              <CreditCard className="mr-2 h-4 w-4" />
              Novo Cartão
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {cards?.length === 0 && (
          <div className="col-span-full py-12 text-center border-2 border-dashed rounded-xl">
            <CreditCardIcon className="mx-auto h-12 w-12 text-muted-foreground opacity-20" />
            <h3 className="mt-4 text-lg font-medium">Nenhum cartão encontrado</h3>
            <p className="mt-1 text-sm text-muted-foreground">Comece adicionando seu primeiro cartão de crédito.</p>
            <Button variant="outline" className="mt-4" onClick={() => setOpenAdd(true)}>Cadastrar Agora</Button>
          </div>
        )}

        {cards?.map((card) => {
          const used = 0; // Mock temporário
          const limit = num(card.credit_limit);
          const pct = limit > 0 ? (used / limit) * 100 : 0;
          
          return (
            <Card key={card.id} className="group hover:shadow-lg transition-all duration-300 border-primary/10 overflow-hidden">
              <div className="h-1.5 bg-primary/20 w-full">
                <div className="h-full bg-primary" style={{ width: `${Math.min(100, pct)}%` }} />
              </div>
              <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                <div>
                  <CardTitle className="text-xl font-bold">{card.name}</CardTitle>
                  <p className="text-xs text-muted-foreground mt-0.5">{card.institution} • •••• {card.last_digits || '0000'}</p>
                </div>
                <div className="p-2 bg-primary/5 rounded-lg">
                  <CreditCard className="h-5 w-5 text-primary" />
                </div>
              </CardHeader>
              <CardContent className="space-y-6 pt-4">
                <div className="space-y-1">
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Fatura Atual</span>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-bold">{money(used)}</span>
                    <span className="text-xs text-muted-foreground">de {money(limit)}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] text-muted-foreground uppercase font-bold">Fechamento</span>
                    <div className="flex items-center gap-1.5 text-sm font-semibold">
                      <Calendar className="h-3.5 w-3.5 text-primary" />
                      Dia {card.closing_day}
                    </div>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] text-muted-foreground uppercase font-bold">Vencimento</span>
                    <div className="flex items-center gap-1.5 text-sm font-semibold">
                      <div className="h-3.5 w-3.5 rounded-full border-2 border-primary" />
                      Dia {card.due_day}
                    </div>
                  </div>
                </div>

                <div className="flex gap-2 pt-2">
                  <Button variant="outline" size="sm" className="flex-1 text-xs" onClick={() => toast.info("Detalhes em breve")}>
                    Ver Fatura
                  </Button>
                  <Button size="sm" className="flex-1 text-xs" onClick={() => toast.info("Pagamento em breve")}>
                    Pagar
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Dialog open={openAdd} onOpenChange={setOpenAdd}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle>Novo Cartão de Crédito</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nome do Cartão</Label>
                <Input placeholder="Ex: Nubank Black" value={f.name} onChange={e => setF(p => ({ ...p, name: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Instituição</Label>
                <Input placeholder="Ex: Nubank" value={f.institution} onChange={e => setF(p => ({ ...p, institution: e.target.value }))} />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Bandeira</Label>
                <Input placeholder="Ex: Mastercard" value={f.brand} onChange={e => setF(p => ({ ...p, brand: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Últimos 4 dígitos</Label>
                <Input placeholder="1234" maxLength={4} value={f.last_digits} onChange={e => setF(p => ({ ...p, last_digits: e.target.value }))} />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Limite de Crédito</Label>
              <Input type="number" placeholder="R$ 0,00" value={f.credit_limit} onChange={e => setF(p => ({ ...p, credit_limit: e.target.value }))} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Dia Fechamento</Label>
                <Input type="number" min="1" max="31" value={f.closing_day} onChange={e => setF(p => ({ ...p, closing_day: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Dia Vencimento</Label>
                <Input type="number" min="1" max="31" value={f.due_day} onChange={e => setF(p => ({ ...p, due_day: e.target.value }))} />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Conta Padrão para Pagamento</Label>
              <select 
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                value={f.default_payment_account_id}
                onChange={e => setF(p => ({ ...p, default_payment_account_id: e.target.value }))}
              >
                <option value="">Selecione...</option>
                {meta?.accounts.map((a: any) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenAdd(false)}>Cancelar</Button>
            <Button disabled={!f.name || create.isPending} onClick={() => create.mutate()}>
              {create.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Cadastrar Cartão
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
