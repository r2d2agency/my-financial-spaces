import type { SupabaseClient } from "@supabase/supabase-js";

/** Throws unless the caller holds the platform_admin role. */
export async function assertPlatformAdmin(supabase: SupabaseClient, userId: string) {
  const { data, error } = await supabase.rpc("has_role", {
    _user_id: userId,
    _role: "platform_admin",
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Acesso restrito à administração da plataforma.");
}

export async function adminClient() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export async function logAdminAction(
  admin: Awaited<ReturnType<typeof adminClient>>,
  userId: string,
  action: string,
  entity: string,
  entityId: string | null,
  meta: Record<string, unknown> = {},
  workspaceId: string | null = null,
) {
  await admin.from("audit_logs").insert({
    workspace_id: workspaceId,
    user_id: userId,
    action,
    entity,
    entity_id: entityId,
    meta: meta as never,
  });
}