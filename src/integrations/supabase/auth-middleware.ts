import { createMiddleware } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'
import { createClient } from '@supabase/supabase-js'
import type { Database } from './types'

/**
 * Middleware para autenticação.
 * Como o projeto usa PostgreSQL local no EasyPanel via Supabase Self-Hosted,
 * as chaves e URL devem apontar para a instância local.
 */
export const requireSupabaseAuth = createMiddleware({ type: 'function' }).server(
  async ({ next }) => {
    const SUPABASE_URL = process.env['SUPABASE_URL'];
    const SUPABASE_PUBLISHABLE_KEY = process.env['SUPABASE_PUBLISHABLE_KEY'];

    // Fallback amigável para ambiente de desenvolvimento ou má configuração
    if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
      console.warn('[Auth] Chaves do banco de dados ausentes no servidor.');
      // Em produção real isso deve lançar erro, mas para o usuário conseguir debugar:
      if (process.env['NODE_ENV'] === 'production') {
          throw new Error('Erro de Configuração: SUPABASE_URL e SUPABASE_PUBLISHABLE_KEY não encontradas.');
      }
    }
    
    const request = getRequest();
    if (!request?.headers) throw new Error('Não autorizado: Sem headers');

    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) throw new Error('Não autorizado: Token ausente');

    const token = authHeader.replace('Bearer ', '');
    
    // Supabase Self-Hosted usa JWT padrão do GoTrue
    const supabase = createClient<Database>(
      SUPABASE_URL || 'http://localhost:8000',
      SUPABASE_PUBLISHABLE_KEY || 'dummy',
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      }
    );

    // Valida o token contra a instância local do banco
    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (error || !user) {
      throw new Error('Não autorizado: Sessão inválida no banco local');
    }

    return next({
      context: {
        supabase,
        userId: user.id,
        user,
      },
    });
  },
);
