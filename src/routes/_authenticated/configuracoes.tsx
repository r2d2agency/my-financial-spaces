import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { db } from "@/lib/db-browser";
import { useWorkspace } from "@/lib/workspace";
import { ROLES, brl, num, type Role } from "@/lib/finance";
import { inviteMember, removeMember, updateMemberRole, cancelInvite } from "@/lib/workspace.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";
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
  const [invite, setInvite] = useState({ email: "", role: "viewer" as Role });
  const [openaiKey, setOpenaiKey] = useState("");
  
  const getUser = useServerFn(getCurrentUser);
  const doInvite = useServerFn(inviteMember);
  const doRemove = useServerFn(removeMember);
  const doUpdateRole = useServerFn(updateMemberRole);
  const doCancelInvite = useServerFn(cancelInvite);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["settings", wsId],
    enabled: !!wsId,
    queryFn: async () => {
      try {
        const [members, invites, sub] = await Promise.all([
          db.rpc("list_ws_members", { _ws: wsId! }),
          db.from("workspace_invites").select("*").eq("workspace_id", wsId!).execute(),
          db.from("subscriptions").select("status, current_period_end, plans(name, price_cents)").eq("workspace_id", wsId!).maybeSingle(),
        ]);
        const { data: config } = await db.from("platform_configs").select("value").eq("key", "openai_api_key").maybeSingle();
        
        return { 
          members: Array.isArray(members.data) ? members.data : [], 
          invites: (Array.isArray(invites.data) ? invites.data : []).filter((i: any) => i.status === 'pending'), 
          sub: sub.data, 
          openaiKey: config?.value ?? "" 
        };
      } catch (err) {
        console.error("Erro ao carregar configurações:", err);
        throw err;
      }
    },
    retry: 1,
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
      await doInvite({ 
        data: { 
          workspaceId: wsId!, 
          email: invite.email, 
          role: invite.role as any 
        } 
      });
    },
    onSuccess: (res: any) => {
      toast.success(res?.type === 'membership' ? "Membro adicionado!" : "Convite enviado!");
      setInvite({ email: "", role: "viewer" });
      qc.invalidateQueries({ queryKey: ["settings"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeM = useMutation({
    mutationFn: (userId: string) => doRemove({ data: { workspaceId: wsId!, userId } }),
    onSuccess: () => {
      toast.success("Membro removido.");
      qc.invalidateQueries({ queryKey: ["settings"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateR = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: Role }) => 
      doUpdateRole({ data: { workspaceId: wsId!, userId, role: role as any } }),
    onSuccess: () => {
      toast.success("Permissão atualizada.");
      qc.invalidateQueries({ queryKey: ["settings"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const cancelI = useMutation({
    mutationFn: (inviteId: string) => doCancelInvite({ data: { workspaceId: wsId!, inviteId } }),
    onSuccess: () => {
      toast.success("Convite cancelado.");
      qc.invalidateQueries({ queryKey: ["settings"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6 pb-20">
      <h1 className="text-2xl font-bold tracking-tight text-foreground">Configurações</h1>

      <Card id="gerir-espaco">
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
          <CardTitle className="text-base text-primary">Membros e acessos</CardTitle>
          <CardDescription>Gerencie quem pode visualizar e operar este espaço.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary/50" />
            </div>
          ) : isError ? (
            <div className="rounded-lg bg-destructive/10 p-4 text-center">
              <p className="text-sm text-destructive">Erro ao carregar membros: {error?.message}</p>
              <Button variant="outline" size="sm" className="mt-2" onClick={() => qc.invalidateQueries({ queryKey: ["settings"] })}>Tentar novamente</Button>
            </div>
          ) : (
            <>
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-foreground/70 uppercase tracking-wider">Membros Ativos</h3>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {(data?.members ?? []).map((m: any) => (
                    <div key={m.user_id} className="flex flex-col gap-3 rounded-lg border border-border p-4 bg-card shadow-sm hover:shadow-md transition-shadow">
                      <div className="flex items-start justify-between">
                        <div className="max-w-[70%]">
                          <p className="font-semibold text-foreground line-clamp-1" title={m.full_name || m.email}>{m.full_name || m.email}</p>
                          <p className="text-xs text-muted-foreground truncate" title={m.email}>{m.email}</p>
                        </div>
                        <Badge variant={m.role === 'owner' ? 'default' : 'secondary'} className="capitalize shrink-0">
                          {ROLES.find(r => r.value === m.role)?.label || m.role}
                        </Badge>
                      </div>
                      
                      {canManage && m.role !== 'owner' && (
                        <div className="flex items-center gap-2 mt-auto pt-2 border-t border-border/50">
                          <Select 
                            value={m.role} 
                            onValueChange={(v) => updateR.mutate({ userId: m.user_id, role: v as Role })}
                          >
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {ROLES.filter(r => r.value !== 'owner').map(r => (
                                <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={() => {
                              if (confirm(`Remover acesso de ${m.full_name || m.email}?`)) {
                                removeM.mutate(m.user_id);
                              }
                            }}
                          >
                            Remover
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {(data?.invites?.length ?? 0) > 0 && (
                <div className="space-y-4 pt-4 border-t border-border">
                  <h3 className="text-sm font-semibold text-foreground/70 uppercase tracking-wider">Convites Pendentes</h3>
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {data?.invites.map((i: any) => (
                      <div key={i.id} className="flex flex-col gap-3 rounded-lg border border-dashed border-border p-4 bg-muted/20">
                        <div className="flex items-start justify-between">
                          <div className="max-w-[70%]">
                            <p className="font-medium text-foreground truncate" title={i.email}>{i.email}</p>
                            <p className="text-[10px] text-muted-foreground">Expira em {new Date(i.expires_at).toLocaleDateString()}</p>
                          </div>
                          <Badge variant="outline" className="capitalize shrink-0">
                            {ROLES.find(r => r.value === i.role)?.label || i.role}
                          </Badge>
                        </div>
                        {canManage && (
                          <div className="flex items-center gap-2 mt-auto pt-2">
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="h-8 text-xs"
                              onClick={() => {
                                const url = `${window.location.origin}/invite/${i.token}`;
                                navigator.clipboard.writeText(url);
                                toast.success("Link do convite copiado!");
                              }}
                            >
                              Copiar Link
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="h-8 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                              onClick={() => cancelI.mutate(i.id)}
                            >
                              Cancelar
                            </Button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {canManage && (
                <div className="pt-6 border-t border-border">
                  <h3 className="text-sm font-semibold text-foreground/70 uppercase tracking-wider mb-4">+ Adicionar membro</h3>
                  <div className="flex flex-col sm:flex-row gap-3">
                    <Input
                      className="flex-1"
                      placeholder="usuario@email.com"
                      type="email"
                      value={invite.email}
                      onChange={(e) => setInvite((p) => ({ ...p, email: e.target.value }))}
                    />
                    <Select 
                      value={invite.role} 
                      onValueChange={(v) => setInvite((p) => ({ ...p, role: v as Role }))}
                    >
                      <SelectTrigger className="w-full sm:w-[180px]">
                        <SelectValue placeholder="Permissão" />
                      </SelectTrigger>
                      <SelectContent>
                        {ROLES.filter((r) => r.value !== "owner").map((r) => (
                          <SelectItem key={r.value} value={r.value}>
                            <div className="flex flex-col gap-0.5">
                              <span>{r.label}</span>
                              <span className="text-[10px] text-muted-foreground font-normal">{(r as any).desc}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button 
                      onClick={() => sendInvite.mutate()} 
                      disabled={!invite.email || sendInvite.isPending}
                      className="w-full sm:w-auto"
                    >
                      {sendInvite.isPending ? "Enviando..." : "Enviar convite"}
                    </Button>
                  </div>
                </div>
              )}
            </>
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

      <div className="pt-4 flex flex-col gap-4">
        <Button asChild variant="outline" className="w-full sm:w-fit">
          <Link to="/onboarding">Criar novo espaço</Link>
        </Button>
        <Button 
          variant="outline" 
          className="w-full sm:w-fit"
          onClick={() => {
            localStorage.removeItem("auth_token");
            window.location.href = "/auth";
          }}
        >
          Sair da conta
        </Button>
      </div>
    </div>
  );
}
