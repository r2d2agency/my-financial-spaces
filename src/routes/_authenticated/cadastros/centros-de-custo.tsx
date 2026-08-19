import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/cadastros/centros-de-custo")({
  component: () => <div className="p-6 text-center text-muted-foreground">Módulo de Centros de Custo em desenvolvimento...</div>,
});
