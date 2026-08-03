import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getAdminStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { adminClient } = await import("@/lib/admin.server");
    const admin = await adminClient();
    const [mine, any] = await Promise.all([
      admin.from("user_roles").select("role").eq("user_id", context.userId).eq("role", "platform_admin").maybeSingle(),
      admin.from("user_roles").select("id", { count: "exact", head: true }).eq("role", "platform_admin"),
    ]);
    return { isAdmin: !!mine.data, adminExists: (any.count ?? 0) > 0 };
  });

/** Bootstrap: only allowed while the platform has no admin yet. */
export const claimPlatformAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { adminClient, logAdminAction } = await import("@/lib/admin.server");
    const admin = await adminClient();
    const { count } = await admin
      .from("user_roles")
      .select("id", { count: "exact", head: true })
      .eq("role", "platform_admin");
    if ((count ?? 0) > 0) throw new Error("A plataforma já possui um administrador.");
    const { error } = await admin
      .from("user_roles")
      .insert({ user_id: context.userId, role: "platform_admin" });
    if (error) throw new Error(error.message);
    await logAdminAction(admin, context.userId, "platform_admin.claim", "user_roles", context.userId);
    return { ok: true };
  });

export const adminOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { adminClient, assertPlatformAdmin } = await import("@/lib/admin.server");
    await assertPlatformAdmin(context.supabase, context.userId);
    const admin = await adminClient();
    const head = { count: "exact" as const, head: true };
    const [ws, users, txs, subsActive, subsTrial, subsLate] = await Promise.all([
      admin.from("workspaces").select("id", head),
      admin.from("profiles").select("id", head),
      admin.from("transactions").select("id", head),
      admin.from("subscriptions").select("id", head).eq("status", "active"),
      admin.from("subscriptions").select("id", head).eq("status", "trialing"),
      admin.from("subscriptions").select("id", head).in("status", ["past_due", "suspended"]),
    ]);
    return {
      workspaces: ws.count ?? 0,
      users: users.count ?? 0,
      transactions: txs.count ?? 0,
      active: subsActive.count ?? 0,
      trialing: subsTrial.count ?? 0,
      atRisk: subsLate.count ?? 0,
    };
  });

export const adminListWorkspaces = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { search?: string } | undefined) => ({ search: input?.search?.trim() ?? "" }))
  .handler(async ({ data, context }) => {
    const { adminClient, assertPlatformAdmin } = await import("@/lib/admin.server");
    await assertPlatformAdmin(context.supabase, context.userId);
    const admin = await adminClient();
    let q = admin
      .from("workspaces")
      .select(
        "id, name, owner_id, suspended, expected_income, onboarding_done, created_at, subscriptions(id, status, current_period_end, plan_id, plans(name, slug)), workspace_members(id)",
      )
      .order("created_at", { ascending: false })
      .limit(200);
    if (data.search) q = q.ilike("name", `%${data.search}%`);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);

    const ownerIds = [...new Set((rows ?? []).map((r) => r.owner_id))];
    const { data: owners } = ownerIds.length
      ? await admin.from("profiles").select("id, email, full_name").in("id", ownerIds)
      : { data: [] as { id: string; email: string | null; full_name: string | null }[] };

    return (rows ?? []).map((r) => {
      const owner = (owners ?? []).find((o) => o.id === r.owner_id) ?? null;
      const sub = Array.isArray(r.subscriptions) ? r.subscriptions[0] : r.subscriptions;
      return {
        id: r.id,
        name: r.name,
        suspended: r.suspended,
        onboarding_done: r.onboarding_done,
        created_at: r.created_at,
        expected_income: Number(r.expected_income ?? 0),
        members: Array.isArray(r.workspace_members) ? r.workspace_members.length : 0,
        owner_email: owner?.email ?? null,
        owner_name: owner?.full_name ?? null,
        subscription: sub
          ? {
              id: sub.id,
              status: sub.status,
              current_period_end: sub.current_period_end,
              plan_id: sub.plan_id,
              plan_name: sub.plans?.name ?? null,
            }
          : null,
      };
    });
  });

export const adminSetWorkspaceSuspended = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { workspaceId: string; suspended: boolean }) => input)
  .handler(async ({ data, context }) => {
    const { adminClient, assertPlatformAdmin, logAdminAction } = await import("@/lib/admin.server");
    await assertPlatformAdmin(context.supabase, context.userId);
    const admin = await adminClient();
    const { error } = await admin
      .from("workspaces")
      .update({ suspended: data.suspended })
      .eq("id", data.workspaceId);
    if (error) throw new Error(error.message);
    await logAdminAction(
      admin,
      context.userId,
      data.suspended ? "workspace.suspend" : "workspace.reactivate",
      "workspaces",
      data.workspaceId,
      {},
      data.workspaceId,
    );
    return { ok: true };
  });

export const adminListPlans = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { adminClient, assertPlatformAdmin } = await import("@/lib/admin.server");
    await assertPlatformAdmin(context.supabase, context.userId);
    const admin = await adminClient();
    const [{ data: plans, error }, { data: subs }] = await Promise.all([
      admin.from("plans").select("*").order("price_cents", { ascending: true }),
      admin.from("subscriptions").select("plan_id"),
    ]);
    if (error) throw new Error(error.message);
    return (plans ?? []).map((p) => ({
      ...p,
      subscribers: (subs ?? []).filter((s) => s.plan_id === p.id).length,
    }));
  });

export const adminSavePlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      id?: string;
      slug: string;
      name: string;
      price_cents: number;
      max_workspaces: number;
      max_users: number;
      max_accounts: number;
      active: boolean;
    }) => input,
  )
  .handler(async ({ data, context }) => {
    const { adminClient, assertPlatformAdmin, logAdminAction } = await import("@/lib/admin.server");
    await assertPlatformAdmin(context.supabase, context.userId);
    const admin = await adminClient();
    const payload = {
      slug: data.slug.trim().toLowerCase(),
      name: data.name.trim(),
      price_cents: Math.max(0, Math.round(data.price_cents)),
      max_workspaces: data.max_workspaces,
      max_users: data.max_users,
      max_accounts: data.max_accounts,
      active: data.active,
    };
    const res = data.id
      ? await admin.from("plans").update(payload).eq("id", data.id).select("id").maybeSingle()
      : await admin.from("plans").insert(payload).select("id").maybeSingle();
    if (res.error) throw new Error(res.error.message);
    await logAdminAction(
      admin,
      context.userId,
      data.id ? "plan.update" : "plan.create",
      "plans",
      res.data?.id ?? null,
      payload,
    );
    return { ok: true };
  });

export const adminUpdateSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      workspaceId: string;
      planId: string;
      status: "trialing" | "active" | "past_due" | "canceled" | "suspended";
      periodEnd: string | null;
    }) => input,
  )
  .handler(async ({ data, context }) => {
    const { adminClient, assertPlatformAdmin, logAdminAction } = await import("@/lib/admin.server");
    await assertPlatformAdmin(context.supabase, context.userId);
    const admin = await adminClient();
    const patch = {
      plan_id: data.planId,
      status: data.status,
      current_period_end: data.periodEnd || null,
    };
    const existing = await admin
      .from("subscriptions")
      .select("id")
      .eq("workspace_id", data.workspaceId)
      .maybeSingle();
    const res = existing.data
      ? await admin.from("subscriptions").update(patch).eq("id", existing.data.id)
      : await admin.from("subscriptions").insert({ workspace_id: data.workspaceId, ...patch });
    if (res.error) throw new Error(res.error.message);
    await logAdminAction(
      admin,
      context.userId,
      "subscription.update",
      "subscriptions",
      existing.data?.id ?? null,
      patch,
      data.workspaceId,
    );
    return { ok: true };
  });

export const adminSendSupportMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { workspaceId: string; title: string; body: string }) => input)
  .handler(async ({ data, context }) => {
    const { adminClient, assertPlatformAdmin, logAdminAction } = await import("@/lib/admin.server");
    await assertPlatformAdmin(context.supabase, context.userId);
    const admin = await adminClient();
    const { data: members, error } = await admin
      .from("workspace_members")
      .select("user_id")
      .eq("workspace_id", data.workspaceId);
    if (error) throw new Error(error.message);
    if (!members?.length) throw new Error("Espaço sem membros para notificar.");
    const title = data.title.trim().slice(0, 120);
    const body = data.body.trim().slice(0, 2000);
    const ins = await admin.from("notifications").insert(
      members.map((m) => ({
        workspace_id: data.workspaceId,
        user_id: m.user_id,
        title,
        body,
      })),
    );
    if (ins.error) throw new Error(ins.error.message);
    await logAdminAction(
      admin,
      context.userId,
      "support.message",
      "notifications",
      null,
      { title, recipients: members.length },
      data.workspaceId,
    );
    return { sent: members.length };
  });

export const adminListAudit = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { workspaceId?: string } | undefined) => ({ workspaceId: input?.workspaceId ?? "" }))
  .handler(async ({ data, context }) => {
    const { adminClient, assertPlatformAdmin } = await import("@/lib/admin.server");
    await assertPlatformAdmin(context.supabase, context.userId);
    const admin = await adminClient();
    let q = admin
      .from("audit_logs")
      .select("id, action, entity, entity_id, workspace_id, user_id, meta, created_at")
      .order("created_at", { ascending: false })
      .limit(150);
    if (data.workspaceId) q = q.eq("workspace_id", data.workspaceId);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });