import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { query } from "./db.server";
import { createSession, getSession } from "./auth.server";
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

/** Verifica se o usuário logado precisa definir uma nova senha (superadmin semeado). */
export const mustChangePassword = createServerFn({ method: "POST" })
  .validator((data: unknown) => z.object({ sessionId: z.string() }).parse(data))
  .handler(async ({ data }) => {
    const session = await getSession(data.sessionId);
    if (!session) return { required: false };
    const res = await query(
      "SELECT must_change_password FROM auth.users WHERE id = $1",
      [session.user_id]
    );
    return { required: res.rows[0]?.must_change_password === true };
  });

/** Define uma nova senha e limpa a obrigatoriedade de troca. */
export const changePassword = createServerFn({ method: "POST" })
  .validator((data: unknown) =>
    z
      .object({
        sessionId: z.string(),
        newPassword: z.string().min(8, "A nova senha deve ter ao menos 8 caracteres."),
      })
      .parse(data)
  )
  .handler(async ({ data }) => {
    const session = await getSession(data.sessionId);
    if (!session) throw new Error("Sessão expirada. Entre novamente.");

    const current = await query("SELECT password_hash FROM auth.users WHERE id = $1", [session.user_id]);
    if (current.rows[0]?.password_hash) {
      const same = await comparePassword(data.newPassword, current.rows[0].password_hash);
      if (same) throw new Error("A nova senha deve ser diferente da senha padrão.");
    }

    const pwHash = await hashPassword(data.newPassword);
    await query(
      "UPDATE auth.users SET password_hash = $1, must_change_password = false WHERE id = $2",
      [pwHash, session.user_id]
    );
    return { success: true };
  });
