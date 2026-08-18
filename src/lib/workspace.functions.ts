import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSession } from "./auth.server";
import { getRequest } from "@tanstack/react-start/server";
import { query } from "./db.server";
import { 
  checkUserByEmail, 
  createMembership, 
  getInviteByToken, 
  markInviteAccepted,
  checkExistingMembership 
} from "./workspace.server";

const verifyAuth = async (workspaceId: string, requiredRoles: string[] = ['owner', 'admin']) => {
  const request = getRequest();
  const authHeader = request.headers.get('authorization');
  const token = authHeader?.replace('Bearer ', '');
  if (!token) throw new Error("Não autorizado");
  
  const session = await getSession(token);
  if (!session) throw new Error("Sessão inválida");
  
  const userId = session.user_id;

  const access = await query(
    "SELECT role FROM public.workspace_members WHERE workspace_id = $1 AND user_id = $2",
    [workspaceId, userId]
  );
  
  if (access.rows.length === 0) {
    throw new Error("Acesso negado.");
  }

  const userRole = access.rows[0].role;
  if (!requiredRoles.includes(userRole)) {
    throw new Error("Você não tem permissão para esta ação.");
  }

  return userId;
};

export const inviteMember = createServerFn({ method: "POST" })
  .validator((data: unknown) =>
    z.object({
      workspaceId: z.string().uuid(),
      email: z.string().email(),
      role: z.enum(['admin', 'manager', 'operator', 'viewer']),
    }).parse(data)
  )
  .handler(async ({ data }) => {
    const inviterId = await verifyAuth(data.workspaceId);
    const email = data.email.toLowerCase().trim();

    // 1. Verificar se já é membro
    const user = await checkUserByEmail(email);
    if (user) {
      const existing = await checkExistingMembership(data.workspaceId, user.id);
      if (existing) {
        throw new Error("Este usuário já possui acesso a este espaço.");
      }
      
      // Se usuário existe, cria membership direto
      await createMembership(data.workspaceId, user.id, data.role);
      return { success: true, type: 'membership' };
    }

    // 2. Verificar convites pendentes
    const existingInvite = await query(
      "SELECT id FROM public.workspace_invites WHERE workspace_id = $1 AND lower(trim(email)) = $2 AND status = 'pending' AND expires_at > NOW()",
      [data.workspaceId, email]
    );

    if (existingInvite.rows.length > 0) {
      throw new Error("Já existe um convite pendente para este e-mail.");
    }

    // 3. Criar convite
    const token = crypto.randomUUID();
    await query(
      `INSERT INTO public.workspace_invites (workspace_id, email, role, token, invited_by, status)
       VALUES ($1, $2, $3, $4, $5, 'pending')`,
      [data.workspaceId, email, data.role, token, inviterId]
    );

    return { success: true, type: 'invite', token };
  });

export const acceptInvite = createServerFn({ method: "POST" })
  .validator((data: unknown) => z.object({ token: z.string() }).parse(data))
  .handler(async ({ data }) => {
    const request = getRequest();
    const authHeader = request.headers.get('authorization');
    const sessionToken = authHeader?.replace('Bearer ', '');
    if (!sessionToken) throw new Error("Você precisa estar logado para aceitar um convite.");
    
    const session = await getSession(sessionToken);
    if (!session) throw new Error("Sessão inválida.");
    
    const invite = await getInviteByToken(data.token);
    if (!invite) {
      throw new Error("Convite inválido, expirado ou já aceito.");
    }

    // Validar e-mail do convite vs e-mail do usuário logado
    const user = await query("SELECT email FROM auth.users WHERE id = $1", [session.user_id]);
    if (user.rows[0].email.toLowerCase().trim() !== invite.email.toLowerCase().trim()) {
      throw new Error("Este convite foi enviado para outro e-mail.");
    }

    await createMembership(invite.workspace_id, session.user_id, invite.role);
    await markInviteAccepted(invite.id);

    return { success: true, workspaceId: invite.workspace_id };
  });

export const getInviteDetails = createServerFn({ method: "GET" })
  .validator((data: unknown) => z.object({ token: z.string() }).parse(data))
  .handler(async ({ data }) => {
    const invite = await getInviteByToken(data.token);
    if (!invite) throw new Error("Convite não encontrado ou expirado.");
    return invite;
  });

export const removeMember = createServerFn({ method: "POST" })
  .validator((data: unknown) => z.object({ workspaceId: z.string(), userId: z.string() }).parse(data))
  .handler(async ({ data }) => {
    const adminId = await verifyAuth(data.workspaceId);
    
    // Não permitir remover a si mesmo se for o único owner (idealmente validado mais a fundo)
    if (adminId === data.userId) {
      const owners = await query("SELECT count(*) FROM public.workspace_members WHERE workspace_id = $1 AND role = 'owner'", [data.workspaceId]);
      if (parseInt(owners.rows[0].count) <= 1) {
        throw new Error("Você é o único proprietário e não pode remover seu próprio acesso.");
      }
    }

    await query("DELETE FROM public.workspace_members WHERE workspace_id = $1 AND user_id = $2", [data.workspaceId, data.userId]);
    return { success: true };
  });

export const cancelInvite = createServerFn({ method: "POST" })
  .validator((data: unknown) => z.object({ workspaceId: z.string(), inviteId: z.string() }).parse(data))
  .handler(async ({ data }) => {
    await verifyAuth(data.workspaceId);
    await query("UPDATE public.workspace_invites SET status = 'cancelled' WHERE id = $1 AND workspace_id = $2", [data.inviteId, data.workspaceId]);
    return { success: true };
  });

export const updateMemberRole = createServerFn({ method: "POST" })
  .validator((data: unknown) => 
    z.object({ 
      workspaceId: z.string(), 
      userId: z.string(), 
      role: z.enum(['admin', 'manager', 'operator', 'viewer']) 
    }).parse(data)
  )
  .handler(async ({ data }) => {
    await verifyAuth(data.workspaceId);
    await query("UPDATE public.workspace_members SET role = $1 WHERE workspace_id = $2 AND user_id = $3", [data.role, data.workspaceId, data.userId]);
    return { success: true };
  });
