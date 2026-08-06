import { dbQuery } from "./db.functions";

/**
 * Cliente de Banco de Dados para o Frontend (Browser).
 * Encaminha chamadas para Server Functions que rodam SQL puro no Postgres.
 */
export const db = {
  from: (table: string) => {
    const chain: any = {
      action: "select",
      table,
      filters: {},
      columns: "*",
      
      select(cols: string = "*") {
        this.columns = cols;
        return this;
      },
      
      eq(col: string, val: any) {
        this.filters[col] = val;
        return this;
      },
      
      gte(col: string, val: any) {
        this.filters[`${col} >=`] = val;
        return this;
      },
      
      lte(col: string, val: any) {
        this.filters[`${col} <=`] = val;
        return this;
      },
      
      in(col: string, vals: any[]) {
        this.filters[`${col} = ANY`] = vals;
        return this;
      },

      not(col: string, operator: string, val: any) {
        if (operator === "is" && val === null) {
          this.filters[`${col}_not_null`] = true;
        } else {
          this.filters[`${col}_not_${operator}`] = val;
        }
        return this;
      },
      
      order(col: string, { ascending = true } = {}) {
        this.orderBy = col;
        this.orderAsc = ascending;
        return this;
      },
      
      limit(n: number) {
        this.limitVal = n;
        return this;
      },
      
      async maybeSingle() {
        this.limitVal = 1;
        const rows = await dbQuery({ 
          data: { 
            table, 
            action: "select", 
            columns: this.columns, 
            filters: this.filters, 
            limit: 1 
          } 
        });
        return { data: rows[0] || null, error: null };
      },
      
      async execute() {
        const rows = await dbQuery({ 
          data: { 
            table, 
            action: this.action, 
            columns: this.columns, 
            filters: this.filters, 
            data: this.payload,
            orderBy: this.orderBy,
            orderAsc: this.orderAsc,
            limit: this.limitVal
          } 
        });
        return { data: rows, error: null };
      },

      update(data: any) {
        this.action = "update";
        this.payload = data;
        return this;
      },
      
      delete() {
        this.action = "delete";
        return this;
      },

      insert: (data: any) => {
        return dbQuery({ data: { table, action: "insert", data } }).then(res => ({ data: res, error: null }));
      },
      
      upsert: async (data: any) => {
        // Implementação simples de upsert simulado ou via RPC se necessário.
        // Por enquanto, o backend trata insert com ON CONFLICT se o SQL for ajustado, 
        // mas aqui mantemos compatibilidade.
        const row = await dbQuery({ data: { table, action: "insert", data } });
        return { data: row, error: null };
      }
    };

    // Binding para manter o contexto do 'this'
    const methods = ['select', 'eq', 'gte', 'lte', 'in', 'not', 'order', 'limit', 'maybeSingle', 'execute', 'update', 'delete', 'insert'];
    methods.forEach(m => chain[m] = chain[m].bind(chain));

    return chain;
  },
  
  async rpc(name: string, args: any) {
    const data = await dbQuery({ data: { table: "", action: "rpc", rpcName: name, rpcArgs: args } });
    return { data, error: null };
  }
};
