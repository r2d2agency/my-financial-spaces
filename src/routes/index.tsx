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
    <div className="flex min-h-screen flex-col bg-white">
      {/* Header */}
      <header className="container mx-auto flex items-center justify-between p-6">
        <div className="flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-white shadow-lg shadow-primary/20">
            <span className="text-xl font-bold">E</span>
          </div>
          <span className="text-xl font-bold tracking-tight text-foreground">Espaço Financeiro</span>
        </div>
        <nav className="hidden items-center gap-8 md:flex">
          <a href="#features" className="text-sm font-medium text-muted-foreground transition-colors hover:text-primary">Recursos</a>
          <a href="#about" className="text-sm font-medium text-muted-foreground transition-colors hover:text-primary">Sobre</a>
          <Link to="/auth" className="text-sm font-medium text-muted-foreground transition-colors hover:text-primary">Entrar</Link>
          <Button asChild size="sm" className="rounded-full px-6">
            <Link to="/auth">Criar Conta</Link>
          </Button>
        </nav>
      </header>

      {/* Hero Section */}
      <main className="flex-1">
        <section className="container mx-auto px-6 py-20 text-center md:py-32">
          <div className="mx-auto max-w-4xl space-y-8">
            <div className="inline-flex items-center rounded-full bg-primary/10 px-4 py-1.5 text-sm font-semibold text-primary">
              ✨ Gestão Financeira Inteligente
            </div>
            <h1 className="text-5xl font-extrabold tracking-tight text-foreground sm:text-7xl">
              Assuma o controle total do seu <span className="text-primary">destino financeiro</span>
            </h1>
            <p className="mx-auto max-w-2xl text-xl text-muted-foreground">
              Uma plataforma moderna e intuitiva para gerir suas finanças pessoais e empresariais. Simple como deve ser, poderosa como você precisa.
            </p>
            <div className="flex flex-col items-center justify-center gap-4 pt-4 sm:flex-row">
              <Button asChild size="lg" className="h-14 rounded-full px-10 text-lg font-semibold shadow-xl shadow-primary/20">
                <Link to="/auth">Começar gratuitamente</Link>
              </Button>
              <Button variant="outline" size="lg" className="h-14 rounded-full px-10 text-lg font-semibold">
                Ver demonstração
              </Button>
            </div>
            
            {/* Visual Mockup/Placeholder */}
            <div className="relative mt-20 overflow-hidden rounded-2xl border bg-slate-50 p-2 shadow-2xl">
              <div className="aspect-video w-full rounded-xl bg-gradient-to-br from-primary/5 to-primary/20 flex items-center justify-center">
                <div className="text-center">
                  <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-white flex items-center justify-center shadow-lg">
                    <span className="text-3xl text-primary">📊</span>
                  </div>
                  <p className="font-medium text-slate-600">Interface Moderna & Intuitiva</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Features Preview */}
        <section id="features" className="bg-slate-50 py-24">
          <div className="container mx-auto px-6">
            <div className="mb-16 text-center">
              <h2 className="text-3xl font-bold text-foreground sm:text-4xl">Tudo o que você precisa</h2>
              <p className="mt-4 text-muted-foreground">Ferramentas completas para organizar sua vida financeira.</p>
            </div>
            <div className="grid gap-8 md:grid-cols-3">
              {[
                { title: "Controle de Gastos", icon: "💸", desc: "Monitore cada centavo com categorias inteligentes e relatórios detalhados." },
                { title: "Gestão de Cartões", icon: "💳", desc: "Acompanhe todas as suas faturas e limites em um só lugar." },
                { title: "Planejamento", icon: "🎯", desc: "Defina metas, crie orçamentos e acompanhe sua evolução mensal." }
              ].map((item, i) => (
                <div key={i} className="rounded-2xl bg-white p-8 shadow-sm transition-transform hover:-translate-y-1">
                  <div className="mb-4 text-4xl">{item.icon}</div>
                  <h3 className="mb-2 text-xl font-bold text-foreground">{item.title}</h3>
                  <p className="text-muted-foreground">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t bg-white py-12">
        <div className="container mx-auto px-6 text-center text-sm text-muted-foreground">
          <p>© 2026 Espaço Financeiro. Feito para você evoluir.</p>
        </div>
      </footer>
    </div>
  );
}