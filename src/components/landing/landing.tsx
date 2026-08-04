import { Button } from "@/components/ui/button";
import { Link } from "@tanstack/react-router";

export function Hero() {
  return (
    <section className="relative overflow-hidden pt-32 pb-24 sm:pt-40 sm:pb-32">
      <div className="container relative z-10 mx-auto px-4">
        <div className="mx-auto max-w-3xl text-center">
          <h1 className="mb-6 text-5xl font-bold tracking-tight text-foreground sm:text-7xl">
            Sua vida financeira sob <span className="text-primary">controle absoluto.</span>
          </h1>
          <p className="mb-10 text-xl text-muted-foreground">
            O Espaço Financeiro é a plataforma moderna para gerir despesas, planejar o futuro e alcançar liberdade financeira, seja sozinho ou com sua família.
          </p>
          <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Button size="lg" className="h-12 px-8 text-base font-semibold" asChild>
              <Link to="/auth">Começar agora</Link>
            </Button>
            <Button variant="outline" size="lg" className="h-12 px-8 text-base font-semibold">
              Ver demonstração
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}

export function Features() {
  return (
    <section className="bg-muted/50 py-24 sm:py-32">
      <div className="container mx-auto px-4">
        <div className="grid gap-12 sm:grid-cols-3">
          <div className="rounded-2xl bg-background p-8 shadow-sm">
            <h3 className="mb-4 text-xl font-bold">Gestão Multiusuário</h3>
            <p className="text-muted-foreground">Compartilhe espaços com sua família ou sócios, com permissões granulares.</p>
          </div>
          <div className="rounded-2xl bg-background p-8 shadow-sm">
            <h3 className="mb-4 text-xl font-bold">Lançamentos Inteligentes</h3>
            <p className="text-muted-foreground">Lançamentos recorrentes fixos ou variáveis para prever seus gastos reais.</p>
          </div>
          <div className="rounded-2xl bg-background p-8 shadow-sm">
            <h3 className="mb-4 text-xl font-bold">IA de Comprovantes</h3>
            <p className="text-muted-foreground">Tire foto dos seus recibos e nossa IA processa tudo automaticamente.</p>
          </div>
        </div>
      </div>
    </section>
  );
}

export function CTA() {
  return (
    <section className="py-24 sm:py-32">
      <div className="container mx-auto px-4 text-center">
        <h2 className="mb-6 text-3xl font-bold sm:text-4xl">Pronto para transformar suas finanças?</h2>
        <Button size="lg" asChild>
          <Link to="/auth">Criar minha conta gratuita</Link>
        </Button>
      </div>
    </section>
  );
}

export function Navbar() {
  return (
    <nav className="fixed top-0 z-50 w-full border-b bg-background/80 backdrop-blur-md">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <span className="text-xl font-bold tracking-tight text-primary">Espaço Financeiro</span>
        <Button variant="ghost" size="sm" asChild>
          <Link to="/auth">Entrar</Link>
        </Button>
      </div>
    </nav>
  );
}

export function Footer() {
  return (
    <footer className="border-t py-12">
      <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
        &copy; 2026 Espaço Financeiro. Todos os direitos reservados.
      </div>
    </footer>
  );
}