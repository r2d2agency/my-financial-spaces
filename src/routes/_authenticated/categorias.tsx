import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_authenticated/categorias')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/_authenticated/categorias"!</div>
}
