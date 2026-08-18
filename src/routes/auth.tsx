import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { db } from "@/lib/db-browser";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Wallet, Eye, EyeOff, ShieldAlert } from "lucide-react";
import { signUp as localSignUp, signIn as localSignIn, changePassword } from "@/lib/auth.functions";
import { useServerFn } from "@tanstack/react-start";

export const Route = createFileRoute("/auth")({
  validateSearch: z.object({ 
    mode: z.enum(["login", "signup"]).optional(),
    redirect: z.string().optional()
  }),
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
  const { mode, redirect: redirectPath } = Route.useSearch();
  const navigate = useNavigate();
  const [signup, setSignup] = useState(mode === "signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const doSignUp = useServerFn(localSignUp);
  const doSignIn = useServerFn(localSignIn);
  // Fluxo de troca obrigatória de senha (superadmin semeado no primeiro acesso)
  const doChangePassword = useServerFn(changePassword);
  const [resetToken, setResetToken] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

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
        navigate({ to: redirectPath || "/onboarding", replace: true });
      } else {
        const result = await doSignIn({ data: { email, password } });
        if (result.mustChangePassword) {
          // Não persiste a sessão até que a senha padrão seja substituída.
          setResetToken(result.sessionId);
          setNewPassword("");
          setConfirmPassword("");
          toast.info("Defina uma nova senha para continuar.");
        } else {
          localStorage.setItem("auth_token", result.sessionId);
          navigate({ to: redirectPath || "/dashboard", replace: true });
        }
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível continuar.");
    } finally {
      setLoading(false);
    }
  };

  const submitNewPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast.error("As senhas não coincidem.");
      return;
    }
    setLoading(true);
    try {
      await doChangePassword({ data: { sessionId: resetToken!, newPassword } });
      localStorage.setItem("auth_token", resetToken!);
      toast.success("Senha atualizada com sucesso!");
      navigate({ to: redirectPath || "/dashboard", replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível atualizar a senha.");
    } finally {
      setLoading(false);
    }
  };

  const google = async () => {
    toast.error("Login social não configurado no servidor local. Use e-mail e senha.");
  };

  if (resetToken) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4">
        <div className="w-full max-w-md">
          <div className="mb-6 flex items-center justify-center gap-2 font-semibold">
            <span className="grid size-8 place-items-center rounded-lg bg-primary text-primary-foreground">
              <Wallet className="size-4" />
            </span>
            Espaço Financeiro
          </div>
          <Card>
            <CardHeader>
              <div className="mb-2 flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <ShieldAlert className="size-5" />
              </div>
              <CardTitle>Defina uma nova senha</CardTitle>
              <CardDescription>
                Esta conta de administrador ainda usa a senha padrão. Por segurança, crie uma nova
                senha com no mínimo 8 caracteres para acessar a plataforma.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={submitNewPassword} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="new-password">Nova senha</Label>
                  <div className="relative">
                    <Input
                      id="new-password"
                      type={showPassword ? "text" : "password"}
                      minLength={8}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
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
                <div className="space-y-2">
                  <Label htmlFor="confirm-password">Confirmar nova senha</Label>
                  <Input
                    id="confirm-password"
                    type={showPassword ? "text" : "password"}
                    minLength={8}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Salvando..." : "Salvar e entrar"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

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
