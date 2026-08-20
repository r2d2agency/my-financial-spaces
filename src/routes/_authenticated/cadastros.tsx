import { createFileRoute, Outlet, Link } from "@tanstack/react-router";
import { 
  Users, 
  Tag, 
  Layers, 
  Target,
  ArrowLeft
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/cadastros")({
  component: CadastrosLayout,
});

function CadastrosLayout() {
  const menuItems = [
    { label: "Contatos", icon: Users, to: "/cadastros/contatos" },
    { label: "Categorias", icon: Layers, to: "/cadastros/categorias" },
    { label: "Centros de Custo", icon: Target, to: "/cadastros/centros-de-custo" },
    { label: "Tags", icon: Tag, to: "/cadastros/tags" },
  ];

  return (
    <div className="flex flex-col h-full bg-background -mt-6 -mx-6 md:-mx-8 lg:-mx-10 overflow-hidden">
      <header className="bg-white border-b border-border py-4 px-6 flex items-center gap-4 sticky top-0 z-10">
        <Link to="/dashboard">
          <Button variant="ghost" size="icon" className="rounded-full">
            <ArrowLeft className="size-5" />
          </Button>
        </Link>
        <h1 className="text-xl font-bold text-slate-900">Cadastros</h1>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar Interna */}
        <aside className="w-64 border-r bg-white hidden md:block">
          <nav className="p-4 space-y-1">
            {menuItems.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                activeProps={{ className: "bg-blue-50 text-blue-600" }}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
                )}
              >
                <item.icon className="size-4" />
                {item.label}
              </Link>
            ))}
          </nav>
        </aside>

        {/* Conteúdo da Aba */}
        <main className="flex-1 overflow-y-auto bg-slate-50/30">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
