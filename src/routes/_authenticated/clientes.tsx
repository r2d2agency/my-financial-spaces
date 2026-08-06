import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { db } from "@/lib/db-browser";
import { useWorkspace } from "@/lib/workspace";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from "@/components/ui/dialog";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Plus, Users, Trash2, UserPlus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/clientes")({
  component: ClientesPage,
});

function ClientesPage() {
  const { wsId } = useWorkspace();
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);

  const { data: contacts, isLoading } = useQuery({
    queryKey: ["contacts", wsId],
    queryFn: async () => {
      if (!wsId) return [];
      const res = await db.from("contacts").select("*").eq("workspace_id", wsId).order("name").execute();
      return Array.isArray(res?.data) ? res.data : [];
    },
    enabled: !!wsId,
  });

  const createContact = useMutation({
    mutationFn: async (formData: any) => {
      return await db.from("contacts").insert({
        ...formData,
        workspace_id: wsId,
      }).execute();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      setIsOpen(false);
      toast.success("Contato cadastrado!");
    },
  });

  const deleteContact = useMutation({
    mutationFn: async (id: string) => {
      return await db.from("contacts").delete().eq("id", id).execute();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      toast.success("Contato removido!");
    },
  });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    createContact.mutate(Object.fromEntries(formData));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Clientes e Fornecedores</h1>
          <p className="text-muted-foreground">Gerencie pessoas e empresas vinculadas às suas finanças.</p>
        </div>
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="size-4" /> Novo Contato
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Novo Cadastro</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nome / Razão Social</Label>
                <Input id="name" name="name" placeholder="Nome completo ou empresa" required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="kind">Tipo</Label>
                  <Select name="kind" defaultValue="both">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="client">Cliente</SelectItem>
                      <SelectItem value="vendor">Fornecedor</SelectItem>
                      <SelectItem value="both">Ambos</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="document">CPF/CNPJ (Opcional)</Label>
                  <Input id="document" name="document" placeholder="000.000.000-00" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" name="email" type="email" placeholder="contato@empresa.com" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Telefone</Label>
                  <Input id="phone" name="phone" placeholder="(00) 00000-0000" />
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={createContact.isPending}>
                {createContact.isPending ? "Salvando..." : "Salvar Cadastro"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="rounded-md border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Contato</TableHead>
              <TableHead className="w-[100px]">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {contacts?.map((contact: any) => (
              <TableRow key={contact.id}>
                <TableCell className="font-medium">
                  <div>{contact.name}</div>
                  {contact.document && <div className="text-[10px] text-muted-foreground">{contact.document}</div>}
                </TableCell>
                <TableCell>
                  <Badge variant="outline">
                    {contact.kind === 'client' ? 'Cliente' : contact.kind === 'vendor' ? 'Fornecedor' : 'Ambos'}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="text-xs">{contact.email}</div>
                  <div className="text-xs text-muted-foreground">{contact.phone}</div>
                </TableCell>
                <TableCell>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="text-destructive hover:bg-destructive/10"
                    onClick={() => deleteContact.mutate(contact.id)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {!isLoading && (!contacts || contacts.length === 0) && (
              <TableRow>
                <TableCell colSpan={4} className="h-24 text-center">
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <Users className="size-8 opacity-20" />
                    <span>Nenhum cliente ou fornecedor cadastrado.</span>
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
