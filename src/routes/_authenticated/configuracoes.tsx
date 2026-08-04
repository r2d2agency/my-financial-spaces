import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { db } from "@/lib/db-browser";
import { useWorkspace } from "@/lib/workspace";
import { ROLES, brl, num } from "@/lib/finance";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { getCurrentUser } from "@/lib/auth-client.functions";
import { useServerFn } from "@tanstack/react-start";

export const Route = createFileRoute("/_authenticated/configuracoes")({
  component: Configuracoes,
  head: () => ({
    meta: [
      { title: "Configurações · Espaço Financeiro" },
      { name: "description", content: "Gerencie o espaço, convites, permissões da equipe e assinatura." },
      { property: "og:title", content: "Configurações do espaço" },
      { property: "og:description", content: "Equipe, permissões e plano." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function Configuracoes() {
  const { wsId, current, canManage, refetch } = useWorkspace();
  const qc = useQueryClient();
  const [name, setName] = useState(current?.workspaces?.name ?? "");
  const [income, setIncome] = useState(String(current?.workspaces?.expected_income ?? ""));
  const [invite, setInvite] = useState({ email: "", role: "editor", hide_balances: false });
  const [openaiKey, setOpenaiKey] = useState("");
  const getUser = useServerFn(getCurrentUser);

  const { data } = useQuery({
    queryKey: ["settings", wsId],
    enabled: !!wsId,
    queryFn: async () => {
      const [members, invites, sub] = await Promise.all([
        db.rpc("list_ws_members", { _ws: wsId! }),
        db.from("workspace_invites").select("id, email, role, status").eq("workspace_id", wsId!).execute(),
        db.from("subscriptions").select("status, current_period_end, plans(name, price_cents)").eq("workspace_id", wsId!).maybeSingle(),
      ]);
      const { data: config } = await db.from("platform_configs").select("value").eq("key", "openai_api_key").maybeSingle();
      return { members: members.data ?? [], invites: invites.data ?? [], sub: sub.data, openaiKey: config?.value ?? "" };
    },
  });

  const saveAi = useMutation({
    mutationFn: async (key: string) => {
      // Usamos db.rpc ou uma tabela de config interna se existir, 
      // mas como o sistema é auto-hospedado, podemos salvar no banco.
      const { data: existing } = await db.from("platform_configs").select("id").eq("key", "openai_api_key").maybeSingle();
      if (existing) {
        await db.from("platform_configs").update({ value: key }).eq("key", "openai_api_key").execute();
      } else {
        await db.from("platform_configs").insert({ key: "openai_api_key", value: key }).execute();
      }
    },
    onSuccess: () => {
      toast.success("Configuração da OpenAI salva.");
      qc.invalidateQueries({ queryKey: ["settings"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const saveWs = useMutation({
    mutationFn: async () => {
      const { error } = await db
        .from("workspaces")
        .update({ name: name.trim(), expected_income: num(income) })
        .eq("id", wsId!)
        .execute();
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Espaço atualizado.");
      refetch();
      qc.invalidateQueries();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteWs = useMutation({
    mutationFn: async () => {
      if (!window.confirm("ATENÇÃO: Isso excluirá permanentEMENTE este espaço e todos os seus dados (contas, transações, etc). Confirmar?")) return;
      
      // Primeiro removemos os membros (cascade manual se necessário, mas o schema deve ter ON DELETE CASCADE)
      // No nosso setup manual, as tabelas referenciam workspace_id.
      const { error } = await db.from("workspaces").delete().eq("id", wsId!).execute();
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Espaço excluído com sucesso.");
      localStorage.removeItem("ef.workspace");
      // Forçamos um recarregamento para que o WorkspaceProvider pegue o próximo espaço disponível
      qc.invalidateQueries({ queryKey: ["memberships"] });
      window.location.href = "/dashboard";
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const sendInvite = useMutation({
    mutationFn: async () => {
      const me = await getUser({});
      const { error } = await db.from("workspace_invites").insert({
        workspace_id: wsId!,
        email: invite.email.trim().toLowerCase(),
        role: invite.role as never,
        hide_balances: invite.hide_balances,
        invited_by: me?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Convite registrado. O acesso é liberado quando a pessoa criar a conta com esse e-mail.");
      setInvite({ email: "", role: "editor", hide_balances: false });
      qc.invalidateQueries();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight text-foreground">Configurações</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Espaço</CardTitle>
          <CardDescription>Nome e renda mensal esperada.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label>Nome</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} disabled={!canManage} />
          </div>
          <div className="space-y-1">
            <Label>Renda esperada</Label>
            <Input type="number" value={income} onChange={(e) => setIncome(e.target.value)} disabled={!canManage} />
          </div>
          {canManage && (
            <Button className="sm:col-span-2 sm:w-fit" onClick={() => saveWs.mutate()} disabled={saveWs.isPending}>
              Salvar
            </Button>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Equipe</CardTitle>
          <CardDescription>Papéis e permissões de cada pessoa.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {(data?.members ?? []).map((m: any) => (
            <div key={m.user_id} className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-2 text-sm">
              <div>
                <p className="font-medium text-foreground">{m.full_name || m.email}</p>
                <p className="text-xs text-muted-foreground">{m.email}</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="capitalize">{m.role}</Badge>
                {m.hide_balances && <Badge variant="outline">saldos ocultos</Badge>}
              </div>
            </div>
          ))}
          {(data?.invites ?? []).filter((i: any) => i.status === "pending").map((i: any) => (
            <div key={i.id} className="flex items-center justify-between text-sm text-muted-foreground">
              <span>{i.email}</span>
              <Badge variant="outline">convite pendente · {i.role}</Badge>
            </div>
          ))}

          {canManage && (
            <div className="grid gap-3 pt-2 sm:grid-cols-4">
              <Input
                className="sm:col-span-2"
                placeholder="email@exemplo.com"
                value={invite.email}
                onChange={(e) => setInvite((p) => ({ ...p, email: e.target.value }))}
              />
              <Select value={invite.role} onValueChange={(v) => setInvite((p) => ({ ...p, role: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ROLES.filter((r) => r.value !== "owner").map((r) => (
                    <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button onClick={() => sendInvite.mutate()} disabled={!invite.email || sendInvite.isPending}>
                Convidar
              </Button>
              <label className="flex items-center gap-2 text-sm text-muted-foreground sm:col-span-4">
                <input
                  type="checkbox"
                  checked={invite.hide_balances}
                  onChange={(e) => setInvite((p) => ({ ...p, hide_balances: e.target.checked }))}
                />
                Ocultar saldos para esta pessoa (pode lançar, não vê saldo)
              </label>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Assinatura</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          {data?.sub ? (
            <>
              <p className="text-foreground">
                Plano {(data.sub as any).plans?.name ?? "—"} ·{" "}
                {brl(((data.sub as any).plans?.price_cents ?? 0) / 100)}/mês
              </p>
              <p>
                Status: {data.sub.status} · válido até{" "}
                {data.sub.current_period_end?.split("-").reverse().join("/") ?? "—"}
              </p>
            </>
          ) : (
            <p>Nenhuma assinatura encontrada.</p>
          )}
        </CardContent>
      </Card>

      {current?.role === "owner" && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Inteligência Artificial (OpenAI)</CardTitle>
              <CardDescription>
                Configure sua API Key para processamento automático de comprovantes.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1">
                <Label>OpenAI API Key</Label>
                <div className="flex gap-2">
                  <Input 
                    type="password" 
                    placeholder={data?.openaiKey ? "••••••••••••••••" : "sk-..."}
                    value={openaiKey}
                    onChange={(e) => setOpenaiKey(e.target.value)}
                  />
                  <Button 
                    onClick={() => saveAi.mutate(openaiKey)}
                    disabled={!openaiKey || saveAi.isPending}
                  >
                    Salvar
                  </Button>
                </div>
                {data?.openaiKey && (
                  <p className="text-[10px] text-success">API Key configurada e ativa.</p>
                )}
              </div>
              <div className="space-y-1">
                <Label>Modelo Recomendado</Label>
                <Select disabled defaultValue="gpt-4o-mini">
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="gpt-4o-mini">gpt-4o-mini (Rápido e Barato)</SelectItem>
                    <SelectItem value="gpt-4o">gpt-4o (Alta Precisão)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <Card className="border-destructive/20 bg-destructive/5">
            <CardHeader>
              <CardTitle className="text-base text-destructive">Zona de Perigo</CardTitle>
              <CardDescription>Ações irreversíveis para este espaço financeiro.</CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
                variant="destructive" 
                onClick={() => deleteWs.mutate()}
                disabled={deleteWs.isPending}
              >
                Excluir este Espaço Permanentemente
              </Button>
            </CardContent>
          </Card>
        </>
      )}

      <div className="pt-4">
        <Button asChild variant="outline">
          <Link to="/onboarding">Criar novo espaço</Link>
        </Button>
      </div>
    </div>
  );
}
