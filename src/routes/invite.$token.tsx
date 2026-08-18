import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { getInviteDetails, acceptInvite } from "@/lib/workspace.functions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { getCurrentUser } from "@/lib/auth-client.functions";

export const Route = createFileRoute("/invite/$token")({
  component: InvitePage,
});

function InvitePage() {
  const { token } = Route.useParams();
  const navigate = useNavigate();
  const fetchDetails = useServerFn(getInviteDetails);
  const processAccept = useServerFn(acceptInvite);
  const getUser = useServerFn(getCurrentUser);

  const { data: invite, isLoading, error } = useQuery({
    queryKey: ["invite", token],
    queryFn: () => fetchDetails({ data: { token } }),
    retry: false,
  });

  const { data: user } = useQuery({
    queryKey: ["current-user"],
    queryFn: () => getUser({}),
  });

  const accept = useMutation({
    mutationFn: () => processAccept({ data: { token } }),
    onSuccess: (res) => {
      toast.success("Convite aceito com sucesso!");
      localStorage.setItem("ef.workspace", res.workspaceId);
      navigate({ to: "/dashboard" });
    },
    onError: (e: Error) => {
      toast.error(e.message);
    },
  });

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !invite) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            <AlertCircle className="mx-auto h-12 w-12 text-destructive" />
            <CardTitle className="mt-4">Convite Inválido</CardTitle>
            <CardDescription>
              Este convite expirou, foi cancelado ou não existe.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full">
              <Link to="/">Voltar ao Início</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isCorrectUser = user && user.email.toLowerCase() === invite.email.toLowerCase();

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <CheckCircle2 className="h-10 w-10 text-primary" />
          </div>
          <CardTitle>Você foi convidado!</CardTitle>
          <CardDescription>
            Participe do espaço financeiro <strong>{invite.workspace_name}</strong> como <strong>{invite.role}</strong>.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!user ? (
            <div className="space-y-3">
              <p className="text-center text-sm text-muted-foreground">
                Para aceitar o convite, você precisa entrar na sua conta ou criar uma.
              </p>
              <Button asChild className="w-full">
                <Link to="/auth" search={{ redirect: `/invite/${token}` }}>
                  Entrar ou Criar Conta
                </Link>
              </Button>
            </div>
          ) : !isCorrectUser ? (
            <div className="space-y-3 text-center">
              <p className="text-sm text-destructive">
                Você está logado como <strong>{user.email}</strong>, mas este convite foi enviado para <strong>{invite.email}</strong>.
              </p>
              <Button 
                variant="outline" 
                className="w-full"
                onClick={() => {
                  localStorage.removeItem("auth_token");
                  window.location.href = `/auth?redirect=/invite/${token}`;
                }}
              >
                Sair e Entrar com outro E-mail
              </Button>
            </div>
          ) : (
            <Button 
              className="w-full" 
              onClick={() => accept.mutate()}
              disabled={accept.isPending}
            >
              {accept.isPending ? "Aceitando..." : "Aceitar Convite"}
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
