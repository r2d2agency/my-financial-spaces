import { createServerFn } from "@tanstack/react-start";
import { requireAuth } from "./auth-middleware.server";

export const getAdminStatus = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const { adminClient } = await import("@/lib/admin.server");
    const admin = await adminClient();
    const mine = await admin.from("user_roles").select("role").eq("user_id", context!.userId).eq("role", "platform_admin").maybeSingle();
    const any = await admin.from("user_roles").select("*").eq("role", "platform_admin");
    const adminCount = Array.isArray(any.data) ? any.data.length : 0;
    
    return { isAdmin: !!mine.data, adminExists: adminCount > 0 };
  });

export const claimPlatformAdmin = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const { adminClient, logAdminAction } = await import("@/lib/admin.server");
    const admin = await adminClient();
    
    const any = await admin.from("user_roles").select("*").eq("role", "platform_admin").execute();
    const count = Array.isArray(any.data) ? any.data.length : 0;
    
    if (count > 0) throw new Error("A plataforma já possui um administrador.");
    
    const { error } = await admin
      .from("user_roles")
      .insert({ user_id: context!.userId, role: "platform_admin" });
      
    if (error) throw new Error(error.message);
    
    await logAdminAction(admin, context!.userId, "platform_admin.claim", "user_roles", context!.userId);
    return { ok: true };
  });


export const adminOverview = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const { adminClient, assertPlatformAdmin } = await import("@/lib/admin.server");
    const admin = await adminClient();
    await assertPlatformAdmin(admin, context!.userId);
    
    const { query } = await import("@/lib/db.server");
    
    const [wsRes, usersRes, txsRes, activeRes, trialingRes, riskRes] = await Promise.all([
      query("SELECT count(*) FROM public.workspaces"),
      query("SELECT count(*) FROM auth.users"),
      query("SELECT count(*) FROM public.transactions"),
      query("SELECT count(*) FROM public.subscriptions WHERE status = 'active'"),
      query("SELECT count(*) FROM public.subscriptions WHERE status = 'trialing'"),
      query("SELECT count(*) FROM public.subscriptions WHERE status IN ('past_due', 'suspended')")
    ]);
    
    return {
      workspaces: parseInt(wsRes.rows[0].count),
      users: parseInt(usersRes.rows[0].count),
      transactions: parseInt(txsRes.rows[0].count),
      active: parseInt(activeRes.rows[0].count),
      trialing: parseInt(trialingRes.rows[0].count),
      atRisk: parseInt(riskRes.rows[0].count),
    };
  });

export const adminListWorkspaces = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .validator((input: { search?: string } | undefined) => ({ search: input?.search?.trim() ?? "" }))
  .handler(async ({ data, context }) => {
    const { adminClient, assertPlatformAdmin } = await import("@/lib/admin.server");
    const admin = await adminClient();
    await assertPlatformAdmin(admin, context!.userId);
    
    const { query } = await import("@/lib/db.server");
    let sql = `
      SELECT 
        w.*, 
        p.full_name as owner_name, 
        p.email as owner_email,
        s.status as sub_status,
        s.current_period_end,
        s.plan_id,
        pl.name as plan_name,
        (SELECT count(*) FROM public.workspace_members WHERE workspace_id = w.id) as members_count
      FROM public.workspaces w
      LEFT JOIN public.profiles p ON p.id = w.owner_id
      LEFT JOIN public.subscriptions s ON s.workspace_id = w.id
      LEFT JOIN public.plans pl ON pl.id = s.plan_id
    `;
    const params: any[] = [];
    if (data.search) {
      sql += " WHERE w.name ILIKE $1";
      params.push(`%${data.search}%`);
    }
    sql += " ORDER BY w.created_at DESC";

    const res = await query(sql, params);

    return res.rows.map((r: any) => ({
      id: r.id,
      name: r.name,
      suspended: r.suspended,
      onboarding_done: r.onboarding_done,
      created_at: r.created_at,
      expected_income: Number(r.expected_income ?? 0),
      members: parseInt(r.members_count || 0),
      owner_email: r.owner_email,
      owner_name: r.owner_name,
      subscription: {
        status: r.sub_status,
        plan_id: r.plan_id,
        plan_name: r.plan_name,
        current_period_end: r.current_period_end ? new Date(r.current_period_end).toISOString().split('T')[0] : null
      },
    }));
  });

export const adminSetWorkspaceSuspended = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((input: { workspaceId: string; suspended: boolean }) => input)
  .handler(async ({ data, context }) => {
    const { adminClient, assertPlatformAdmin, logAdminAction } = await import("@/lib/admin.server");
    const admin = await adminClient();
    await assertPlatformAdmin(admin, context!.userId);
    
    const { error } = await admin
      .from("workspaces")
      .update({ suspended: data.suspended })
      .eq("id", data.workspaceId)
      .execute();
      
    if (error) throw new Error(error.message);
    await logAdminAction(admin, context!.userId, data.suspended ? "workspace.suspend" : "workspace.reactivate", "workspaces", data.workspaceId, {}, data.workspaceId);
    return { ok: true };
  });

export const adminListPlans = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const { adminClient, assertPlatformAdmin } = await import("@/lib/admin.server");
    const admin = await adminClient();
    await assertPlatformAdmin(admin, context!.userId);
    const { query } = await import("@/lib/db.server");
    const res = await query(`
      SELECT p.*, (SELECT count(*) FROM public.subscriptions WHERE plan_id = p.id) as subscribers_count 
      FROM public.plans p 
      ORDER BY p.price_cents ASC
    `);
    return res.rows.map((p: any) => ({ ...p, subscribers: parseInt(p.subscribers_count || 0) }));
  });

export const adminSavePlan = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((input: any) => input)
  .handler(async ({ data, context }) => {
    const { adminClient, assertPlatformAdmin, logAdminAction } = await import("@/lib/admin.server");
    const admin = await adminClient();
    await assertPlatformAdmin(admin, context!.userId);
    
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
    await logAdminAction(admin, context!.userId, data.id ? "plan.update" : "plan.create", "plans", res.data?.id ?? null, payload);
    return { ok: true };
  });

export const adminUpdateSubscription = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((input: any) => input)
  .handler(async ({ data, context }) => {
    const { adminClient, assertPlatformAdmin, logAdminAction } = await import("@/lib/admin.server");
    const { query } = await import("@/lib/db.server");
    const admin = await adminClient();
    await assertPlatformAdmin(admin, context!.userId);
    
    // Upsert subscription
    const existing = await query("SELECT id FROM public.subscriptions WHERE workspace_id = $1", [data.workspaceId]);
    
    if (existing.rows.length > 0) {
      await query(
        "UPDATE public.subscriptions SET plan_id = $1, status = $2, current_period_end = $3, updated_at = NOW() WHERE workspace_id = $4",
        [data.planId, data.status, data.periodEnd, data.workspaceId]
      );
    } else {
      await query(
        "INSERT INTO public.subscriptions (workspace_id, plan_id, status, current_period_end) VALUES ($1, $2, $3, $4)",
        [data.workspaceId, data.planId, data.status, data.periodEnd]
      );
    }

    await logAdminAction(admin, context!.userId, "subscription.update", "subscriptions", data.workspaceId, data, data.workspaceId);
    return { ok: true };
  });

export const adminSendSupportMessage = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((input: { workspaceId: string; title: string; body: string }) => input)
  .handler(async ({ data, context }) => {
    const { adminClient, assertPlatformAdmin, logAdminAction } = await import("@/lib/admin.server");
    const admin = await adminClient();
    await assertPlatformAdmin(admin, context!.userId);
    
    const { error } = await admin.from("notifications").insert({
        workspace_id: data.workspaceId,
        user_id: context!.userId,
        title: data.title,
        body: data.body,
    });
    if (error) throw new Error(error.message);
    return { sent: 1 };
  });

export const adminListAudit = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .validator((input: { workspaceId?: string } | undefined) => ({ workspaceId: input?.workspaceId ?? "" }))
  .handler(async ({ data, context }) => {
    const { adminClient, assertPlatformAdmin } = await import("@/lib/admin.server");
    const admin = await adminClient();
    await assertPlatformAdmin(admin, context!.userId);
    const { query } = await import("@/lib/db.server");
    let sql = "SELECT * FROM public.audit_logs";
    const params: any[] = [];
    if (data.workspaceId) {
      sql += " WHERE workspace_id = $1";
      params.push(data.workspaceId);
    }
    sql += " ORDER BY created_at DESC LIMIT 100";
    const res = await query(sql, params);
    return res.rows;
  });
