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
import { Plus, Tag, Trash2, FolderTree, Pencil } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/categorias")({
  component: CategoriasPage,
});

function CategoriasPage() {
  const { wsId } = useWorkspace();
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<any>(null);

  const { data: categories, isLoading } = useQuery({
    queryKey: ["categories", wsId],
    queryFn: async () => {
      if (!wsId) return [];
      const res = await db.from("categories").select("*").eq("workspace_id", wsId).order("name").execute();
      return Array.isArray(res?.data) ? res.data : [];
    },
    enabled: !!wsId,
  });

  const saveCategory = useMutation({
    mutationFn: async (formData: any) => {
      if (editingCategory) {
        const { error } = await db.from("categories").update(formData).eq("id", editingCategory.id).execute();
        if (error) throw error;
        return editingCategory;
      } else {
        const { data, error } = await db.from("categories").insert({
          ...formData,
          workspace_id: wsId,
        });
        if (error) throw error;
        return data;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      setIsOpen(false);
      setEditingCategory(null);
      toast.success(editingCategory ? "Categoria atualizada!" : "Categoria criada!");
    },
  });

  const deleteCategory = useMutation({
    mutationFn: async (id: string) => {
      return await db.from("categories").delete().eq("id", id).execute();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      toast.success("Categoria removida!");
    },
  });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    saveCategory.mutate(Object.fromEntries(formData));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Categorias</h1>
          <p className="text-muted-foreground">Organize seus lançamentos por categorias de receita e despesa.</p>
        </div>
        <Dialog open={isOpen} onOpenChange={(open) => {
          setIsOpen(open);
          if (!open) setEditingCategory(null);
        }}>
          <DialogTrigger asChild>
            <Button className="gap-2" onClick={() => setEditingCategory(null)}>
              <Plus className="size-4" /> Nova Categoria
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingCategory ? "Editar Categoria" : "Nova Categoria"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nome</Label>
                <Input id="name" name="name" placeholder="Ex: Alimentação, Lazer, Salário" defaultValue={editingCategory?.name} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="kind">Tipo</Label>
                <Select name="kind" defaultValue={editingCategory?.kind || "expense"}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="expense">Despesa</SelectItem>
                    <SelectItem value="income">Receita</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="color">Cor (Opcional)</Label>
                <Input id="color" name="color" type="color" className="h-10 w-full" defaultValue={editingCategory?.color || "#3b82f6"} />
              </div>
              <Button type="submit" className="w-full" disabled={saveCategory.isPending}>
                {saveCategory.isPending ? "Salvando..." : editingCategory ? "Atualizar Categoria" : "Salvar Categoria"}
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
              <TableHead className="w-[100px]">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {categories?.map((cat: any) => (
              <TableRow key={cat.id}>
                <TableCell className="font-medium flex items-center gap-2">
                  <div className="size-3 rounded-full" style={{ backgroundColor: cat.color || '#ccc' }} />
                  {cat.name}
                </TableCell>
                <TableCell>
                  <Badge variant={cat.kind === 'income' ? 'default' : 'destructive'}>
                    {cat.kind === 'income' ? 'Receita' : 'Despesa'}
                  </Badge>
                </TableCell>
                <TableCell className="flex items-center gap-1">
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="hover:bg-primary/10 text-primary"
                    onClick={() => {
                      setEditingCategory(cat);
                      setIsOpen(true);
                    }}
                  >
                    <Pencil className="size-4" />
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="text-destructive hover:bg-destructive/10"
                    onClick={() => deleteCategory.mutate(cat.id)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {!isLoading && categories?.length === 0 && (
              <TableRow>
                <TableCell colSpan={3} className="h-24 text-center">
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <FolderTree className="size-8 opacity-20" />
                    <span>Nenhuma categoria cadastrada.</span>
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
