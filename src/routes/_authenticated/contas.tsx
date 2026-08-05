import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/contas")({
  component: () => <div className="p-6">Contas</div>,
});
