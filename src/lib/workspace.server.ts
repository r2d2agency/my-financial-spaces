import { query } from "./db.server";

export async function checkUserByEmail(email: string) {
  const res = await query(
    "SELECT id, email FROM auth.users WHERE lower(trim(email)) = lower(trim($1))",
    [email]
  );
  return res.rows[0] || null;
}

export async function createMembership(workspaceId: string, userId: string, role: string) {
  await query(
    `INSERT INTO public.workspace_members (workspace_id, user_id, role) 
     VALUES ($1, $2, $3)
     ON CONFLICT (workspace_id, user_id) DO UPDATE SET role = EXCLUDED.role`,
    [workspaceId, userId, role]
  );
}

export async function getInviteByToken(token: string) {
  const res = await query(
    `SELECT i.*, w.name as workspace_name 
     FROM public.workspace_invites i
     JOIN public.workspaces w ON w.id = i.workspace_id
     WHERE i.token = $1 AND i.status = 'pending' AND i.expires_at > NOW()`,
    [token]
  );
  return res.rows[0] || null;
}

export async function markInviteAccepted(inviteId: string) {
  await query(
    "UPDATE public.workspace_invites SET status = 'accepted' WHERE id = $1",
    [inviteId]
  );
}

export async function checkExistingMembership(workspaceId: string, userId: string) {
  const res = await query(
    "SELECT role FROM public.workspace_members WHERE workspace_id = $1 AND user_id = $2",
    [workspaceId, userId]
  );
  return res.rows[0] || null;
}
