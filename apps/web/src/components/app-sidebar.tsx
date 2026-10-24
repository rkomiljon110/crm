"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Boxes,
  Braces,
  LayoutDashboard,
  Lock,
  NotebookPen,
  Package,
  ReceiptText,
  ScanBarcode,
  Settings,
  Store,
  Truck,
  Users,
  Wallet,
} from "lucide-react";
import { cn } from "@repo/ui";
import { LogoutButton } from "@/components/logout-button";

const AVAILABLE: Array<{
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  permission: string | null;
}> = [
  { href: "/pos", label: "Kassa (POS)", icon: ScanBarcode, permission: "pos.use" },
  { href: "/dashboard", label: "Boshqaruv paneli", icon: LayoutDashboard, permission: "dashboard.view" },
  { href: "/api-docs", label: "API interfeysi", icon: Braces, permission: null },
];

const UPCOMING = [
  { href: "/sales", label: "Savdolar", icon: ReceiptText, permission: "sales.view", stage: "4-bosqich" },
  { href: "/customers", label: "Nasiya daftari", icon: NotebookPen, permission: "customers.view", stage: "6-bosqich" },
  { href: "/products", label: "Tovarlar", icon: Package, permission: "products.view", stage: "3-bosqich" },
  { href: "/inventory", label: "Ombor / Reviziya", icon: Boxes, permission: "inventory.view", stage: "3-bosqich" },
  { href: "/suppliers", label: "Yetkazib beruvchilar", icon: Truck, permission: "suppliers.view", stage: "3-bosqich" },
  { href: "/finance", label: "Moliya / Kassa", icon: Wallet, permission: "finance.view", stage: "5-bosqich" },
  { href: "/staff", label: "Xodimlar", icon: Users, permission: "staff.manage", stage: "5-bosqich" },
  { href: "/settings", label: "Sozlamalar", icon: Settings, permission: "settings.manage", stage: "5-bosqich" },
];

interface AppSidebarProps {
  user: {
    name: string;
    roleName: string;
    tenantName: string;
    storeName: string | null;
    permissions: string[];
    phone: string;
  };
}

export function AppSidebar({ user }: AppSidebarProps) {
  const pathname = usePathname();
  const available = AVAILABLE.filter(
    (item) => !item.permission || user.permissions.includes(item.permission),
  );
  const upcoming = UPCOMING.filter((item) => user.permissions.includes(item.permission));

  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-72 flex-col border-r bg-card lg:flex">
      <div className="flex h-16 items-center gap-3 border-b px-6">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <Store className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold leading-tight">Savdo ERP</p>
          <p className="truncate text-xs text-muted-foreground">{user.tenantName}</p>
        </div>
      </div>

      <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-4">
        <div>
          <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Ish maydoni
          </p>
          <div className="space-y-1">
            {available.map((item) => {
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                    active
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-accent hover:text-foreground",
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </div>
        </div>

        <div>
          <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Keyingi bosqichlar
          </p>
          <div className="space-y-1">
            {upcoming.map((item) => (
              <div
                key={item.href}
                className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground/70"
                title={`${item.label} — ${item.stage}`}
              >
                <item.icon className="h-4 w-4" />
                <span className="flex-1">{item.label}</span>
                <Lock className="h-3 w-3 opacity-50" />
              </div>
            ))}
          </div>
        </div>
      </nav>

      <div className="border-t p-3">
        <div className="rounded-lg bg-muted/60 p-3">
          <p className="truncate text-sm font-medium">{user.name}</p>
          <p className="text-xs text-muted-foreground">
            {user.roleName}
            {user.storeName ? ` · ${user.storeName}` : ""}
          </p>
          <div className="mt-2">
            <LogoutButton className="h-8 w-full justify-start px-2" />
          </div>
        </div>
      </div>
    </aside>
  );
}
