import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/cadastros/tags")({
  component: () => <div className="p-6 text-center text-muted-foreground">Módulo de Tags em desenvolvimento...</div>,
});
