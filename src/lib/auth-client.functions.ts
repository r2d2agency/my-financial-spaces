import { createServerFn } from "@tanstack/react-start";
import { getSession } from "./auth.server";
import { getRequest } from "@tanstack/react-start/server";

export const getCurrentUser = createServerFn({ method: "GET" })
  .handler(async () => {
    const request = getRequest();
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');

    if (!token) return null;

    const session = await getSession(token);
    if (!session) return null;

    // Retorna um mock do objeto de usuário do Supabase para compatibilidade
    return {
      id: session.user_id,
      email: '', // Poderíamos buscar no banco se necessário
    };
  });

export const signOut = createServerFn({ method: "POST" })
  .handler(async () => {
    // Para logout local, o cliente apenas remove o token. 
    // No servidor poderíamos invalidar a sessão na tabela user_sessions.
    const request = getRequest();
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');
    
    // Opcional: deletar do banco
    // if (token) await query("DELETE FROM user_sessions WHERE id = $1", [token]);
    
    return { success: true };
  });
