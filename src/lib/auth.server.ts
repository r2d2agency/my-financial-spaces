import { query } from "./db.server";

export const getSession = async (token: string) => {
  try {
    const res = await query(
      "SELECT * FROM user_sessions WHERE id = $1 AND expires_at > NOW()",
      [token]
    );
    return res.rows[0] || null;
  } catch (e) {
    return null;
  }
};

export const createSession = async (userId: string) => {
  const sessionId = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30); // 30 dias
  await query(
    "INSERT INTO user_sessions (id, user_id, expires_at) VALUES ($1, $2, $3)",
    [sessionId, userId, expiresAt]
  );
  return sessionId;
};
