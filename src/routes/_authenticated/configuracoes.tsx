import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/lib/workspace";
import { ROLES, brl, num } from "@/lib/finance";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

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

  const { data } = useQuery({
    queryKey: ["settings", wsId],
    enabled: !!wsId,
    queryFn: async () => {
      const [members, invites, sub] = await Promise.all([
        supabase.rpc("list_ws_members", { _ws: wsId! }),
        supabase.from("workspace_invites").select("id, email, role, status").eq("workspace_id", wsId!),
        supabase.from("subscriptions").select("status, current_period_end, plans(name, price_cents)").eq("workspace_id", wsId!).maybeSingle(),
      ]);
      return { members: members.data ?? [], invites: invites.data ?? [], sub: sub.data };
    },
  });

  const saveWs = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("workspaces")
        .update({ name: name.trim(), expected_income: num(income) })
        .eq("id", wsId!);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Espaço atualizado.");
      refetch();
      qc.invalidateQueries();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const sendInvite = useMutation({
    mutationFn: async () => {
      const { data: me } = await supabase.auth.getUser();
      const { error } = await supabase.from("workspace_invites").insert({
        workspace_id: wsId!,
        email: invite.email.trim().toLowerCase(),
        role: invite.role as never,
        hide_balances: invite.hide_balances,
        invited_by: me.user!.id,
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
          {(data?.members ?? []).map((m: { user_id: string; email: string | null; full_name: string | null; role: string; hide_balances: boolean }) => (
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
                Plano {(data.sub as { plans?: { name?: string; price_cents?: number } }).plans?.name ?? "—"} ·{" "}
                {brl(((data.sub as { plans?: { price_cents?: number } }).plans?.price_cents ?? 0) / 100)}/mês
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

      <Button asChild variant="outline">
        <Link to="/onboarding">Criar novo espaço</Link>
      </Button>
    </div>
  );
}
