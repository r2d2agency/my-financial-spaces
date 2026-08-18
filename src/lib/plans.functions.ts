import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { query } from "./db.server";
import { getSession } from "./auth.server";
import { getRequest } from "@tanstack/react-start/server";

const verifyAuth = async () => {
  const request = getRequest();
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.replace("Bearer ", "");
  if (!token) throw new Error("Não autorizado");
  const session = await getSession(token);
  if (!session) throw new Error("Sessão inválida");
  return session.user_id;
};

const verifyAdmin = async (userId: string) => {
  const res = await query(
    "SELECT 1 FROM public.user_roles WHERE user_id = $1 AND role = 'platform_admin'",
    [userId]
  );
  if (res.rows.length === 0) throw new Error("Acesso negado: Requer administrador da plataforma");
};

export const listPlans = createServerFn({ method: "GET" })
  .handler(async () => {
    const userId = await verifyAuth();
    const res = await query("SELECT * FROM public.plans WHERE active = true ORDER BY price_cents ASC");
    return res.rows;
  });

export const updateWorkspacePlan = createServerFn({ method: "POST" })
  .validator((data: unknown) => 
    z.object({
      workspaceId: z.string(),
      planId: z.string()
    }).parse(data)
  )
  .handler(async ({ data }) => {
    const userId = await verifyAuth();
    await verifyAdmin(userId);
    
    await query(
      "UPDATE public.subscriptions SET plan_id = $1, updated_at = NOW() WHERE workspace_id = $2",
      [data.planId, data.workspaceId]
    );
    
    return { success: true };
  });

export const listAllWorkspaces = createServerFn({ method: "GET" })
  .handler(async () => {
    const userId = await verifyAuth();
    await verifyAdmin(userId);
    
    const res = await query(`
      SELECT 
        w.*, 
        p.full_name as owner_name, 
        p.email as owner_email,
        pl.name as plan_name,
        (SELECT count(*) FROM public.workspace_members WHERE workspace_id = w.id) as user_count
      FROM public.workspaces w
      JOIN public.profiles p ON p.id = w.owner_id
      LEFT JOIN public.subscriptions s ON s.workspace_id = w.id
      LEFT JOIN public.plans pl ON pl.id = s.plan_id
      ORDER BY w.created_at DESC
    `);
    
    return res.rows;
  });
