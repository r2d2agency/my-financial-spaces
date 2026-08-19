import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/cadastros/contatos")({
  component: () => <div className="p-6 text-center text-muted-foreground">Módulo de Contatos em desenvolvimento...</div>,
});
