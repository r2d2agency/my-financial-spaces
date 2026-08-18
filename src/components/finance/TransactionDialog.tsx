import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { db } from "@/lib/db-browser";
import { useWorkspace } from "@/lib/workspace";
import { TX_TYPES, iso, num } from "@/lib/finance";
import { getCurrentUser } from "@/lib/auth-client.functions";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter 
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface TransactionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tx?: any; // Se presente, modo edição
}

export function TransactionDialog({ open, onOpenChange, tx }: TransactionDialogProps) {
  const { wsId } = useWorkspace();
  const qc = useQueryClient();
  const getUser = useServerFn(getCurrentUser);
  const isEdit = !!tx;

  const [form, setForm] = useState({
    type: "expense",
    description: "",
    amount: "",
    competence_date: iso(new Date()),
    status: "pending",
    account_id: "",
    category_id: "",
    person_name: "",
    notes: "",
  });

  // Reset/Load form
  useEffect(() => {
    if (tx && open) {
      setForm({
        type: tx.type || "expense",
        description: tx.description || "",
        amount: String(Math.abs(tx.amount || 0)),
        competence_date: tx.competence_date ? iso(new Date(tx.competence_date)) : iso(new Date()),
        status: tx.status || "pending",
        account_id: tx.account_id || "",
        category_id: tx.category_id || "",
        person_name: tx.person_name || "",
        notes: tx.notes || "",
      });
    } else if (open) {
      setForm({
        type: "expense",
        description: "",
        amount: "",
        competence_date: iso(new Date()),
        status: "pending",
        account_id: "",
        category_id: "",
        person_name: "",
        notes: "",
      });
    }
  }, [tx, open]);

  // Queries para selects
  const { data: meta } = useQuery({
    queryKey: ["meta", wsId],
    enabled: !!wsId && open,
    queryFn: async () => {
      const [accs, cats] = await Promise.all([
        db.from("financial_accounts").select("id, name").eq("workspace_id", wsId!).execute(),
        db.from("categories").select("id, name").eq("workspace_id", wsId!).execute(),
      ]);
      return {
        accounts: (accs.data as any[]) || [],
        categories: (cats.data as any[]) || [],
      };
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      const me = await getUser({});
      const amount = form.type === "income" ? Math.abs(num(form.amount)) : -Math.abs(num(form.amount));
      
      const data = {
        workspace_id: wsId!,
        type: form.type as any,
        description: form.description.trim(),
        amount,
        status: form.status as any,
        competence_date: form.competence_date,
        paid_date: form.status === "paid" ? form.competence_date : null,
        account_id: form.account_id || null,
        category_id: form.category_id || null,
        person_name: form.person_name.trim() || null,
        notes: form.notes.trim() || null,
        updated_by: me?.id,
      };

      if (isEdit) {
        const { error } = await db.from("transactions").update(data).eq("id", tx.id).eq("workspace_id", wsId!).execute();
        if (error) throw error;
      } else {
        const { error } = await db.from("transactions").insert({ ...data, created_by: me?.id }).execute();
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(isEdit ? "Alterações salvas." : "Lançamento criado.");
      qc.invalidateQueries({ queryKey: ["transactions"] });
      onOpenChange(false);
    },
    onError: (e: Error) => {
      console.error("Erro ao salvar transação:", e);
      toast.error("Não foi possível salvar as alterações. Tente novamente.");
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar lançamento" : "Novo lançamento"}</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select value={form.type} onValueChange={(v) => setForm(f => ({ ...f, type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TX_TYPES.map(t => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Valor</Label>
              <Input 
                type="number" 
                step="0.01"
                placeholder="0,00" 
                value={form.amount} 
                onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Descrição</Label>
            <Input 
              placeholder="Ex: Aluguel, Venda de Produto..." 
              value={form.description} 
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2 flex flex-col">
              <Label className="mb-1">Data</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="justify-start text-left font-normal">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {form.competence_date ? format(new Date(form.competence_date), "dd/MM/yyyy") : <span>Selecione</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={new Date(form.competence_date)}
                    onSelect={(d) => d && setForm(f => ({ ...f, competence_date: iso(d) }))}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm(f => ({ ...f, status: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pendente</SelectItem>
                  <SelectItem value="paid">{form.type === "income" ? "Recebido" : "Pago"}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Conta</Label>
              <Select value={form.account_id} onValueChange={(v) => setForm(f => ({ ...f, account_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {meta?.accounts.map((a: any) => (
                    <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Categoria</Label>
              <Select value={form.category_id} onValueChange={(v) => setForm(f => ({ ...f, category_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {meta?.categories.map((c: any) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>{form.type === "income" ? "Cliente" : "Fornecedor"}</Label>
            <Input 
              placeholder="Nome da pessoa ou empresa" 
              value={form.person_name} 
              onChange={e => setForm(f => ({ ...f, person_name: e.target.value }))}
            />
          </div>

          <div className="space-y-2">
            <Label>Observações</Label>
            <Input 
              placeholder="Notas adicionais" 
              value={form.notes} 
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button 
            disabled={save.isPending || !form.amount || !form.description}
            onClick={() => save.mutate()}
          >
            {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isEdit ? "Salvar alterações" : "Criar lançamento"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
