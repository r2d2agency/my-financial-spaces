import { createMiddleware } from "@tanstack/react-start";
import { getSession } from "./auth.server";
import { getRequest } from "@tanstack/react-start/server";

export const requireAuth = createMiddleware().server(async ({ next }) => {
  const request = getRequest();
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.replace("Bearer ", "");
  
  if (!token) {
    throw new Error("Não autorizado");
  }
  
  const session = await getSession(token);
  if (!session) {
    throw new Error("Sessão inválida");
  }
  
  return next({
    context: {
      userId: session.user_id,
    },
  });
});
