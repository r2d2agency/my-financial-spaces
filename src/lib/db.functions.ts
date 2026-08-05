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
  .validator((data: unknown) =>
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
          
          // Suporte a operadores no key (e.g. "workspace_id(id, name)")
          if (key.includes('(')) {
            // Se for um join simulado como "workspaces(id, name)"
            // No momento, o db-browser envia isso para SELECT columns, mas se vier em filters tratamos aqui.
            // Para simplificar, focamos nos operadores de comparação.
          }

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
        // Sprint A: Transferência entre contas
        if (data.rpcName === "execute_transfer") {
          const { from_account_id, to_account_id, amount, description, date, workspace_id } = data.rpcArgs;
          const transfer_id = crypto.randomUUID();
          
          // Lado da Saída
          await query(
            `INSERT INTO public.transactions (workspace_id, type, description, amount, status, competence_date, account_id, created_by, transfer_id) 
             VALUES ($1, 'transfer', $2, $3, 'paid', $4, $5, $6, $7)`,
            [workspace_id, description, -Math.abs(amount), date, from_account_id, userId, transfer_id]
          );

          // Lado da Entrada
          await query(
            `INSERT INTO public.transactions (workspace_id, type, description, amount, status, competence_date, account_id, created_by, transfer_id) 
             VALUES ($1, 'transfer', $2, $3, 'paid', $4, $5, $6, $7)`,
            [workspace_id, description, Math.abs(amount), date, to_account_id, userId, transfer_id]
          );
          
          return { success: true, transfer_id };
        }
        // Sprint B: Salvar Planejamento
        if (data.rpcName === "save_budget") {
          const { category_id, amount, month, year, workspace_id } = data.rpcArgs;
          
          // Check if exists
          const existing = await query(
            "SELECT id FROM public.budgets WHERE workspace_id = $1 AND category_id = $2 AND period_month = $3 AND period_year = $4",
            [workspace_id, category_id, month, year]
          );

          if (existing.rows.length > 0) {
            await query(
              "UPDATE public.budgets SET amount = $1 WHERE id = $2",
              [amount, existing.rows[0].id]
            );
            return { success: true, id: existing.rows[0].id };
          } else {
            const res = await query(
              "INSERT INTO public.budgets (workspace_id, category_id, amount, period_month, period_year) VALUES ($1, $2, $3, $4, $5) RETURNING id",
              [workspace_id, category_id, amount, month, year]
            );
            return { success: true, id: res.rows[0].id };
          }
        }
      } catch (rpcErr) {
        console.error(`RPC Error (${data.rpcName}):`, rpcErr);
        if (rpcErr instanceof Error) {
          throw new Error(`Erro no Banco: ${rpcErr.message}`);
        }
        throw rpcErr;
      }
    }

    throw new Error("Ação não suportada");
  });
