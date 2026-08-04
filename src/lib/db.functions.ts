import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { query } from "./db.server";
import { getSession } from "./auth.server";
import { getRequest } from "@tanstack/react-start/server";

const verifyAuth = async () => {
  const request = getRequest();
  const authHeader = request.headers.get('authorization');
  const token = authHeader?.replace('Bearer ', '');
  if (!token) throw new Error("Não autorizado");
  const session = await getSession(token);
  if (!session) throw new Error("Sessão inválida");
  return session.user_id;
};

export const dbQuery = createServerFn({ method: "POST" })
  .inputValidator((data) =>
    z.object({
      table: z.string(),
      action: z.enum(["select", "insert", "update", "delete", "rpc"]),
      columns: z.string().optional(),
      filters: z.record(z.any()).optional(),
      data: z.any().optional(),
      rpcName: z.string().optional(),
      rpcArgs: z.any().optional(),
      orderBy: z.string().optional(),
      orderAsc: z.boolean().optional(),
      limit: z.number().optional(),
    }).parse(data)
  )
  .handler(async ({ data }) => {
    const userId = await verifyAuth();
    
    if (data.action === "select") {
      let sql = `SELECT ${data.columns || "*"} FROM ${data.table}`;
      const params: any[] = [];
      if (data.filters) {
        const clauses = Object.entries(data.filters).map(([key, val]) => {
          if (val === null) return `${key} IS NULL`;
          
          // Suporte a operadores no key
          const parts = key.split(' ');
          if (parts.length > 1) {
            const field = parts[0];
            const op = parts.slice(1).join(' ');
            
            if (op === "= ANY") {
              params.push(val);
              return `${field} = ANY($${params.length})`;
            }
            
            params.push(val);
            return `${field} ${op} $${params.length}`;
          }

          params.push(val);
          return `${key} = $${params.length}`;
        });
        if (clauses.length) sql += ` WHERE ${clauses.join(" AND ")}`;
      }
      if (data.orderBy) {
        sql += ` ORDER BY ${data.orderBy} ${data.orderAsc !== false ? "ASC" : "DESC"}`;
      }
      if (data.limit) {
        sql += ` LIMIT ${data.limit}`;
      }
      const res = await query(sql, params);
      return res.rows;
    }

    if (data.action === "insert") {
      const keys = Object.keys(data.data);
      const vals = Object.values(data.data);
      const placeholders = keys.map((_, i) => `$${i + 1}`).join(", ");
      const sql = `INSERT INTO ${data.table} (${keys.join(", ")}) VALUES (${placeholders}) RETURNING *`;
      const res = await query(sql, vals);
      return res.rows[0];
    }

    if (data.action === "update") {
      const keys = Object.keys(data.data);
      const vals = Object.values(data.data);
      const setClauses = keys.map((key, i) => `${key} = $${i + 1}`).join(", ");
      
      let sql = `UPDATE ${data.table} SET ${setClauses}`;
      const params = [...vals];
      
      if (data.filters) {
        const whereClauses = Object.entries(data.filters).map(([key, val]) => {
          if (val === null) return `${key} IS NULL`;
          params.push(val);
          return `${key} = $${params.length}`;
        });
        sql += ` WHERE ${whereClauses.join(" AND ")}`;
      }
      
      const res = await query(sql, params);
      return res.rowCount;
    }

    if (data.action === "delete") {
      let sql = `DELETE FROM ${data.table}`;
      const params: any[] = [];
      
      if (data.filters) {
        const whereClauses = Object.entries(data.filters).map(([key, val]) => {
          if (val === null) return `${key} IS NULL`;
          params.push(val);
          return `${key} = $${params.length}`;
        });
        sql += ` WHERE ${whereClauses.join(" AND ")}`;
      }
      
      const res = await query(sql, params);
      return res.rowCount;
    }

    if (data.action === "rpc") {
      try {
        if (data.rpcName === "create_workspace") {
          const name = String(data.rpcArgs._name || "Meu espaço");
          const income = parseFloat(String(data.rpcArgs._income || 0));
          const targetUserId = data.rpcArgs._user_id || userId;
          
          const res = await query("SELECT public.create_workspace($1, $2, $3) as workspace_id", [
            name,
            income,
            targetUserId
          ]);
          return res.rows[0].workspace_id;
        }
        if (data.rpcName === "list_ws_members") {
          const res = await query("SELECT * FROM public.list_ws_members($1::uuid)", [data.rpcArgs._ws]);
          return res.rows;
        }
      } catch (rpcErr) {
        // Log sensitive details only on server, never return to client
        console.error(`RPC Error (${data.rpcName}):`, rpcErr);
        if (rpcErr instanceof Error) {
          throw new Error(`Erro no Banco: ${rpcErr.message}`);
        }
        throw rpcErr;
      }
    }

    throw new Error("Ação não suportada");
  });
