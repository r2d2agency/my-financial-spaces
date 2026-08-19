import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/cadastros/categorias")({
  component: () => <div className="p-6 text-center text-muted-foreground">Módulo de Categorias em desenvolvimento...</div>,
});
