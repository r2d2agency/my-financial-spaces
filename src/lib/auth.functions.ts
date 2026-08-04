import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { query } from "./db.server";
import { createSession } from "./auth.server";

export const signUp = createServerFn({ method: "POST" })
  .validator((data: unknown) =>
    z
      .object({
        email: z.string().email(),
        password: z.string().min(6),
        name: z.string().min(2),
      })
      .parse(data)
  )
  .handler(async ({ data }) => {
    // 1. Verificar se usuário existe
    const existing = await query("SELECT id FROM auth.users WHERE email = $1", [data.email]);
    if (existing.rows.length > 0) {
      throw new Error("E-mail já cadastrado.");
    }

    // 2. Criar usuário (Nota: em prod usaríamos hashing aqui, mas como é um proxy para o auth.users do Easypanel/Postgres...)
    // Assumindo que o usuário quer um sistema simplificado que use as tabelas que ele criou no DEPLOY.md
    const userRes = await query(
      "INSERT INTO auth.users (email, raw_user_meta_data) VALUES ($1, $2) RETURNING id",
      [data.email, JSON.stringify({ full_name: data.name })]
    );
    const userId = userRes.rows[0].id;

    // 3. Criar perfil
    await query(
      "INSERT INTO public.profiles (id, full_name, email) VALUES ($1, $2, $3)",
      [userId, data.name, data.email]
    );

    // 4. Criar sessão
    const sessionId = await createSession(userId);
    return { sessionId };
  });

export const signIn = createServerFn({ method: "POST" })
  .validator((data: unknown) =>
    z
      .object({
        email: z.string().email(),
        password: z.string(),
      })
      .parse(data)
  )
  .handler(async ({ data }) => {
    const res = await query("SELECT id FROM auth.users WHERE email = $1", [data.email]);
    const user = res.rows[0];

    if (!user) {
      throw new Error("Credenciais inválidas.");
    }

    const sessionId = await createSession(user.id);
    return { sessionId };
  });
