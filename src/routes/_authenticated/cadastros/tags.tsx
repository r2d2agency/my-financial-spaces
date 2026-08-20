import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { dbQuery } from "@/lib/db.functions";
import { useWorkspace } from "@/lib/workspace";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Plus, Search, Edit2, Archive, RotateCcw, Tag as TagIcon, Info, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/cadastros/tags")({
  component: Tags,
});

function Tags() {
  const { wsId, canEdit } = useWorkspace();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [editingTag, setEditingTag] = useState<any>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const { data: tags, isLoading } = useQuery({
    queryKey: ["tags", wsId],
    enabled: !!wsId,
    queryFn: async () => {
      const res = await dbQuery({ 
        data: { 
          action: "rpc", 
          rpcName: "list_tags", 
          rpcArgs: { workspace_id: wsId } 
        } 
      });
      return res as any[];
    },
  });

  const saveTag = useMutation({
    mutationFn: async (payload: any) => {
      await dbQuery({ 
        data: { 
          action: "rpc", 
          rpcName: "save_tag", 
          rpcArgs: { ...payload, workspace_id: wsId } 
        } 
      });
    },
    onSuccess: () => {
      toast.success("Tag salva.");
      qc.invalidateQueries({ queryKey: ["tags"] });
      setIsDialogOpen(false);
      setEditingTag(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteTag = useMutation({
    mutationFn: async (id: string) => {
      await dbQuery({ 
        data: { 
          action: "rpc", 
          rpcName: "delete_tag", 
          rpcArgs: { id, workspace_id: wsId } 
        } 
      });
    },
    onSuccess: () => {
      toast.success("Tag excluída.");
      qc.invalidateQueries({ queryKey: ["tags"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleStatus = useMutation({
    mutationFn: async ({ id, archived }: { id: string; archived: boolean }) => {
      await dbQuery({ 
        data: { 
          action: "rpc", 
          rpcName: "save_tag", 
          rpcArgs: { id, workspace_id: wsId, archived } 
        } 
      });
    },
    onSuccess: () => {
      toast.success("Status atualizado.");
      qc.invalidateQueries({ queryKey: ["tags"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const filtered = tags?.filter(t => 
    t.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Tags</h1>
          <p className="text-sm text-slate-500">Adicione marcadores personalizados para organizar e filtrar suas movimentações.</p>
        </div>
        <Button onClick={() => { setEditingTag(null); setIsDialogOpen(true); }} disabled={!canEdit}>
          <Plus className="size-4 mr-2" /> Nova Tag
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
        <Input 
          placeholder="Buscar tags..." 
          className="pl-9 bg-white"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Carregando tags...</div>
      ) : (
        <div className="grid sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {filtered?.map(t => (
            <Card key={t.id} className={cn("shadow-sm border-slate-200", t.archived && "opacity-60 bg-slate-50")}>
              <CardContent className="p-4 flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 overflow-hidden">
                    <div className="size-3 rounded-full shrink-0" style={{ backgroundColor: t.color || '#94a3b8' }} />
                    <span className="font-bold text-slate-900 truncate" title={t.name}>{t.name}</span>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button variant="ghost" size="icon" className="size-7" onClick={() => { setEditingTag(t); setIsDialogOpen(true); }} disabled={!canEdit}>
                      <Edit2 className="size-3" />
                    </Button>
                    {(t.usage_count > 0) ? (
                       <Button 
                         variant="ghost" 
                         size="icon" 
                         className="size-7" 
                         onClick={() => toggleStatus.mutate({ id: t.id, archived: !t.archived })}
                         disabled={!canEdit}
                       >
                         {t.archived ? <RotateCcw className="size-3" /> : <Archive className="size-3" />}
                       </Button>
                    ) : (
                      <Button variant="ghost" size="icon" className="size-7 text-rose-500 hover:text-rose-600" onClick={() => deleteTag.mutate(t.id)} disabled={!canEdit}>
                        <Trash2 className="size-3" />
                      </Button>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  <span>Utilizações</span>
                  <span className="text-slate-900">{t.usage_count || 0}</span>
                </div>
              </CardContent>
            </Card>
          ))}

          {filtered?.length === 0 && (
            <div className="col-span-full py-12 text-center bg-slate-50 border rounded-lg border-dashed">
              <Info className="size-8 text-slate-300 mx-auto mb-2" />
              <p className="text-sm text-slate-500">Nenhuma tag encontrada.</p>
            </div>
          )}
        </div>
      )}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingTag ? "Editar Tag" : "Nova Tag"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={e => {
            e.preventDefault();
            const formData = new FormData(e.currentTarget);
            saveTag.mutate({
              id: editingTag?.id,
              name: formData.get("name"),
              color: formData.get("color"),
            });
          }} className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome da Tag *</Label>
              <Input id="name" name="name" defaultValue={editingTag?.name} required placeholder="Ex: Contrato 2026, Urgente..." />
            </div>
            <div className="space-y-2">
              <Label htmlFor="color">Cor (Hexadecimal)</Label>
              <div className="flex gap-2">
                <Input id="color" name="color" type="color" className="w-12 h-10 p-1" defaultValue={editingTag?.color || "#94a3b8"} />
                <Input defaultValue={editingTag?.color || "#94a3b8"} name="color_text" onChange={e => {
                  const input = e.target.parentElement?.querySelector('input[type="color"]') as HTMLInputElement;
                  if (input && e.target.value.match(/^#[0-9A-Fa-f]{6}$/)) input.value = e.target.value;
                }} placeholder="#94a3b8" className="flex-1" />
              </div>
            </div>
            <DialogFooter className="pt-4">
              <Button type="button" variant="ghost" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={saveTag.isPending}>Salvar Tag</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}