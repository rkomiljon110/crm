import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  Boxes,
  Clock3,
  Lock,
  NotebookPen,
  Package,
  ReceiptText,
  ScanBarcode,
  Settings,
  ShieldCheck,
  Truck,
  Users,
  Wallet,
} from "lucide-react";
import { Badge, Card, CardContent, CardHeader, CardTitle } from "@repo/ui";
import type { PermissionKey } from "@repo/shared";
import { requirePageUser } from "@/lib/auth";

const MODULES: Record<
  string,
  {
    title: string;
    stage: string;
    description: string;
    planned: string[];
    permission: PermissionKey;
    icon: React.ComponentType<{ className?: string }>;
  }
> = {
  pos: {
    title: "Kassa (POS)",
    stage: "4-bosqich",
    description: "Tezkor savdo terminali: shtrix-kod, aralash to'lov, nasiya va chek.",
    planned: ["F1–F4 hotkeylar va skaner qidiruvi", "Naqd / karta / nasiya aralash to'lov", "80mm ESC-POS chek va smena X/Z hisoboti"],
    permission: "pos.use",
    icon: ScanBarcode,
  },
  sales: {
    title: "Savdolar",
    stage: "4-bosqich",
    description: "Cheklar tarixi, qaytarish va smena bo'yicha savdo jurnali.",
    planned: ["Chek tafsiloti va qayta chop etish", "Qaytarish (vozvrat) jarayoni", "Kassir va davr bo'yicha filtr"],
    permission: "sales.view",
    icon: ReceiptText,
  },
  customers: {
    title: "Nasiya daftari",
    stage: "6-bosqich",
    description: "Mijoz balansi, kredit limiti, muddati o'tgan qarzlar va Telegram eslatmalar.",
    planned: ["Qarz akt-sverka va to'lov tarixi", "Kredit limiti va bloklash", "Telegram bot orqali eslatma"],
    permission: "customers.view",
    icon: NotebookPen,
  },
  products: {
    title: "Tovarlar",
    stage: "3-bosqich",
    description: "Katalog, variantlar, shtrix-kodlar va narxlar boshqaruvi.",
    planned: ["Variant va shtrix-kodlar", "Chakana / ulgurji / tannarx", "Narx o'zgarishi audit jurnali"],
    permission: "products.view",
    icon: Package,
  },
  inventory: {
    title: "Ombor / Reviziya",
    stage: "3-bosqich",
    description: "Ko'p omborli qoldiq, kirim partiyalari, reviziya va ko'chirish.",
    planned: ["Partiya tannarxi va FIFO", "Mobil skaner bilan reviziya", "Omborlar orasida transfer"],
    permission: "inventory.view",
    icon: Boxes,
  },
  suppliers: {
    title: "Yetkazib beruvchilar",
    stage: "3-bosqich",
    description: "Ta'minotchi qarzlari, to'lovlar va partiya qabul qilish.",
    planned: ["Qarz hisob-kitobi", "To'lov jurnali", "Ta'minotchi bo'yicha xarid tarixi"],
    permission: "suppliers.view",
    icon: Truck,
  },
  finance: {
    title: "Moliya / Kassa",
    stage: "5-bosqich",
    description: "Xarajatlar, kassa smenalari, P&L va cash flow hisobotlari.",
    planned: ["Xarajat kategoriyalari", "Smena ochish/yopish", "P&L va ABC/XYZ tahlil"],
    permission: "finance.view",
    icon: Wallet,
  },
  staff: {
    title: "Xodimlar",
    stage: "5-bosqich",
    description: "Xodimlar, rollar va granular ruxsatlarni boshqarish.",
    planned: ["Xodim qo'shish va bloklash", "Rolga ruxsat berish", "Sessiyalarni bekor qilish"],
    permission: "staff.manage",
    icon: Users,
  },
  settings: {
    title: "Sozlamalar",
    stage: "5-bosqich",
    description: "Biznes profili, filiallar, valyuta kursi va chek matni.",
    planned: ["USD kursi va valyuta", "Filial / ombor sozlamalari", "Chek footer va soliq"],
    permission: "settings.manage",
    icon: Settings,
  },
};

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: { module: string[] } }): Promise<Metadata> {
  const info = MODULES[params.module[0] ?? ""];
  return { title: info?.title ?? "Modul" };
}

export default async function PlannedModulePage({ params }: { params: { module: string[] } }) {
  const key = params.module[0] ?? "";
  const info = MODULES[key];
  if (!info) notFound();

  const user = await requirePageUser(info.permission);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-muted-foreground">{user.tenantName} · {info.stage}</p>
        <h1 className="mt-1 flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <info.icon className="h-6 w-6 text-primary" />
          {info.title}
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{info.description}</p>
      </div>

      <Card className="border-dashed">
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle className="flex items-center gap-2">
              <Clock3 className="h-4 w-4 text-primary" />
              Modul rejalashtirilgan
            </CardTitle>
            <Badge variant="secondary">{info.stage}</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            {info.planned.map((item) => (
              <div key={item} className="rounded-lg border bg-muted/30 p-3 text-sm leading-relaxed">
                {item}
              </div>
            ))}
          </div>
          <div className="flex items-start gap-2 rounded-lg border border-primary/20 bg-primary/5 p-3 text-sm text-muted-foreground">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <span>
              Sizning rolingizda bu modulga kirish ruxsati bor ({info.permission}). Sahifa
              funksiyalari keyingi bosqichda ulanadi; hozir ma&apos;lumotlar bazasi, RBAC va tenant
              izolyatsiyasi tayyor.
            </span>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Lock className="h-3.5 w-3.5" />
            Ruxsat kaliti: <span className="font-mono">{info.permission}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
