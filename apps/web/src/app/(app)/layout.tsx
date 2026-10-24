import { Store } from "lucide-react";
import { Badge } from "@repo/ui";
import { requirePageUser } from "@/lib/auth";
import { AppSidebar } from "@/components/app-sidebar";
import { LogoutButton } from "@/components/logout-button";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requirePageUser();

  return (
    <div className="min-h-screen bg-muted/30">
      <AppSidebar
        user={{
          name: user.name,
          roleName: user.roleName,
          tenantName: user.tenantName,
          storeName: user.storeName,
          permissions: user.permissions,
          phone: user.phone,
        }}
      />

      <div className="lg:pl-72">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-3 border-b bg-background/85 px-4 backdrop-blur lg:px-8">
          <div className="flex items-center gap-2.5 lg:hidden">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Store className="h-4 w-4" />
            </div>
            <div>
              <p className="text-sm font-semibold leading-tight">Savdo ERP</p>
              <p className="text-[11px] text-muted-foreground">{user.tenantName}</p>
            </div>
          </div>

          <div className="hidden items-center gap-2 text-sm text-muted-foreground lg:flex">
            <span className="font-medium text-foreground">{user.tenantName}</span>
            {user.storeName && (
              <>
                <span className="text-border">/</span>
                <span>{user.storeName}</span>
              </>
            )}
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <Badge variant="secondary" className="hidden sm:inline-flex">
              {user.roleName}
            </Badge>
            <div className="hidden text-right sm:block">
              <p className="text-sm font-medium leading-tight">{user.name}</p>
              <p className="text-[11px] text-muted-foreground">{user.phone}</p>
            </div>
            <LogoutButton />
          </div>
        </header>

        <main className="mx-auto max-w-7xl p-4 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
