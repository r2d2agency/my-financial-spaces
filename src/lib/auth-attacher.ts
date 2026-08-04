import { createMiddleware } from '@tanstack/react-start'

export const attachLocalAuth = createMiddleware({ type: 'function' }).client(
  async ({ next }) => {
    // Busca o token do localStorage (definido no formulário de login/cadastro)
    const token = typeof window !== 'undefined' ? localStorage.getItem("auth_token") : null;
    return next({
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
  },
)
