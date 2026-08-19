import { Hero, Features, CTA, Footer, Navbar } from "@/components/landing/landing";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  head: () => ({
    title: "Espaço Financeiro | Gestão Inteligente para sua Família e Negócio",
    meta: [
      {
        name: "description",
        content: "Organize suas finanças, cartões e planejamentos em um só lugar com o Espaço Financeiro. Simples, moderno e multiusuário.",
      },
      { property: "og:title", content: "Espaço Financeiro | Gestão Financeira Moderna" },
      { property: "og:description", content: "Controle completo de gastos, cartões e patrimônio em uma plataforma intuitiva." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LandingPage,
});

function LandingPage() {
  return (
    <div className="min-h-screen bg-background font-sans selection:bg-primary/20">
      <Navbar />
      <main>
        <Hero />
        <Features />
        <CTA />
      </main>
      <Footer />
    </div>
  );
}
