import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { query } from "./db.server";
import { createSession } from "./auth.server";
import { hashPassword, comparePassword } from "./crypto.server";

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

    // 2. Criar usuário com senha segura (Sprint A)
    const pwHash = await hashPassword(data.password);
    const userRes = await query(
      "INSERT INTO auth.users (email, password_hash, raw_user_meta_data) VALUES ($1, $2, $3) RETURNING id",
      [data.email, pwHash, JSON.stringify({ full_name: data.name })]
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
    const res = await query("SELECT id, password_hash FROM auth.users WHERE email = $1", [data.email]);
    const user = res.rows[0];
    
    if (!user) {
      throw new Error("Credenciais inválidas.");
    }

    // Validar senha (Sprint A)
    const valid = await comparePassword(data.password, user.password_hash || "");
    if (!valid) {
      throw new Error("Credenciais inválidas.");
    }

    const sessionId = await createSession(user.id);
    return { sessionId };
  });
