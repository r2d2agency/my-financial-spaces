import { Hero, Features, CTA, Footer, Navbar } from "@/components/landing/landing";
import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  component: LandingPage,
});

function LandingPage() {
  return (
    <div className="min-h-screen bg-background font-sans selection:bg-primary/20">
      <Navbar />
      <main>
        <Hero />
        <Features />
        <section className="bg-muted/30 py-12">
          <div className="container mx-auto px-4 text-center">
            <Link 
              to="/_authenticated/dashboard" 
              className="text-sm text-muted-foreground hover:text-primary transition-colors underline underline-offset-4"
            >
              Acessar Documentação Técnica e Status do Projeto
            </Link>
          </div>
        </section>
        <CTA />
      </main>
      <Footer />
    </div>
  );
}