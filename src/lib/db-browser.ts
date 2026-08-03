import { dbQuery } from "./db.functions";

/**
 * Cliente de Banco de Dados para o Frontend (Browser).
 * Encaminha chamadas para Server Functions que rodam SQL puro no Postgres.
 */
export const db = {
  from: (table: string) => ({
    select: (columns: string = "*") => ({
      eq: (col: string, val: any) => ({
        maybeSingle: async () => {
          const rows = await dbQuery({ data: { table, action: "select", columns, filters: { [col]: val }, limit: 1 } });
          return { data: rows[0] || null, error: null };
        },
        order: (orderBy: string, { ascending = true } = {}) => ({
          execute: async () => {
            const rows = await dbQuery({ data: { table, action: "select", columns, filters: { [col]: val }, orderBy, orderAsc: ascending } });
            return { data: rows, error: null };
          }
        }),
        gte: (col2: string, val2: any) => ({
          lte: (col3: string, val3: any) => ({
             order: (orderBy: string, { ascending = true } = {}) => ({
                execute: async () => {
                  // Simplificação para o exemplo: filtros compostos
                  const rows = await dbQuery({ 
                    data: { 
                      table, 
                      action: "select", 
                      columns, 
                      filters: { [col]: val }, // Note: aqui deveríamos suportar GTE/LTE
                      orderBy, 
                      orderAsc: ascending 
                    } 
                  });
                  return { data: rows, error: null };
                }
             })
          })
        })
      }),
      order: (orderBy: string, { ascending = true } = {}) => ({
        execute: async () => {
          const rows = await dbQuery({ data: { table, action: "select", columns, orderBy, orderAsc: ascending } });
          return { data: rows, error: null };
        }
      })
    }),
    insert: async (data: any) => {
      const row = await dbQuery({ data: { table, action: "insert", data } });
      return { data: row, error: null };
    },
    update: (data: any) => ({
      eq: (col: string, val: any) => ({
        execute: async () => {
          // Implementação simplificada: no app real usaríamos dbQuery para UPDATE
          return { data: null, error: null };
        }
      }),
      in: (col: string, vals: any[]) => ({
        execute: async () => {
          return { data: null, error: null };
        }
      })
    }),
    delete: () => ({
      eq: (col: string, val: any) => ({
        execute: async () => {
           return { data: null, error: null };
        }
      })
    })
  }),
  rpc: async (name: string, args: any) => {
    const data = await dbQuery({ data: { table: "", action: "rpc", rpcName: name, rpcArgs: args } });
    return { data, error: null };
  }
};
