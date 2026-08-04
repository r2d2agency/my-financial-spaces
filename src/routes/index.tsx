import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { getCurrentUser } from "@/lib/auth-client.functions";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  const getUser = useServerFn(getCurrentUser);
  const { data: user, isLoading } = useQuery({
    queryKey: ["auth-check"],
    queryFn: () => getUser({}),
  });

  if (isLoading) return null;

  if (user) {
    return <Navigate to="/dashboard" />;
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4 text-center">
      <div className="max-w-md space-y-6">
        <h1 className="text-4xl font-extrabold tracking-tight text-primary sm:text-5xl">
          Espaço Financeiro
        </h1>
        <p className="text-xl text-muted-foreground">
          Sua gestão financeira moderna, simples e segura.
        </p>
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Button asChild size="lg" className="rounded-lg px-8 py-6 text-lg font-semibold">
            <Link to="/auth">Começar Agora</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}