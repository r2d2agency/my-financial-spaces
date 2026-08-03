import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import {
  adminListAudit,
  adminListPlans,
  adminListWorkspaces,
  adminOverview,
  adminSavePlan,
  adminSendSupportMessage,
  adminSetWorkspaceSuspended,
  adminUpdateSubscription,
  claimPlatformAdmin,
  getAdminStatus,
} from "@/lib/admin.functions";
import { brl, num } from "@/lib/finance";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ShieldCheck, Search } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin")({
  component: AdminPage,
  head: () => ({
    meta: [
      { title: "Administração da plataforma · Espaço Financeiro" },
      {
        name: "description",
        content: "Painel interno para gestão de clientes, planos, assinaturas, suporte e auditoria da plataforma.",
      },
      { property: "og:title", content: "Administração da plataforma" },
      { property: "og:description", content: "Clientes, planos, assinaturas, suporte e auditoria." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const SUB_STATUS = [
  { value: "trialing", label: "Em teste" },
  { value: "active", label: "Ativa" },
  { value: "past_due", label: "Em atraso" },
  { value: "canceled", label: "Cancelada" },
  { value: "suspended", label: "Suspensa" },
] as const;

type PlanForm = {
  id?: string;
  slug: string;
  name: string;
  price: string;
  max_workspaces: string;
  max_users: string;
  max_accounts: string;
  active: boolean;
};

const emptyPlan: PlanForm = {
  slug: "",
  name: "",
  price: "0",
  max_workspaces: "1",
  max_users: "1",
  max_accounts: "3",
  active: true,
};

function AdminPage() {
  const qc = useQueryClient();
  const status = useServerFn(getAdminStatus);
  const claim = useServerFn(claimPlatformAdmin);

  const statusQuery = useQuery({ queryKey: ["admin-status"], queryFn: () => status({}) });

  const claimMutation = useMutation({
    mutationFn: () => claim({}),
    onSuccess: () => {
      toast.success("Você agora é administrador da plataforma.");
      qc.invalidateQueries({ queryKey: ["admin-status"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (statusQuery.isLoading) {
    return <p className="text-sm text-muted-foreground">Verificando permissões...</p>;
  }

  if (!statusQuery.data?.isAdmin) {
    return (
      <Card className="mx-auto max-w-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="size-5 text-primary" /> Área restrita
          </CardTitle>
          <CardDescription>
            Este painel é exclusivo da equipe da plataforma (papel <strong>platform_admin</strong>).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {statusQuery.data?.adminExists ? (
            <p className="text-sm text-muted-foreground">
              Solicite acesso a um administrador existente da plataforma.
            </p>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                Nenhum administrador foi definido ainda. Como esta é a primeira configuração, você pode
                assumir o papel agora — depois disso o botão deixa de funcionar.
              </p>
              <Button onClick={() => claimMutation.mutate()} disabled={claimMutation.isPending}>
                Tornar-me administrador da plataforma
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    );
  }

  return <AdminConsole />;
}

function AdminConsole() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [supportFor, setSupportFor] = useState<{ id: string; name: string } | null>(null);
  const [support, setSupport] = useState({ title: "", body: "" });
  const [planForm, setPlanForm] = useState<PlanForm | null>(null);
  const [auditWs, setAuditWs] = useState("");

  const listWorkspaces = useServerFn(adminListWorkspaces);
  const listPlans = useServerFn(adminListPlans);
  const listAudit = useServerFn(adminListAudit);
  const overview = useServerFn(adminOverview);
  const suspendFn = useServerFn(adminSetWorkspaceSuspended);
  const savePlanFn = useServerFn(adminSavePlan);
  const subFn = useServerFn(adminUpdateSubscription);
  const supportFn = useServerFn(adminSendSupportMessage);

  const stats = useQuery({ queryKey: ["admin-overview"], queryFn: () => overview({}) });
  const clients = useQuery({
    queryKey: ["admin-workspaces", search],
    queryFn: () => listWorkspaces({ data: { search } }),
  });
  const plans = useQuery({ queryKey: ["admin-plans"], queryFn: () => listPlans({}) });
  const audit = useQuery({
    queryKey: ["admin-audit", auditWs],
    queryFn: () => listAudit({ data: { workspaceId: auditWs } }),
  });

  const invalidate = (keys: string[]) =>
    keys.forEach((k) => qc.invalidateQueries({ queryKey: [k] }));

  const suspend = useMutation({
    mutationFn: (v: { workspaceId: string; suspended: boolean }) => suspendFn({ data: v }),
    onSuccess: () => {
      toast.success("Situação do cliente atualizada.");
      invalidate(["admin-workspaces", "admin-audit"]);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateSub = useMutation({
    mutationFn: (v: {
      workspaceId: string;
      planId: string;
      status: (typeof SUB_STATUS)[number]["value"];
      periodEnd: string | null;
    }) => subFn({ data: v }),
    onSuccess: () => {
      toast.success("Assinatura atualizada.");
      invalidate(["admin-workspaces", "admin-plans", "admin-overview", "admin-audit"]);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const savePlan = useMutation({
    mutationFn: (f: PlanForm) =>
      savePlanFn({
        data: {
          ...(f.id ? { id: f.id } : {}),
          slug: f.slug,
          name: f.name,
          price_cents: Math.round(num(f.price) * 100),
          max_workspaces: Math.round(num(f.max_workspaces)),
          max_users: Math.round(num(f.max_users)),
          max_accounts: Math.round(num(f.max_accounts)),
          active: f.active,
        },
      }),
    onSuccess: () => {
      toast.success("Plano salvo.");
      setPlanForm(null);
      invalidate(["admin-plans", "admin-audit"]);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const sendSupport = useMutation({
    mutationFn: () =>
      supportFn({ data: { workspaceId: supportFor!.id, title: support.title, body: support.body } }),
    onSuccess: (r) => {
      toast.success(`Mensagem enviada para ${r.sent} membro(s).`);
      setSupportFor(null);
      setSupport({ title: "", body: "" });
      invalidate(["admin-audit"]);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const cards = [
    { label: "Clientes (espaços)", value: stats.data?.workspaces ?? 0 },
    { label: "Usuários cadastrados", value: stats.data?.users ?? 0 },
    { label: "Assinaturas ativas", value: stats.data?.active ?? 0 },
    { label: "Em período de teste", value: stats.data?.trialing ?? 0 },
    { label: "Atraso / suspensas", value: stats.data?.atRisk ?? 0 },
    { label: "Movimentações lançadas", value: stats.data?.transactions ?? 0 },
  ];

  return (
    <div className="space-y-6">
      <header>
        <h1 className="flex items-center gap-2 text-2xl font-semibold">
          <ShieldCheck className="size-6 text-primary" /> Administração da plataforma
        </h1>
        <p className="text-sm text-muted-foreground">
          Clientes, planos, assinaturas, suporte e trilha de auditoria.
        </p>
      </header>

      <Tabs defaultValue="clientes">
        <TabsList>
          <TabsTrigger value="clientes">Clientes</TabsTrigger>
          <TabsTrigger value="planos">Planos</TabsTrigger>
          <TabsTrigger value="auditoria">Auditoria</TabsTrigger>
        </TabsList>

        <TabsContent value="clientes" className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {cards.map((c: any) => (
              <Card key={c.label}>
                <CardHeader className="pb-2">
                  <CardDescription>{c.label}</CardDescription>
                  <CardTitle className="text-2xl">{c.value}</CardTitle>
                </CardHeader>
              </Card>
            ))}

          </div>

          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Buscar cliente pelo nome do espaço"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="space-y-3">
            {clients.isLoading && <p className="text-sm text-muted-foreground">Carregando clientes...</p>}
            {clients.data?.length === 0 && (
              <p className="text-sm text-muted-foreground">Nenhum cliente encontrado.</p>
            )}
            {clients.data?.map((c: any) => (
              <Card key={c.id}>
                <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
                  <div>
                    <CardTitle className="text-base">{c.name}</CardTitle>
                    <CardDescription>
                      {c.owner_name || c.owner_email || "Proprietário sem perfil"}
                      {c.owner_email ? ` · ${c.owner_email}` : ""} · {c.members} membro(s) · renda prevista{" "}
                      {brl(c.expected_income)}
                    </CardDescription>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {c.suspended ? (
                      <Badge variant="destructive">Suspenso</Badge>
                    ) : (
                      <Badge variant="secondary">Ativo</Badge>
                    )}
                    {!c.onboarding_done && <Badge variant="outline">Onboarding pendente</Badge>}
                    <Badge variant="outline">
                      {c.subscription?.plan_name ?? "Sem plano"} ·{" "}
                      {SUB_STATUS.find((s) => s.value === c.subscription?.status)?.label ?? "Sem assinatura"}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="grid gap-3 md:grid-cols-4">
                  <div className="space-y-1">
                    <Label className="text-xs">Plano</Label>
                    <Select
                      value={c.subscription?.plan_id ?? ""}
                      onValueChange={(planId) =>
                        updateSub.mutate({
                          workspaceId: c.id,
                          planId,
                          status: (c.subscription?.status ?? "trialing") as (typeof SUB_STATUS)[number]["value"],
                          periodEnd: c.subscription?.current_period_end ?? null,
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecionar" />
                      </SelectTrigger>
                      <SelectContent>
                        {(plans.data ?? []).map((p: any) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Situação da assinatura</Label>
                    <Select
                      value={c.subscription?.status ?? ""}
                      onValueChange={(st) =>
                        updateSub.mutate({
                          workspaceId: c.id,
                          planId: c.subscription?.plan_id ?? (plans.data?.[0]?.id ?? ""),
                          status: st as (typeof SUB_STATUS)[number]["value"],
                          periodEnd: c.subscription?.current_period_end ?? null,
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecionar" />
                      </SelectTrigger>
                      <SelectContent>
                        {SUB_STATUS.map((s) => (
                          <SelectItem key={s.value} value={s.value}>
                            {s.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Vigente até</Label>
                    <Input
                      type="date"
                      defaultValue={c.subscription?.current_period_end ?? ""}
                      onBlur={(e) =>
                        e.target.value !== (c.subscription?.current_period_end ?? "") &&
                        updateSub.mutate({
                          workspaceId: c.id,
                          planId: c.subscription?.plan_id ?? (plans.data?.[0]?.id ?? ""),
                          status: (c.subscription?.status ?? "trialing") as (typeof SUB_STATUS)[number]["value"],
                          periodEnd: e.target.value || null,
                        })
                      }
                    />
                  </div>
                  <div className="flex items-end gap-2">
                    <Button variant="outline" size="sm" onClick={() => setSupportFor({ id: c.id, name: c.name })}>
                      Suporte
                    </Button>
                    <Button
                      variant={c.suspended ? "default" : "destructive"}
                      size="sm"
                      onClick={() => suspend.mutate({ workspaceId: c.id, suspended: !c.suspended })}
                    >
                      {c.suspended ? "Reativar" : "Suspender"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="planos" className="space-y-4">
          <Button onClick={() => setPlanForm({ ...emptyPlan })}>Novo plano</Button>
          <div className="grid gap-3 md:grid-cols-2">
            {(plans.data ?? []).map((p: any) => (
              <Card key={p.id}>
                <CardHeader>
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle className="text-base">{p.name}</CardTitle>
                    <Badge variant={p.active ? "secondary" : "outline"}>{p.active ? "Ativo" : "Inativo"}</Badge>
                  </div>
                  <CardDescription>
                    {brl((p.price_cents ?? 0) / 100)}/mês · {p.subscribers} assinatura(s)
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2 text-sm text-muted-foreground">
                  <p>
                    Limites: {p.max_workspaces} espaço(s) · {p.max_users} usuário(s) · {p.max_accounts} conta(s)
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setPlanForm({
                        id: p.id,
                        slug: p.slug,
                        name: p.name,
                        price: String((p.price_cents ?? 0) / 100),
                        max_workspaces: String(p.max_workspaces),
                        max_users: String(p.max_users),
                        max_accounts: String(p.max_accounts),
                        active: p.active,
                      })
                    }
                  >
                    Editar
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="auditoria" className="space-y-4">
          <Select value={auditWs || "all"} onValueChange={(v) => setAuditWs(v === "all" ? "" : v)}>
            <SelectTrigger className="max-w-sm">
              <SelectValue placeholder="Todos os clientes" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os clientes</SelectItem>
              {(clients.data ?? []).map((c: any) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Card>
            <CardContent className="divide-y p-0">
              {audit.data?.length === 0 && (
                <p className="p-4 text-sm text-muted-foreground">Nenhum evento registrado.</p>
              )}
              {(audit.data ?? []).map((a: any) => (
                <div key={a.id} className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
                  <div>
                    <p className="font-medium">{a.action}</p>
                    <p className="text-xs text-muted-foreground">
                      {a.entity ?? "—"} {a.entity_id ? `· ${a.entity_id.slice(0, 8)}` : ""}
                    </p>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {new Date(a.created_at).toLocaleString("pt-BR")}
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={!!supportFor} onOpenChange={(o) => !o && setSupportFor(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Suporte · {supportFor?.name}</DialogTitle>
            <DialogDescription>
              A mensagem chega como notificação para todos os membros do espaço e fica registrada na auditoria.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Assunto</Label>
              <Input
                value={support.title}
                onChange={(e) => setSupport({ ...support, title: e.target.value })}
                placeholder="Ex.: Retorno sobre sua solicitação"
              />
            </div>
            <div className="space-y-1">
              <Label>Mensagem</Label>
              <Textarea
                rows={5}
                value={support.body}
                onChange={(e) => setSupport({ ...support, body: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={() => sendSupport.mutate()}
              disabled={sendSupport.isPending || !support.title.trim() || !support.body.trim()}
            >
              Enviar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!planForm} onOpenChange={(o) => !o && setPlanForm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{planForm?.id ? "Editar plano" : "Novo plano"}</DialogTitle>
            <DialogDescription>Preços em reais por mês e limites de uso do plano.</DialogDescription>
          </DialogHeader>
          {planForm && (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label>Nome</Label>
                <Input
                  value={planForm.name}
                  onChange={(e) => setPlanForm({ ...planForm, name: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label>Identificador (slug)</Label>
                <Input
                  value={planForm.slug}
                  onChange={(e) => setPlanForm({ ...planForm, slug: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label>Preço mensal (R$)</Label>
                <Input
                  inputMode="decimal"
                  value={planForm.price}
                  onChange={(e) => setPlanForm({ ...planForm, price: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label>Máx. espaços</Label>
                <Input
                  inputMode="numeric"
                  value={planForm.max_workspaces}
                  onChange={(e) => setPlanForm({ ...planForm, max_workspaces: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label>Máx. usuários</Label>
                <Input
                  inputMode="numeric"
                  value={planForm.max_users}
                  onChange={(e) => setPlanForm({ ...planForm, max_users: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label>Máx. contas</Label>
                <Input
                  inputMode="numeric"
                  value={planForm.max_accounts}
                  onChange={(e) => setPlanForm({ ...planForm, max_accounts: e.target.value })}
                />
              </div>
              <div className="flex items-center gap-2 sm:col-span-2">
                <Switch
                  checked={planForm.active}
                  onCheckedChange={(v) => setPlanForm({ ...planForm, active: v })}
                />
                <Label>Plano disponível para novas assinaturas</Label>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              onClick={() => planForm && savePlan.mutate(planForm)}
              disabled={savePlan.isPending || !planForm?.name.trim() || !planForm?.slug.trim()}
            >
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}