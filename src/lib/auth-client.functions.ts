import { createServerFn } from "@tanstack/react-start";
import { getSession } from "./auth.server";
import { getRequest } from "@tanstack/react-start/server";

export const getCurrentUser = createServerFn({ method: "GET" })
  .handler(async () => {
    try {
      const request = getRequest();
      const authHeader = request.headers.get('authorization');
      const token = authHeader?.replace('Bearer ', '');

      if (!token) return null;

      const session = await getSession(token);
      if (!session) return null;

      return {
        id: session.user_id,
        email: '',
      };
    } catch (e) {
      console.error("Auth helper error:", e);
      return null;
    }
  });

export const signOut = createServerFn({ method: "POST" })
  .handler(async () => {
    return { success: true };
  });
