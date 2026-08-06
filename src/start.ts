import { createStart, createCsrfMiddleware, createMiddleware } from "@tanstack/react-start";
import { renderErrorPage } from "./lib/error-page";
import { attachLocalAuth } from "@/lib/auth-attacher";

const errorMiddleware = createMiddleware().server(async ({ next }) => {
...
export const startInstance = createStart(() => ({
  functionMiddleware: [attachLocalAuth],
  requestMiddleware: [errorMiddleware, csrfMiddleware],
}));