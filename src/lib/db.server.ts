import pg from 'pg';
const { Pool } = pg;

let pool: pg.Pool | undefined;

export function getPool() {
  if (pool) return pool;

  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error('Variável de ambiente DATABASE_URL não configurada.');
  }

  pool = new Pool({
    connectionString,
    // Configurações recomendadas para ambientes serverless/workers se necessário
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  });

  return pool;
}

export async function query(text: string, params?: any[]) {
  const start = Date.now();
  const res = await getPool().query(text, params);
  const duration = Date.now() - start;
  // console.log('executed query', { text, duration, rows: res.rowCount });
  return res;
}
