import type { Metadata } from "next";
import {
  AlertTriangle,
  Boxes,
  Building2,
  CheckCircle2,
  HandCoins,
  Layers,
  Package,
  ShieldCheck,
  Store,
  TrendingUp,
  Truck,
  Users,
  Wallet,
  Warehouse,
} from "lucide-react";
import {
  Badge,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@repo/ui";
import { formatDate, formatNumber, formatUZS, formatUsd } from "@repo/shared";
import { requirePageUser } from "@/lib/auth";
import { getOverview } from "@/lib/dashboard";

export const metadata: Metadata = { title: "Boshqaruv paneli" };
export const dynamic = "force-dynamic";

const ARCHITECTURE = [
  {
    name: "apps/web",
    tech: "Next.js 14 · App Router",
    status: "Ishlayapti",
    detail: "Admin portal, auth, tenant sessiyasi",
  },
  {
    name: "packages/database",
    tech: "PostgreSQL · Prisma 6",
    status: "Ishlayapti",
    detail: "26 jadval, RLS, migratsiyalar, seed",
  },
  {
    name: "packages/shared",
    tech: "TypeScript · Zod",
    status: "Ishlayapti",
    detail: "RBAC katalogi, DTO, moliya formulalari",
  },
  {
    name: "packages/ui",
    tech: "React · Tailwind · Radix",
    status: "Ishlayapti",
    detail: "Umumiy dizayn tizimi komponentlari",
  },
  {
    name: "apps/desktop · apps/mobile · apps/backend",
    tech: "Tauri 2 · Expo · NestJS",
    status: "Keyingi bosqich",
    detail: "Offline sync shartnomasi tayyor",
  },
];

const NEXT_STEPS = [
  "4-bosqich — POS terminal UI: hotkeylar, aralash to'lov oynasi, ESC/POS chek.",
  "5-bosqich — Moliya va P&L: cash flow, ABC/XYZ tahlili, eksport.",
  "6-bosqich — Nasiya daftari va Telegram bot orqali eslatmalar.",
  "Keyingi — NestJS backend ajratish, WebSocket realtime va BullMQ navbatlari.",
];

function StatCard({
  title,
  value,
  hint,
  icon: Icon,
  tone = "default",
}: {
  title: string;
  value: string;
  hint: string;
  icon: React.ComponentType<{ className?: string }>;
  tone?: "default" | "success" | "warning" | "danger";
}) {
  const toneClass = {
    default: "bg-primary/10 text-primary",
    success: "bg-success/10 text-success",
    warning: "bg-warning/15 text-amber-700",
    danger: "bg-destructive/10 text-destructive",
  }[tone];

  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="mt-2 truncate text-2xl font-semibold tracking-tight money">{value}</p>
            <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
          </div>
          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${toneClass}`}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default async function DashboardPage() {
  const user = await requirePageUser("dashboard.view");
  const data = await getOverview(user.tenantId);

  const margin =
    data.revenue30 > 0 ? Math.round((data.grossProfit30 / data.revenue30) * 1000) / 10 : 0;
  const netProfit = data.grossProfit30 - data.expensesMonth;
  const roleBadgeVariant = user.roleCode === "SUPER_ADMIN" ? "success" : "secondary";

  return (
    <div className="space-y-6">
      {/* Sarlavha */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">
            {formatDate(new Date())} · {data.tenant.name}
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">Boshqaruv paneli</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Multi-tenant arxitektura, RBAC va moliyaviy yadro ishga tushirilgan holati.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={roleBadgeVariant}>{user.roleName}</Badge>
          <Badge variant="outline">1 USD = {formatNumber(data.tenant.usdRate)} so&apos;m</Badge>
          <Badge variant="success" className="gap-1">
            <CheckCircle2 className="h-3 w-3" />
            1–3 bosqich yakunlandi
          </Badge>
        </div>
      </div>

      {/* Asosiy KPI */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="30 kunlik savdo"
          value={formatUZS(data.revenue30)}
          hint={formatUsd(data.revenue30, data.tenant.usdRate) || "USD kursi sozlanmagan"}
          icon={TrendingUp}
        />
        <StatCard
          title="Yalpi foyda (30 kun)"
          value={formatUZS(data.grossProfit30)}
          hint={`Marja: ${margin}% · sof foyda ${formatUZS(netProfit)}`}
          icon={Wallet}
          tone="success"
        />
        <StatCard
          title="Mijozlar qarzi"
          value={formatUZS(data.receivables)}
          hint="Nasiya daftari · ochiq qoldiq"
          icon={HandCoins}
          tone={data.receivables > 0 ? "warning" : "success"}
        />
        <StatCard
          title="Yetkazib beruvchilarga qarz"
          value={formatUZS(data.payables)}
          hint="To'lanmagan ta'minot qoldig'i"
          icon={Truck}
          tone={data.payables > 0 ? "danger" : "success"}
        />
      </div>

      {/* Bugungi ko'rsatkichlar */}
      <Card>
        <CardContent className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Bugungi savdo</p>
            <p className="mt-1 text-lg font-semibold money">{formatUZS(data.today.revenue)}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Bugungi cheklar</p>
            <p className="mt-1 text-lg font-semibold money">{formatNumber(data.today.orders)} ta</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Oylik xarajat</p>
            <p className="mt-1 text-lg font-semibold money">{formatUZS(data.expensesMonth)}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Sof foyda (30 kun)</p>
            <p className="mt-1 text-lg font-semibold money">{formatUZS(netProfit)}</p>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Bazaviy ko'rsatkichlar */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Tizimdagi ma&apos;lumotlar</CardTitle>
            <CardDescription>Demo tenant bo&apos;yicha real qaydlar</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {[
                { label: "Filiallar", value: data.counts.stores, icon: Store },
                { label: "Omborlar", value: data.counts.warehouses, icon: Warehouse },
                { label: "Tovarlar", value: data.counts.products, icon: Package },
                { label: "Variantlar", value: data.counts.variants, icon: Layers },
                { label: "Mijozlar", value: data.counts.customers, icon: Users },
                { label: "Xodimlar", value: data.counts.employees, icon: Building2 },
                { label: "Cheklar", value: data.counts.orders, icon: Boxes },
                { label: "Ruxsatlar", value: data.counts.permissions, icon: ShieldCheck },
              ].map((item) => (
                <div key={item.label} className="rounded-lg border bg-muted/30 p-3">
                  <item.icon className="h-4 w-4 text-muted-foreground" />
                  <p className="mt-2 text-xl font-semibold money">{formatNumber(item.value)}</p>
                  <p className="text-xs text-muted-foreground">{item.label}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Kam qolgan tovarlar */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-2">
              <CardTitle>Kam qolgan tovarlar</CardTitle>
              <Badge variant={data.lowStock.length > 0 ? "warning" : "success"}>
                {data.lowStock.length} ta
              </Badge>
            </div>
            <CardDescription>Minimal qoldiq chegarasidan past</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {data.lowStock.length === 0 ? (
              <div className="flex items-center gap-2 rounded-md bg-success/5 p-3 text-sm text-success">
                <CheckCircle2 className="h-4 w-4" />
                Barcha tovarlar yetarli.
              </div>
            ) : (
              data.lowStock.slice(0, 6).map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between gap-3 rounded-md border p-2.5"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{item.productName}</p>
                    <p className="truncate text-xs text-muted-foreground">{item.variantName}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
                    <span className="text-sm font-semibold money">{formatNumber(item.stock)}</span>
                    <span className="text-xs text-muted-foreground">/ {formatNumber(item.minStock)}</span>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* RBAC va arxitektura */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Granular RBAC</CardTitle>
            <CardDescription>
              {user.roleName} roli · {user.permissions.length} ta ruxsat
            </CardDescription>
          </CardHeader>
          <CardContent className="px-0 pb-2">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-5">Rol</TableHead>
                  <TableHead>Kod</TableHead>
                  <TableHead className="text-right">Xodim</TableHead>
                  <TableHead className="pr-5 text-right">Ruxsat</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.roles.map((role) => (
                  <TableRow key={role.id}>
                    <TableCell className="pl-5 font-medium">{role.name}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">{role.code}</TableCell>
                    <TableCell className="text-right money">{role.usersCount}</TableCell>
                    <TableCell className="pr-5 text-right money">{role.permissionsCount}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Monorepo holati</CardTitle>
            <CardDescription>Turborepo ish maydonlari</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {ARCHITECTURE.map((item) => (
              <div key={item.name} className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-mono text-sm">{item.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{item.detail}</p>
                </div>
                <Badge variant={item.status === "Ishlayapti" ? "success" : "secondary"} className="shrink-0">
                  {item.status}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Keyingi qadamlar */}
      <Card>
        <CardHeader>
          <CardTitle>Keyingi qadamlar</CardTitle>
          <CardDescription>Offline-first POS va backend sync engine sari</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          {NEXT_STEPS.map((step, index) => (
            <div key={step} className="flex items-start gap-3 rounded-lg border bg-muted/20 p-3.5">
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                {index + 4}
              </div>
              <p className="text-sm leading-relaxed text-muted-foreground">{step}</p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
