import { createFileRoute, useNavigate, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { getCurrentUser } from "@/lib/auth-client.functions";
import { useServerFn } from "@tanstack/react-start";
import { db } from "@/lib/db-browser";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/onboarding")({
  ssr: false,
  beforeLoad: async () => {
    const user = await getCurrentUser();
    if (!user) throw redirect({ to: "/auth", replace: true });
  },
  component: Onboarding,
  head: () => ({
    meta: [
      { title: "Novo espaço · Espaço Financeiro" },
      { name: "description", content: "Crie um novo espaço financeiro." },
      { property: "og:title", content: "Novo espaço financeiro" },
      { property: "og:type", content: "website" },
    ],
  }),
});

function Onboarding() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [saving, setSaving] = useState(false);
  const getUser = useServerFn(getCurrentUser);

  const [name, setName] = useState("Minha Vida Financeira");
  const [income, setIncome] = useState("");

  const finish = async () => {
    if (!name.trim()) return toast.error("Dê um nome ao espaço.");
    setSaving(true);
    try {
      const user = await getUser({});
      const { data: wsId, error } = await db.rpc("create_workspace", {
        _name: name.trim(),
        _income: parseFloat(String(income || 0)) || 0,
        _user_id: user?.id,
      });
      
      if (error) throw error;
      const ws = wsId as unknown as string;

      // Marcar onboarding como concluído imediatamente
      await db.from("workspaces").update({ onboarding_done: true }).eq("id", ws).execute();
      
      localStorage.setItem("ef.workspace", ws);
      await qc.invalidateQueries();
      toast.success("Espaço criado com sucesso!");
      navigate({ to: "/dashboard", replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao criar o espaço.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-muted/30 px-4 py-10 flex items-center justify-center">
      <div className="w-full max-w-md">
        <Card className="shadow-lg border-primary/10">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl font-bold">Criar Novo Espaço</CardTitle>
            <CardDescription>
              Dê um nome ao seu novo espaço financeiro para começar.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="ws">Nome do espaço</Label>
              <Input 
                id="ws" 
                placeholder="Ex: Casa e Família"
                value={name} 
                onChange={(e) => setName(e.target.value)} 
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="inc">Renda mensal esperada (opcional)</Label>
              <Input 
                id="inc" 
                type="number" 
                step="0.01" 
                placeholder="0,00"
                value={income} 
                onChange={(e) => setIncome(e.target.value)} 
              />
            </div>
            
            <div className="flex flex-col gap-2 pt-4">
              <Button 
                className="w-full h-11 text-base font-medium" 
                onClick={finish} 
                disabled={saving || !name.trim()}
              >
                {saving ? "Criando..." : "Criar Espaço"}
              </Button>
              <Button 
                variant="ghost" 
                className="w-full h-11" 
                onClick={() => navigate({ to: "/dashboard" })}
                disabled={saving}
              >
                Cancelar
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
