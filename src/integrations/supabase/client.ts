import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

// Mock/Adapter for Supabase Client that uses direct PG connection when env vars are missing
// or when explicitly configured to bypass the Supabase API.

function createSupabaseClient() {
  const SUPABASE_URL = import.meta.env['VITE_SUPABASE_URL'] || process.env['SUPABASE_URL'];
  const SUPABASE_PUBLISHABLE_KEY = import.meta.env['VITE_SUPABASE_PUBLISHABLE_KEY'] || process.env['SUPABASE_PUBLISHABLE_KEY'];

  // If environment variables are missing, we check if we are on server-side and have DATABASE_URL
  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
     console.warn('[Database] Chaves do Supabase ausentes. O app tentará usar conexão direta PostgreSQL via DATABASE_URL no servidor.');
     
     // Return a dummy client that will fail on client-side but we'll handle server-side logic via src/lib/db.server.ts
     return createClient<Database>('http://localhost:8000', 'dummy-key');
  }

  return createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: {
      storage: typeof window !== 'undefined' ? localStorage : undefined,
      persistSession: true,
      autoRefreshToken: true,
    }
  });
}

let _supabase: ReturnType<typeof createSupabaseClient> | undefined;

export const supabase = new Proxy({} as ReturnType<typeof createSupabaseClient>, {
  get(_, prop, receiver) {
    if (!_supabase) _supabase = createSupabaseClient();
    return Reflect.get(_supabase, prop, receiver);
  },
});
