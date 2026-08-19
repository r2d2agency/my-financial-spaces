import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useWorkspace } from "@/lib/workspace";
import { dbQuery } from "@/lib/db.functions";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Pencil, Users } from "lucide-react";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatDocument, formatPhone } from "@/lib/finance";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/cadastros/contatos")({
  component: ContatosPage,
});

function ContatosPage() {
  const { wsId } = useWorkspace();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);

  const { data: contacts, isLoading } = useQuery({
    queryKey: ["contacts", wsId],
    queryFn: () => dbQuery({ table: "contacts", action: "rpc", rpcName: "list_contacts", rpcArgs: { workspace_id: wsId } }),
    enabled: !!wsId,
  });

  const saveMutation = useMutation({
    mutationFn: (data: any) => dbQuery({ table: "contacts", action: "rpc", rpcName: "save_contact", rpcArgs: { ...data, workspace_id: wsId } }),
    onSuccess: () => { 
      qc.invalidateQueries({ queryKey: ["contacts"] }); 
      setOpen(false); 
      setEditing(null); 
    }
  });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    saveMutation.mutate({ 
      id: editing?.id, 
      name: formData.get("name"), 
      document: formData.get("document"), 
      phone: formData.get("phone"), 
      email: formData.get("email"), 
      type: formData.get("type") 
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold">Clientes e Fornecedores</h2>
        <Button onClick={() => { setEditing(null); setOpen(true); }}>
          <Plus className="size-4 mr-2" /> Novo Contato
        </Button>
      </div>

      <div className="rounded-md border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Documento</TableHead>
              <TableHead>Contato</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Carregando...</TableCell></TableRow>
            ) : contacts?.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Nenhum contato encontrado.</TableCell></TableRow>
            ) : contacts?.map((c: any) => (
              <TableRow key={c.id}>
                <TableCell className="font-medium flex items-center gap-2">
                  <Users className="size-4 text-muted-foreground" />
                  {c.name}
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">{formatDocument(c.document) || "-"}</TableCell>
                <TableCell className="text-sm">
                  <div>{formatPhone(c.phone)}</div>
                  <div className="text-[11px] text-muted-foreground">{c.email}</div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className="capitalize">
                    {c.type === 'client' ? 'Cliente' : 'Fornecedor'}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="icon" onClick={() => { setEditing(c); setOpen(true); }}>
                    <Pencil className="size-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar Contato" : "Novo Contato"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 pt-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Nome / Razão Social</label>
              <Input name="name" defaultValue={editing?.name} placeholder="Nome completo" required />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">CPF / CNPJ</label>
                <Input name="document" defaultValue={editing?.document} placeholder="Somente números" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Tipo</label>
                <Select name="type" defaultValue={editing?.type || "client"}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="client">Cliente</SelectItem>
                    <SelectItem value="supplier">Fornecedor</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">E-mail</label>
              <Input name="email" type="email" defaultValue={editing?.email} placeholder="email@exemplo.com" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Telefone</label>
              <Input name="phone" defaultValue={editing?.phone} placeholder="(00) 00000-0000" />
            </div>
            <Button type="submit" className="w-full" disabled={saveMutation.isPending}>
              {saveMutation.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
