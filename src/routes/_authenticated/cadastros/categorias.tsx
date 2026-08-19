import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useWorkspace } from "@/lib/workspace";
import { dbQuery } from "@/lib/db.functions";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Pencil, Tag } from "lucide-react";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/cadastros/categorias")({
  component: CategoriasPage,
});

function CategoriasPage() {
  const { wsId } = useWorkspace();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);

  const { data: categories, isLoading } = useQuery({
    queryKey: ["categories", wsId],
    queryFn: () => dbQuery.data({ table: "categories", action: "rpc", rpcName: "list_categories", rpcArgs: { workspace_id: wsId } }),
    enabled: !!wsId,
  });

  const saveMutation = useMutation({
    mutationFn: (args: any) => dbQuery.data({ table: "categories", action: "rpc", rpcName: "save_category", rpcArgs: { ...args, workspace_id: wsId } }),
    onSuccess: () => { 
      qc.invalidateQueries({ queryKey: ["categories"] }); 
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
      type: formData.get("type") 
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold">Categorias</h2>
        <Button onClick={() => { setEditing(null); setOpen(true); }}>
          <Plus className="size-4 mr-2" /> Nova Categoria
        </Button>
      </div>

      <div className="rounded-md border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={3} className="text-center py-8 text-muted-foreground">Carregando...</TableCell></TableRow>
            ) : categories?.length === 0 ? (
              <TableRow><TableCell colSpan={3} className="text-center py-8 text-muted-foreground">Nenhuma categoria encontrada.</TableCell></TableRow>
            ) : categories?.map((c: any) => (
              <TableRow key={c.id}>
                <TableCell className="font-medium flex items-center gap-2">
                  <Tag className="size-4 text-muted-foreground" />
                  {c.name}
                </TableCell>
                <TableCell>
                  <Badge variant={c.type === 'income' ? 'default' : 'destructive'} className="capitalize">
                    {c.type === 'income' ? 'Receita' : 'Despesa'}
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Editar Categoria" : "Nova Categoria"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 pt-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Nome da Categoria</label>
              <Input name="name" defaultValue={editing?.name} placeholder="Ex: Alimentação, Salário..." required />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Tipo</label>
              <Select name="type" defaultValue={editing?.type || "expense"}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="income">Receita</SelectItem>
                  <SelectItem value="expense">Despesa</SelectItem>
                </SelectContent>
              </Select>
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
