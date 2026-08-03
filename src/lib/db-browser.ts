import { dbQuery } from "./db.functions";

/**
 * Cliente de Banco de Dados para o Frontend (Browser).
 * Encaminha chamadas para Server Functions que rodam SQL puro no Postgres.
 */
export const db = {
  from: (table: string) => ({
    select: (columns: string = "*") => ({
      execute: async () => {
        const rows = await dbQuery({ data: { table, action: "select", columns } });
        return { data: rows, error: null };
      },
      eq: (col: string, val: any) => ({
        execute: async () => {
          const rows = await dbQuery({ data: { table, action: "select", columns, filters: { [col]: val } } });
          return { data: rows, error: null };
        },
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
                  const rows = await dbQuery({ 
                    data: { 
                      table, 
                      action: "select", 
                      columns, 
                      filters: { [col]: val }, 
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
        limit: (limit: number) => ({
          execute: async () => {
            const rows = await dbQuery({ data: { table, action: "select", columns, orderBy, orderAsc: ascending, limit } });
            return { data: rows, error: null };
          }
        }),
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
          const count = await dbQuery({ data: { table, action: "update", data, filters: { [col]: val } } });
          return { data: count, error: null };
        }
      }),
      in: (col: string, vals: any[]) => ({
        execute: async () => {
          const count = await dbQuery({ data: { table, action: "update", data, filters: { [col]: vals } } });
          return { data: count, error: null };
        }
      })
    }),
    delete: () => ({
      eq: (col: string, val: any) => ({
        execute: async () => {
          const count = await dbQuery({ data: { table, action: "delete", filters: { [col]: val } } });
          return { data: count, error: null };
        }
      })
    })
  }),
  rpc: async (name: string, args: any) => {
    const data = await dbQuery({ data: { table: "", action: "rpc", rpcName: name, rpcArgs: args } });
    return { data, error: null };
  }
};
