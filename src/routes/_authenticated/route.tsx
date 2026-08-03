import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { WorkspaceProvider } from "@/lib/workspace";
import { AppShell } from "@/components/app/app-shell";
import { getCurrentUser } from "@/lib/auth-client.functions";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const user = await getCurrentUser();
    if (!user) throw redirect({ to: "/auth", replace: true });
  },
  component: () => (
    <WorkspaceProvider>
      <AppShell>
        <Outlet />
      </AppShell>
    </WorkspaceProvider>
  ),
});
