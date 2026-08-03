import { query } from "./db.server";

/** 
 * Adaptador PostgreSQL puro para substituir o cliente administrativo.
 */
export async function adminClient() {
  return {
    from: (table: string) => ({
      select: (cols: string, opts?: any) => ({
        eq: (col: string, val: any) => ({
          maybeSingle: async () => {
             const res = await query(`SELECT * FROM ${table} WHERE ${col} = $1 LIMIT 1`, [val]);
             return { data: res.rows[0] || null, error: null };
          }
        }),
        in: (col: string, vals: any[]) => ({
           async execute() {
              const res = await query(`SELECT * FROM ${table} WHERE ${col} = ANY($1)`, [vals]);
              return { data: res.rows, error: null };
           }
        })
      }),
      insert: async (data: any) => {
        const keys = Object.keys(data);
        const placeholders = keys.map((_, i) => `$${i + 1}`).join(", ");
        const res = await query(`INSERT INTO ${table} (${keys.join(", ")}) VALUES (${placeholders}) RETURNING *`, Object.values(data));
        return { data: res.rows[0], error: null };
      },
      update: (patch: any) => ({
        eq: (col: string, val: any) => ({
          async execute() {
            const keys = Object.keys(patch);
            const sets = keys.map((k, i) => `${k} = $${i + 1}`).join(", ");
            const res = await query(`UPDATE ${table} SET ${sets} WHERE ${col} = $${keys.length + 1} RETURNING *`, [...Object.values(patch), val]);
            return { data: res.rows[0], error: null };
          }
        })
      })
    }),
    rpc: async (fn: string, params: any) => {
       if (fn === 'has_role') {
          const res = await query(`SELECT public.has_role($1::uuid, $2::public.app_role) as has_role`, [params._user_id, params._role]);
          return { data: res.rows[0]?.has_role || false, error: null };
       }
       return { data: null, error: new Error('RPC not implemented') };
    }
  } as any;
}

export async function assertPlatformAdmin(db: any, userId: string) {
  const { data } = await db.rpc("has_role", {
    _user_id: userId,
    _role: "platform_admin",
  });
  if (!data) {
    throw new Error("Não autorizado: requer privilégios de administrador da plataforma.");
  }
}

export async function logAdminAction(
  db: any,
  userId: string,
  action: string,
  entity: string,
  entityId: string | null = null,
  meta: any = {},
  workspaceId: string | null = null,
) {
  await db.from("audit_logs").insert({
    user_id: userId,
    workspace_id: workspaceId,
    action,
    entity,
    entity_id: entityId,
    meta,
  });
}
