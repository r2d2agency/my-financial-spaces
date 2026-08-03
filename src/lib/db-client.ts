/** 
 * Adaptador de Banco de Dados PostgreSQL para o app.
 * Substitui o cliente Supabase para consultas internas.
 */
import { query } from "./db.server";

export const db = {
  from: (table: string) => ({
    select: (columns: string = "*") => ({
      eq: (col: string, val: any) => ({
        maybeSingle: async () => {
          const res = await query(`SELECT ${columns} FROM ${table} WHERE ${col} = $1 LIMIT 1`, [val]);
          return { data: res.rows[0] || null, error: null };
        },
        order: (colOrder: string, { ascending = true } = {}) => ({
          async execute() {
             const res = await query(`SELECT ${columns} FROM ${table} WHERE ${col} = $1 ORDER BY ${colOrder} ${ascending ? 'ASC' : 'DESC'}`, [val]);
             return { data: res.rows, error: null };
          }
        })
      })
    }),
    insert: async (data: any) => {
      const keys = Object.keys(data);
      const values = Object.values(data);
      const placeholders = keys.map((_, i) => `$${i + 1}`).join(", ");
      const res = await query(
        `INSERT INTO ${table} (${keys.join(", ")}) VALUES (${placeholders}) RETURNING *`,
        values
      );
      return { data: res.rows[0], error: null };
    }
  })
};
