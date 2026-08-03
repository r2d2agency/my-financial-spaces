import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

// This server-side client is only used in server functions.
// It uses the service role key to bypass RLS.

export async function adminClient() {
  const url = process.env["SUPABASE_URL"];
  const key = process.env["SUPABASE_SERVICE_ROLE_KEY"];

  if (!url || !key) {
    if (process.env["DATABASE_URL"]) {
        console.warn("[Database] Utilizando conexão direta (DATABASE_URL) para tarefas administrativas pois as chaves do Supabase não foram encontradas.");
    } else {
        throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    }
  }

  return createClient<Database>(url || "http://localhost:8000", key || "dummy-key", {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export async function assertPlatformAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase.rpc("has_role", {
    _user_id: userId,
    _role: "platform_admin",
  });
  if (error || !data) {
    throw new Error("Não autorizado: requer privilégios de administrador da plataforma.");
  }
}

export async function logAdminAction(
  supabase: any,
  userId: string,
  action: string,
  entity: string,
  entityId: string | null = null,
  meta: any = {},
  workspaceId: string | null = null,
) {
  await supabase.from("audit_logs").insert({
    user_id: userId,
    workspace_id: workspaceId,
    action,
    entity,
    entity_id: entityId,
    meta,
  });
}
