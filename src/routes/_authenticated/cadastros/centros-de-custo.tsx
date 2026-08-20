import { createFileRoute } from "@tanstack/react-router";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { dbQuery } from "@/lib/db.functions";
import { useWorkspace } from "@/lib/workspace";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Plus, Search, Edit2, Archive, RotateCcw, Building2, Hash, FileText, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/cadastros/centros-de-custo")({
  component: CostCenters,
});

function CostCenters() {
  const { wsId, canEdit } = useWorkspace();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [editingCC, setEditingCC] = useState<any>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const { data: costCenters, isLoading } = useQuery({
    queryKey: ["cost-centers", wsId],
    enabled: !!wsId,
    queryFn: async () => {
      const res = await dbQuery({ 
        data: { 
          action: "rpc", 
          rpcName: "list_cost_centers", 
          rpcArgs: { workspace_id: wsId } 
        } 
      });
      return res as any[];
    },
  });

  const saveCC = useMutation({
    mutationFn: async (payload: any) => {
      await dbQuery({ 
        data: { 
          action: "rpc", 
          rpcName: "save_cost_center", 
          rpcArgs: { ...payload, workspace_id: wsId } 
        } 
      });
    },
    onSuccess: () => {
      toast.success("Centro de custo salvo.");
      qc.invalidateQueries({ queryKey: ["cost-centers"] });
      setIsDialogOpen(false);
      setEditingCC(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleStatus = useMutation({
    mutationFn: async ({ id, archived }: { id: string; archived: boolean }) => {
      await dbQuery({ 
        data: { 
          action: "rpc", 
          rpcName: "save_cost_center", 
          rpcArgs: { id, workspace_id: wsId, archived } 
        } 
      });
    },
    onSuccess: () => {
      toast.success("Status atualizado.");
      qc.invalidateQueries({ queryKey: ["cost-centers"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const filtered = costCenters?.filter(cc => 
    cc.name.toLowerCase().includes(search.toLowerCase()) || 
    cc.code?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Centros de Custo</h1>
          <p className="text-sm text-slate-500">Gerencie as unidades de negócio e projetos para rateio de despesas.</p>
        </div>
        <Button onClick={() => { setEditingCC(null); setIsDialogOpen(true); }} disabled={!canEdit}>
          <Plus className="size-4 mr-2" /> Novo Centro de Custo
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
        <Input 
          placeholder="Buscar por nome ou código..." 
          className="pl-9 bg-white"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Carregando centros de custo...</div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered?.map(cc => (
            <Card key={cc.id} className={cn("shadow-sm border-slate-200", cc.archived && "opacity-60 bg-slate-50")}>
              <CardHeader className="p-4 pb-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1">
                    <CardTitle className="text-base font-bold flex items-center gap-2">
                      <Building2 className="size-4 text-primary" />
                      {cc.name}
                    </CardTitle>
                    {cc.code && (
                      <Badge variant="outline" className="text-[10px] font-mono py-0 h-5">
                        <Hash className="size-3 mr-1" /> {cc.code}
                      </Badge>
                    )}
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="size-8" onClick={() => { setEditingCC(cc); setIsDialogOpen(true); }} disabled={!canEdit}>
                      <Edit2 className="size-3.5" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="size-8" 
                      onClick={() => toggleStatus.mutate({ id: cc.id, archived: !cc.archived })}
                      disabled={!canEdit}
                    >
                      {cc.archived ? <RotateCcw className="size-3.5" /> : <Archive className="size-3.5" />}
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-4 pt-0 space-y-3">
                {cc.description && <p className="text-xs text-slate-500 line-clamp-2">{cc.description}</p>}
                
                <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-slate-400 border-t pt-3">
                  <span>Movimentações</span>
                  <span className="text-slate-900">{cc.transaction_count || 0}</span>
                </div>
              </CardContent>
            </Card>
          ))}

          {filtered?.length === 0 && (
            <div className="col-span-full py-12 text-center bg-slate-50 border rounded-lg border-dashed">
              <Info className="size-8 text-slate-300 mx-auto mb-2" />
              <p className="text-sm text-slate-500">Nenhum centro de custo encontrado.</p>
            </div>
          )}
        </div>
      )}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingCC ? "Editar Centro de Custo" : "Novo Centro de Custo"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={e => {
            e.preventDefault();
            const formData = new FormData(e.currentTarget);
            saveCC.mutate({
              id: editingCC?.id,
              name: formData.get("name"),
              code: formData.get("code"),
              description: formData.get("description"),
            });
          }} className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome do Centro de Custo *</Label>
              <Input id="name" name="name" defaultValue={editingCC?.name} required placeholder="Ex: Projeto Vertex, Administrativo..." />
            </div>
            <div className="space-y-2">
              <Label htmlFor="code">Código Identificador</Label>
              <Input id="code" name="code" defaultValue={editingCC?.code} placeholder="Ex: CC-001, PRJ-2026..." />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Descrição / Notas</Label>
              <Input id="description" name="description" defaultValue={editingCC?.description} placeholder="Breve descrição do uso deste centro..." />
            </div>
            <DialogFooter className="pt-4">
              <Button type="button" variant="ghost" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={saveCC.isPending}>Salvar Centro de Custo</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
