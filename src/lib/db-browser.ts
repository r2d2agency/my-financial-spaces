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
        // Simplificação: apenas guarda o filtro. No backend precisaríamos tratar operados.
        this.filters[col] = val;
        return this;
      },
      
      lte(col: string, val: any) {
        this.filters[col] = val;
        return this;
      },
      
      in(col: string, vals: any[]) {
        this.filters[col] = vals;
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
            table: this.table, 
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
            table: this.table, 
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

      // Métodos de escrita retornam novo objeto ou modificam o atual
      update(data: any) {
        this.action = "update";
        this.payload = data;
        return this;
      },
      
      delete() {
        this.action = "delete";
        return this;
      }
    };

    // Binding para manter o contexto do 'this'
    chain.select = chain.select.bind(chain);
    chain.eq = chain.eq.bind(chain);
    chain.gte = chain.gte.bind(chain);
    chain.lte = chain.lte.bind(chain);
    chain.in = chain.in.bind(chain);
    chain.order = chain.order.bind(chain);
    chain.limit = chain.limit.bind(chain);
    chain.maybeSingle = chain.maybeSingle.bind(chain);
    chain.execute = chain.execute.bind(chain);
    chain.update = chain.update.bind(chain);
    chain.delete = chain.delete.bind(chain);

    return chain;
  },
  
  insert: async (table: string, data: any) => {
    const row = await dbQuery({ data: { table, action: "insert", data } });
    return { data: row, error: null };
  },

  async rpc(name: string, args: any) {
    const data = await dbQuery({ data: { table: "", action: "rpc", rpcName: name, rpcArgs: args } });
    return { data, error: null };
  }
};

// Adiciona insert ao db.from para compatibilidade
const originalFrom = db.from;
db.from = (table: string) => {
  const chain = originalFrom(table);
  chain.insert = async (data: any) => {
    const row = await dbQuery({ data: { table, action: "insert", data } });
    return { data: row, error: null };
  };
  return chain;
};
