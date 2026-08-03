import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { db } from "@/lib/db-browser";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Wallet,
  Users,
  CreditCard,
  TrendingDown,
  CalendarDays,
  PieChart,
  ShieldCheck,
} from "lucide-react";

export const Route = createFileRoute("/")({
  component: Landing,
  head: () => ({
    meta: [
      { title: "Espaço Financeiro — controle financeiro multiusuário" },
      {
        name: "description",
        content:
          "Crie espaços financeiros separados para sua vida pessoal, casa, família e negócio. Contas, cartões, dívidas, metas e permissões por usuário.",
      },
      { property: "og:title", content: "Espaço Financeiro" },
      {
        property: "og:description",
        content: "Vários espaços financeiros, um só login. Controle de receitas, despesas, cartões e dívidas.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

const features = [
  { icon: Wallet, title: "Espaços separados", desc: "Minha vida financeira, Casa e Família, Pequeno Negócio — sem misturar nada." },
  { icon: Users, title: "Multiusuário com permissões", desc: "Proprietário, admin, editor, visualizador e consultor. Lance despesas sem ver saldos." },
  { icon: CreditCard, title: "Cartões e faturas", desc: "Limites, fechamento, vencimento e parcelamentos organizados por fatura." },
  { icon: TrendingDown, title: "Dívidas e financiamentos", desc: "Acompanhe saldo devedor e simule antecipação de parcelas." },
  { icon: CalendarDays, title: "Calendário financeiro", desc: "Tudo o que entra e sai, dia por dia, com alertas de vencimento." },
  { icon: PieChart, title: "Planejado vs realizado", desc: "Planejamento mensal por categoria e relatórios comparativos." },
];

const plans = [
  { name: "Individual", price: "R$ 19", desc: "1 espaço, 1 usuário", items: ["Movimentações", "Cartões", "Metas"] },
  { name: "Família", price: "R$ 39", desc: "2 espaços, 5 usuários", items: ["Casa e Família", "Permissões", "Planejamento"], highlight: true },
  { name: "Premium", price: "R$ 69", desc: "5 espaços, 10 usuários", items: ["Dívidas + simulações", "Relatórios avançados", "Calendário"] },
  { name: "Profissional", price: "R$ 129", desc: "Espaços ilimitados", items: ["Acesso de consultor", "Auditoria", "Suporte prioritário"] },
];

function Landing() {
  const [logged, setLogged] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("auth_token");
    setLogged(!!token);
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <div className="flex items-center gap-2 font-semibold tracking-tight">
            <span className="grid size-8 place-items-center rounded-lg bg-primary text-primary-foreground">
              <Wallet className="size-4" />
            </span>
            Espaço Financeiro
          </div>
          <nav className="flex items-center gap-2">
            {logged ? (
              <Button asChild size="sm">
                <Link to="/dashboard">Ir para o painel</Link>
              </Button>
            ) : (
              <>
                <Button asChild variant="ghost" size="sm">
                  <Link to="/auth">Entrar</Link>
                </Button>
                <Button asChild size="sm">
                  <Link to="/auth" search={{ mode: "signup" }}>
                    Criar conta
                  </Link>
                </Button>
              </>
            )}
          </nav>
        </div>
      </header>

      <main>
        <section className="mx-auto max-w-6xl px-4 py-20 text-center">
          <p className="mx-auto mb-5 w-fit rounded-full border border-border bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
            14 dias grátis · sem cartão de crédito
          </p>
          <h1 className="mx-auto max-w-3xl text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
            Cada parte da sua vida financeira no seu próprio espaço
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg text-muted-foreground">
            Organize receitas, despesas, cartões, dívidas e metas em espaços independentes — e
            convide família, sócios ou seu contador com as permissões certas.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button asChild size="lg">
              <Link to="/auth" search={{ mode: "signup" }}>
                Começar agora
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <a href="#planos">Ver planos</a>
            </Button>
          </div>
        </section>

        <section className="border-y border-border/60 bg-muted/30 py-16">
          <div className="mx-auto grid max-w-6xl gap-4 px-4 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f) => (
              <Card key={f.title} className="border-border/60">
                <CardContent className="pt-6">
                  <f.icon className="size-5 text-primary" />
                  <h3 className="mt-3 font-semibold text-foreground">{f.title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{f.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section id="planos" className="mx-auto max-w-6xl px-4 py-20">
          <h2 className="text-center text-3xl font-bold tracking-tight text-foreground">Planos</h2>
          <p className="mt-2 text-center text-muted-foreground">
            Escolha pelo número de espaços e pessoas envolvidas.
          </p>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {plans.map((p) => (
              <Card key={p.name} className={p.highlight ? "border-primary shadow-lg" : "border-border/60"}>
                <CardContent className="pt-6">
                  <h3 className="font-semibold text-foreground">{p.name}</h3>
                  <p className="mt-2 text-3xl font-bold text-foreground">
                    {p.price}
                    <span className="text-sm font-normal text-muted-foreground">/mês</span>
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">{p.desc}</p>
                  <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
                    {p.items.map((i) => (
                      <li key={i} className="flex items-center gap-2">
                        <ShieldCheck className="size-4 text-primary" /> {i}
                      </li>
                    ))}
                  </ul>
                  <Button asChild className="mt-6 w-full" variant={p.highlight ? "default" : "outline"}>
                    <Link to="/auth" search={{ mode: "signup" }}>
                      Testar grátis
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-border/60 py-8 text-center text-sm text-muted-foreground">
        Espaço Financeiro · dados isolados por espaço, auditoria e conformidade LGPD.
      </footer>
    </div>
  );
}
