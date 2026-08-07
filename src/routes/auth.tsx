import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { db } from "@/lib/db-browser";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Wallet, Eye, EyeOff } from "lucide-react";
import { signUp as localSignUp, signIn as localSignIn } from "@/lib/auth.functions";
import { useServerFn } from "@tanstack/react-start";

export const Route = createFileRoute("/auth")({
  validateSearch: z.object({ mode: z.enum(["login", "signup"]).optional() }),
  component: AuthPage,
  head: () => ({
    meta: [
      { title: "Entrar · Espaço Financeiro" },
      { name: "description", content: "Acesse seus espaços financeiros ou crie sua conta gratuita." },
      { property: "og:title", content: "Entrar · Espaço Financeiro" },
      { property: "og:description", content: "Acesse seus espaços financeiros." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function AuthPage() {
  const { mode } = Route.useSearch();
  const navigate = useNavigate();
  const [signup, setSignup] = useState(mode === "signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const doSignUp = useServerFn(localSignUp);
  const doSignIn = useServerFn(localSignIn);

  useEffect(() => {
    const token = localStorage.getItem("auth_token");
    if (token) navigate({ to: "/dashboard", replace: true });
  }, [navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (signup) {
        const result = await doSignUp({ data: { email, password, name } });
        localStorage.setItem("auth_token", result.sessionId);
        navigate({ to: "/onboarding", replace: true });
      } else {
        const result = await doSignIn({ data: { email, password } });
        localStorage.setItem("auth_token", result.sessionId);
        navigate({ to: "/dashboard", replace: true });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível continuar.");
    } finally {
      setLoading(false);
    }
  };

  const google = async () => {
    toast.error("Login social não configurado no servidor local. Use e-mail e senha.");
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4">
      <div className="w-full max-w-md">
        <Link to="/" className="mb-6 flex items-center justify-center gap-2 font-semibold">
          <span className="grid size-8 place-items-center rounded-lg bg-primary text-primary-foreground">
            <Wallet className="size-4" />
          </span>
          Espaço Financeiro
        </Link>
        <Card>
          <CardHeader>
            <CardTitle>{signup ? "Criar conta" : "Entrar"}</CardTitle>
            <CardDescription>
              {signup ? "14 dias grátis, sem cartão." : "Bem-vindo de volta."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={submit} className="space-y-4">
              {signup && (
                <div className="space-y-2">
                  <Label htmlFor="name">Nome completo</Label>
                  <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="email">E-mail</Label>
                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Senha</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Aguarde..." : signup ? "Criar conta" : "Entrar"}
              </Button>
            </form>
            <Button variant="outline" className="mt-3 w-full" onClick={google}>
              Continuar com Google
            </Button>
            <button
              type="button"
              onClick={() => setSignup((s) => !s)}
              className="mt-4 w-full text-sm text-muted-foreground hover:text-foreground"
            >
              {signup ? "Já tenho conta — entrar" : "Não tenho conta — criar agora"}
            </button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
