import type { Metadata } from "next";
import Link from "next/link";
import { Printer, ReceiptText } from "lucide-react";
import { formatDateTime, formatMoney } from "@repo/shared";
import {
  Badge,
  Button,
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
import { requirePageUser } from "@/lib/auth";
import { getRecentSales } from "@/lib/sales/receipts";

export const metadata: Metadata = { title: "Savdolar · Savdo ERP" };
export const dynamic = "force-dynamic";

const STATUS_LABELS: Record<string, string> = {
  COMPLETED: "Yakunlangan",
  PENDING: "Kutilmoqda",
  CANCELLED: "Bekor qilingan",
  REFUNDED: "Qaytarilgan",
};

const PAYMENT_LABELS: Record<string, string> = {
  PAID: "To'langan",
  PARTIAL: "Qismiy",
  UNPAID: "Nasiya",
  REFUNDED: "Qaytarilgan",
};

export default async function SalesPage() {
  const user = await requirePageUser("sales.view");
  const sales = await getRecentSales(user.tenantId);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <ReceiptText className="h-5 w-5 text-primary" />
            <h1 className="text-2xl font-semibold tracking-tight">Savdolar</h1>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Oxirgi {sales.length} chek · chekni qayta chop etish uchun oching
          </p>
        </div>
        <Button asChild>
          <Link href="/pos">Kassaga o&apos;tish</Link>
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Cheklar jurnali</CardTitle>
          <CardDescription>
            Har bir chek 80mm formatda chop etiladi yoki PDF sifatida saqlanadi.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-0 pb-0">
          {sales.length === 0 ? (
            <p className="px-6 pb-6 text-sm text-muted-foreground">
              Hozircha savdo yo&apos;q. POS terminaldan birinchi chekni yarating.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-6">Chek</TableHead>
                  <TableHead>Sana</TableHead>
                  <TableHead>Filial</TableHead>
                  <TableHead>Mijoz</TableHead>
                  <TableHead>To&apos;lov</TableHead>
                  <TableHead className="text-right">Jami</TableHead>
                  <TableHead className="pr-6 text-right">Amal</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sales.map((sale) => (
                  <TableRow key={sale.id}>
                    <TableCell className="pl-6">
                      <p className="font-mono text-xs font-medium">{sale.number}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {sale.itemsCount} pozitsiya · {STATUS_LABELS[sale.status] ?? sale.status}
                      </p>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                      {formatDateTime(sale.createdAt)}
                    </TableCell>
                    <TableCell className="text-xs">{sale.store?.name ?? "—"}</TableCell>
                    <TableCell className="text-xs">{sale.customer?.name ?? "Mijozsiz"}</TableCell>
                    <TableCell>
                      <Badge variant={sale.paymentStatus === "PAID" ? "success" : "warning"}>
                        {PAYMENT_LABELS[sale.paymentStatus] ?? sale.paymentStatus}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatMoney(sale.totalAmount)}
                    </TableCell>
                    <TableCell className="pr-6 text-right">
                      <Button variant="outline" size="sm" asChild>
                        <a href={`/receipt/${sale.id}`} target="_blank" rel="noreferrer">
                          <Printer /> Chek
                        </a>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
