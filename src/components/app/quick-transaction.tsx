import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, useRef } from "react";
import { toast } from "sonner";
import { Plus, Camera, Loader2 } from "lucide-react";
import { db } from "@/lib/db-browser";
import { useWorkspace } from "@/lib/workspace";
import { TX_TYPES, iso, num } from "@/lib/finance";
import { processReceipt } from "@/lib/ai.functions";
import { getCurrentUser } from "@/lib/auth-client.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function QuickTransaction() {
  const { wsId, canEdit } = useWorkspace();
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const aiProcessor = useServerFn(processReceipt);
  const getUser = useServerFn(getCurrentUser);
  const [open, setOpen] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);

  const [form, setForm] = useState({
    type: "expense",
    description: "",
    amount: "",
    competence_date: iso(new Date()),
    status: "paid", // Default to paid for quick entry
    account_id: "",
    category_id: "",
  });

  const create = useMutation({
    mutationFn: async () => {
      const me = await getUser({});
      const { error } = await db.from("transactions").insert({
        workspace_id: wsId!,
        type: form.type as any,
        description: form.description.trim(),
        amount: num(form.amount),
        status: form.status as any,
        competence_date: form.competence_date,
        paid_date: form.status === "paid" ? form.competence_date : null,
        account_id: form.account_id || null,
        category_id: form.category_id || null,
        created_by: me?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Lançamento rápido realizado.");
      setOpen(false);
      setForm((f) => ({ ...f, description: "", amount: "" }));
      qc.invalidateQueries();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsCapturing(true);
    try {
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve) => {
        reader.onloadend = () => resolve(reader.result as string);
      });
      reader.readAsDataURL(file);
      const base64 = await base64Promise;

      const result = await aiProcessor({ data: { image: base64 } });
      setForm((f) => ({
        ...f,
        description: result.description,
        amount: result.amount,
      }));
      toast.success("Comprovante processado!");
    } catch (e: any) {
      toast.error("Erro ao processar imagem: " + e.message);
    } finally {
      setIsCapturing(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handlePhotoClick = () => {
    fileInputRef.current?.click();
  };

  if (!canEdit) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          size="icon"
          className="fixed right-6 bottom-20 z-50 h-14 w-14 rounded-full shadow-2xl lg:bottom-6"
          aria-label="Lançamento Rápido"
        >
          <Plus className="size-6" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Lançamento Rápido</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <input
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            ref={fileInputRef}
            onChange={handleFileChange}
          />
          <Button 
            variant="outline" 
            className="h-24 w-full flex-col gap-2 border-dashed"
            onClick={handlePhotoClick}
            disabled={isCapturing}
          >
            {isCapturing ? (
              <Loader2 className="size-8 animate-spin text-muted-foreground" />
            ) : (
              <Camera className="size-8 text-muted-foreground" />
            )}
            <span className="text-xs font-medium">
              {isCapturing ? "Processando..." : "Tirar foto do comprovante"}
            </span>
          </Button>

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
                placeholder="0,00" 
                value={form.amount} 
                onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Descrição</Label>
            <Input 
              placeholder="Ex: Almoço, Mercado..." 
              value={form.description} 
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            />
          </div>

          <Button 
            className="w-full" 
            size="lg"
            disabled={create.isPending || !form.amount || !form.description}
            onClick={() => create.mutate()}
          >
            {create.isPending ? "Salvando..." : "Lançar Agora"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
