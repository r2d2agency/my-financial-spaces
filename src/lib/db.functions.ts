import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { query } from "./db.server";
import { getSession } from "./auth.server";
import { getRequest } from "@tanstack/react-start/server";

const verifyAuth = async (workspaceId?: string) => {
  const request = getRequest();
  const authHeader = request.headers.get('authorization');
  const token = authHeader?.replace('Bearer ', '');
  if (!token) throw new Error("Não autorizado");
  const session = await getSession(token);
  if (!session) throw new Error("Sessão inválida");
  
  const userId = session.user_id;

  // Se workspaceId for fornecido, validar acesso
  if (workspaceId) {
    const access = await query(
      "SELECT role FROM public.workspace_members WHERE workspace_id = $1 AND user_id = $2",
      [workspaceId, userId]
    );
    if (access.rows.length === 0) {
      throw new Error("Acesso negado a este espaço financeiro.");
    }
    return { userId, role: access.rows[0].role };
  }

  return { userId, role: null };
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
    const filters: any = data.filters || {};
    const workspaceId = filters.workspace_id || (data.data?.workspace_id);
    const { userId, role } = await verifyAuth(workspaceId);
    
    // Bloquear ações de escrita para VIEWER
    if (role === 'viewer' && (data.action === 'insert' || data.action === 'update' || data.action === 'delete' || data.action === 'rpc')) {
      const allowedRPCs = ['list_ws_members'];
      if (!(data.action === 'rpc' && allowedRPCs.includes(data.rpcName || ''))) {
        throw new Error("Sua permissão é de visualizador e não permite alterações.");
      }
    }
    
    if (data.action === "select") {
      let sql = `SELECT ${data.columns || "*"} FROM ${data.table}`;
      const params: any[] = [];
      if (data.filters) {
        const clauses = Object.entries(data.filters).map(([key, val]) => {
          if (key === 'OR') return `(${val})`;
          if (val === null) {
             if (key.includes(' IS NOT NULL')) return key;
             return `${key} IS NULL`;
          }
          
          const parts = key.split(' ');
          if (parts.length > 1) {
            const field = parts[0];
            const op = parts.slice(1).join(' ');
            
            if (op === "= ANY") {
              params.push(val);
              return `${field} = ANY($${params.length})`;
            }
            if (op === "ILIKE") {
              params.push(`%${val}%`);
              return `${field} ILIKE $${params.length}`;
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
      // Validação cruzada (exemplo para transactions)
      if (data.table === "transactions" && data.data) {
        data.data.created_by = userId;
        data.data.updated_at = new Date();
        data.data.updated_by = userId;
        const { workspace_id, category_id, account_id, contact_id } = data.data;
        if (category_id) {
          const cat = await query("SELECT 1 FROM public.categories WHERE id = $1 AND workspace_id = $2", [category_id, workspace_id]);
          if (cat.rows.length === 0) throw new Error("Categoria inválida para este espaço.");
        }
        if (account_id) {
          const acc = await query("SELECT 1 FROM public.financial_accounts WHERE id = $1 AND workspace_id = $2", [account_id, workspace_id]);
          if (acc.rows.length === 0) throw new Error("Conta inválida para este espaço.");
        }
      }

      if (data.data) {
        data.data.updated_at = new Date();
        data.data.updated_by = userId;
      }
      const keys = Object.keys(data.data);
      const vals = Object.values(data.data);
      const placeholders = keys.map((_, i) => `$${i + 1}`).join(", ");
      const sql = `INSERT INTO ${data.table} (${keys.join(", ")}) VALUES (${placeholders}) RETURNING *`;
      const res = await query(sql, vals);
      return res.rows[0];
    }

    if (data.action === "update") {
      if (data.table === "transactions" && data.data) {
        data.data.updated_at = new Date();
        data.data.updated_by = userId;
        const { workspace_id, category_id, account_id } = data.data;
        if (workspace_id) {
          if (category_id) {
            const cat = await query("SELECT 1 FROM public.categories WHERE id = $1 AND workspace_id = $2", [category_id, workspace_id]);
            if (cat.rows.length === 0) throw new Error("Categoria inválida para este espaço.");
          }
          if (account_id) {
            const acc = await query("SELECT 1 FROM public.financial_accounts WHERE id = $1 AND workspace_id = $2", [account_id, workspace_id]);
            if (acc.rows.length === 0) throw new Error("Conta inválida para este espaço.");
          }
        }
      }

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
      
      sql += " RETURNING *";
      const res = await query(sql, params);
      return res.rows[0];
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
          
          // Validar acesso ao workspace
          await verifyAuth(workspace_id);

          if (from_account_id === to_account_id) {
            throw new Error("As contas de origem e destino devem ser diferentes.");
          }

          if (parseFloat(amount) <= 0) {
            throw new Error("O valor da transferência deve ser maior que zero.");
          }

          // Validar se ambas as contas pertencem ao workspace e não estão arquivadas
          const accountsCheck = await query(
            "SELECT id FROM public.financial_accounts WHERE id IN ($1, $2) AND workspace_id = $3 AND archived = false",
            [from_account_id, to_account_id, workspace_id]
          );
          if (accountsCheck.rows.length !== 2) {
            throw new Error("Uma ou ambas as contas são inválidas ou estão arquivadas.");
          }

          const transfer_id = crypto.randomUUID();
          
          // Usar transação atômica (BEGIN/COMMIT é implícito na query single string ou via Pool client)
          // Aqui simulamos via multiplas queries, idealmente seria via client.query('BEGIN')
          try {
            // Lado da Saída
            await query(
              `INSERT INTO public.transactions (workspace_id, type, description, amount, status, competence_date, paid_date, account_id, created_by, transfer_id) 
               VALUES ($1, 'transfer', $2, $3, 'paid', $4, $4, $5, $6, $7)`,
              [workspace_id, description || 'Transferência enviada', -Math.abs(amount), date, from_account_id, userId, transfer_id]
            );

            // Lado da Entrada
            await query(
              `INSERT INTO public.transactions (workspace_id, type, description, amount, status, competence_date, paid_date, account_id, created_by, transfer_id) 
               VALUES ($1, 'transfer', $2, $3, 'paid', $4, $4, $5, $6, $7)`,
              [workspace_id, description || 'Transferência recebida', Math.abs(amount), date, to_account_id, userId, transfer_id]
            );
            
            return { success: true, transfer_id };
          } catch (err) {
            console.error("Transfer error:", err);
            throw new Error("Falha ao executar transferência no banco de dados.");
          }
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
        // Etapa 2: Liquidação e Reversão
        if (data.rpcName === "settle_transaction") {
          const { id, workspace_id, account_id, paid_date, amount } = data.rpcArgs;
          await verifyAuth(workspace_id);
          const updateData: any = { status: 'paid', paid_date: paid_date || new Date(), updated_by: userId, updated_at: new Date() };
          if (account_id) updateData.account_id = account_id;
          if (amount !== undefined) updateData.amount = amount;
          
          const keys = Object.keys(updateData);
          const setClauses = keys.map((k, i) => `${k} = $${i + 1}`).join(", ");
          const sql = `UPDATE public.transactions SET ${setClauses} WHERE id = $${keys.length + 1} AND workspace_id = $${keys.length + 2} RETURNING *`;
          const res = await query(sql, [...Object.values(updateData), id, workspace_id]);
          return res.rows[0];
        }
        if (data.rpcName === "revert_settlement") {
          const { id, workspace_id } = data.rpcArgs;
          await verifyAuth(workspace_id);
          const res = await query(
            "UPDATE public.transactions SET status = 'pending', paid_date = NULL, updated_by = $1, updated_at = NOW() WHERE id = $2 AND workspace_id = $3 RETURNING *",
            [userId, id, workspace_id]
          );
          return res.rows[0];
        }
        if (data.rpcName === "get_account_balance") {
          const { account_id, workspace_id } = data.rpcArgs;
          await verifyAuth(workspace_id);
          
          // Buscar saldo inicial
          const acc = await query(
            "SELECT initial_balance, initial_balance_date FROM public.financial_accounts WHERE id = $1 AND workspace_id = $2",
            [account_id, workspace_id]
          );
          if (acc.rows.length === 0) throw new Error("Conta não encontrada");
          
          const initialBalance = parseFloat(acc.rows[0].initial_balance);
          const initialDate = acc.rows[0].initial_balance_date;

          // Somar transações PAGAS (receitas, despesas, transferências) após a data inicial
          // Incluímos a data inicial como ponto de partida das movimentações extras
          const trans = await query(
            `SELECT COALESCE(SUM(amount), 0) as total 
             FROM public.transactions 
             WHERE account_id = $1 
               AND workspace_id = $2 
               AND status = 'paid'
               AND (paid_date >= $3 OR paid_date IS NULL AND competence_date >= $3)`,
            [account_id, workspace_id, initialDate]
          );

          const currentBalance = initialBalance + parseFloat(trans.rows[0].total);
          return { current_balance: currentBalance };
        }
        if (data.rpcName === "get_card_details") {
          const { card_id, workspace_id } = data.rpcArgs;
          await verifyAuth(workspace_id);

          const card = await query(
            "SELECT credit_limit FROM public.credit_cards WHERE id = $1 AND workspace_id = $2",
            [card_id, workspace_id]
          );
          if (card.rows.length === 0) throw new Error("Cartão não encontrado");

          const limit = parseFloat(card.rows[0].credit_limit);

          const used = await query(
            "SELECT COALESCE(SUM(ABS(amount)), 0) as total FROM public.transactions WHERE card_id = $1 AND workspace_id = $2 AND status = 'pending'",
            [card_id, workspace_id]
          );

          const usedAmount = parseFloat(used.rows[0].total);
          return {
            credit_limit: limit,
            used_amount: usedAmount,
            available_limit: limit - usedAmount
          };
        }

        if (data.rpcName === "pay_credit_card_invoice") {
          const { invoice_id, account_id, payment_date, amount, workspace_id } = data.rpcArgs;
          await verifyAuth(workspace_id);

          const invoice = await query(
            "SELECT * FROM public.credit_card_invoices WHERE id = $1 AND workspace_id = $2",
            [invoice_id, workspace_id]
          );
          if (invoice.rows.length === 0) throw new Error("Fatura não encontrada");

          const card = await query("SELECT name FROM public.credit_cards WHERE id = $1", [invoice.rows[0].card_id]);
          const cardName = card.rows[0]?.name || "Cartão";

          await query(
            `INSERT INTO public.transactions (workspace_id, type, description, amount, status, competence_date, paid_date, account_id, created_by, notes) 
             VALUES ($1, 'card_payment', $2, $3, 'paid', $4, $4, $5, $6, $7)`,
            [
              workspace_id, 
              `Pagamento Fatura ${invoice.rows[0].period_month}/${invoice.rows[0].period_year} - ${cardName}`, 
              -Math.abs(amount), 
              payment_date, 
              account_id, 
              userId,
              `Pagamento da fatura ID: ${invoice_id}`
            ]
          );

          await query(
            "UPDATE public.transactions SET status = 'paid', paid_date = $1 WHERE invoice_id = $2 AND workspace_id = $3",
            [payment_date, invoice_id, workspace_id]
          );

          await query(
            "UPDATE public.credit_card_invoices SET status = 'paid' WHERE id = $1 AND workspace_id = $2",
            [invoice_id, workspace_id]
          );

          return { success: true };
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
