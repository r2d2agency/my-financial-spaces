import { createMiddleware } from '@tanstack/react-start'
import { getRequest, setResponseStatus } from '@tanstack/react-start/server'
import { getSession } from '@/lib/auth.server'

/**
 * Middleware de Autenticação para PostgreSQL puro.
 * Verifica o token de sessão nos headers ou cookies.
 */
export const requireAuth = createMiddleware({ type: 'function' }).server(
  async ({ next }) => {
    const request = getRequest();
    const authHeader = request.headers.get('authorization');
    
    // Suporte a Bearer token ou Cookie
    const token = authHeader?.replace('Bearer ', '') || 
                 request.headers.get('cookie')?.split('; ').find(row => row.startsWith('session='))?.split('=')[1];

    if (!token) {
      setResponseStatus(401);
      throw new Error('Não autorizado: Sessão ausente');
    }

    const session = await getSession(token);
    
    if (!session) {
      setResponseStatus(401);
      throw new Error('Não autorizado: Sessão inválida ou expirada');
    }

    return next({
      context: {
        userId: session.user_id,
        sessionId: session.id,
      },
    });
  },
);

// Alias para compatibilidade com código existente
export const requireSupabaseAuth = requireAuth;
