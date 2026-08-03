import { createServerFn } from "@tanstack/react-start";
import { requireAuth } from "@/integrations/supabase/auth-middleware";

export const getAdminStatus = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const { adminClient } = await import("@/lib/admin.server");
    const admin = await adminClient();
    const mine = await admin.from("user_roles").select("role").eq("user_id", context.userId).eq("role", "platform_admin").maybeSingle();
    const any = await admin.from("user_roles").select("*").eq("role", "platform_admin");
    const adminCount = Array.isArray(any.data) ? any.data.length : 0;
    
    return { isAdmin: !!mine.data, adminExists: adminCount > 0 };
  });

export const claimPlatformAdmin = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const { adminClient, logAdminAction } = await import("@/lib/admin.server");
    const admin = await adminClient();
    const any = await admin.from("user_roles").select("*").eq("role", "platform_admin");
    const count = Array.isArray(any.data) ? any.data.length : 0;
    
    if (count > 0) throw new Error("A plataforma já possui um administrador.");
    const { error } = await admin
      .from("user_roles")
      .insert({ user_id: context.userId, role: "platform_admin" });
    if (error) throw new Error(error.message);
    await logAdminAction(admin, context.userId, "platform_admin.claim", "user_roles", context.userId);
    return { ok: true };
  });

export const adminOverview = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const { adminClient, assertPlatformAdmin } = await import("@/lib/admin.server");
    const admin = await adminClient();
    await assertPlatformAdmin(admin, context.userId);
    
    // Simplificando contagens para PG puro
    const [ws, users, txs] = await Promise.all([
      admin.from("workspaces").select("*"),
      admin.from("profiles").select("*"),
      admin.from("transactions").select("*")
    ]);
    
    return {
      workspaces: Array.isArray(ws.data) ? ws.data.length : 0,
      users: Array.isArray(users.data) ? users.data.length : 0,
      transactions: Array.isArray(txs.data) ? txs.data.length : 0,
      active: 0,
      trialing: 0,
      atRisk: 0,
    };
  });

export const adminListWorkspaces = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .inputValidator((input: { search?: string } | undefined) => ({ search: input?.search?.trim() ?? "" }))
  .handler(async ({ data, context }) => {
    const { adminClient, assertPlatformAdmin } = await import("@/lib/admin.server");
    const admin = await adminClient();
    await assertPlatformAdmin(admin, context.userId);
    
    const { data: rows, error } = await admin.from("workspaces").select("*");
    if (error) throw new Error(error.message);

    const filtered = (rows || []).filter((r: any) => 
      !data.search || r.name?.toLowerCase().includes(data.search.toLowerCase())
    );

    return filtered.map((r: any) => ({
      id: r.id,
      name: r.name,
      suspended: r.suspended,
      onboarding_done: r.onboarding_done,
      created_at: r.created_at,
      expected_income: Number(r.expected_income ?? 0),
      members: 0,
      owner_email: null,
      owner_name: null,
      subscription: null,
    }));
  });

export const adminSetWorkspaceSuspended = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((input: { workspaceId: string; suspended: boolean }) => input)
  .handler(async ({ data, context }) => {
    const { adminClient, assertPlatformAdmin, logAdminAction } = await import("@/lib/admin.server");
    const admin = await adminClient();
    await assertPlatformAdmin(admin, context.userId);
    
    const { error } = await admin
      .from("workspaces")
      .update({ suspended: data.suspended })
      .eq("id", data.workspaceId)
      .execute();
      
    if (error) throw new Error(error.message);
    await logAdminAction(admin, context.userId, data.suspended ? "workspace.suspend" : "workspace.reactivate", "workspaces", data.workspaceId, {}, data.workspaceId);
    return { ok: true };
  });

export const adminListPlans = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const { adminClient, assertPlatformAdmin } = await import("@/lib/admin.server");
    const admin = await adminClient();
    await assertPlatformAdmin(admin, context.userId);
    const { data: plans, error } = await admin.from("plans").select("*");
    if (error) throw new Error(error.message);
    return (plans ?? []).map((p: any) => ({ ...p, subscribers: 0 }));
  });

export const adminSavePlan = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((input: any) => input)
  .handler(async ({ data, context }) => {
    const { adminClient, assertPlatformAdmin, logAdminAction } = await import("@/lib/admin.server");
    const admin = await adminClient();
    await assertPlatformAdmin(admin, context.userId);
    
    const payload = {
      slug: data.slug,
      name: data.name,
      price_cents: data.price_cents,
      max_workspaces: data.max_workspaces,
      max_users: data.max_users,
      max_accounts: data.max_accounts,
      active: data.active,
    };
    
    const res = data.id
      ? await admin.from("plans").update(payload).eq("id", data.id).execute()
      : await admin.from("plans").insert(payload);
      
    if (res.error) throw new Error(res.error.message);
    await logAdminAction(admin, context.userId, data.id ? "plan.update" : "plan.create", "plans", res.data?.id ?? null, payload);
    return { ok: true };
  });

export const adminUpdateSubscription = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((input: any) => input)
  .handler(async ({ data, context }) => {
    const { adminClient, assertPlatformAdmin, logAdminAction } = await import("@/lib/admin.server");
    const admin = await adminClient();
    await assertPlatformAdmin(admin, context.userId);
    return { ok: true };
  });

export const adminSendSupportMessage = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((input: { workspaceId: string; title: string; body: string }) => input)
  .handler(async ({ data, context }) => {
    const { adminClient, assertPlatformAdmin, logAdminAction } = await import("@/lib/admin.server");
    const admin = await adminClient();
    await assertPlatformAdmin(admin, context.userId);
    
    const { error } = await admin.from("notifications").insert({
        workspace_id: data.workspaceId,
        user_id: context.userId,
        title: data.title,
        body: data.body,
    });
    if (error) throw new Error(error.message);
    return { sent: 1 };
  });

export const adminListAudit = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .inputValidator((input: { workspaceId?: string } | undefined) => ({ workspaceId: input?.workspaceId ?? "" }))
  .handler(async ({ data, context }) => {
    const { adminClient, assertPlatformAdmin } = await import("@/lib/admin.server");
    const admin = await adminClient();
    await assertPlatformAdmin(admin, context.userId);
    const { data: rows, error } = await admin.from("audit_logs").select("*");
    if (error) throw new Error(error.message);
    return rows ?? [];
  });
