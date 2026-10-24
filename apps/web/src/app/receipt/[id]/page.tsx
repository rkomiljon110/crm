import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { formatDateTime, formatMoney } from "@repo/shared";
import { requirePageUser } from "@/lib/auth";
import { getReceiptOrder } from "@/lib/sales/receipts";
import { PrintControls } from "@/components/receipt/print-controls";

export const metadata: Metadata = { title: "Chek · Savdo ERP" };
export const dynamic = "force-dynamic";

const PAYMENT_LABELS: Record<string, string> = {
  CASH: "Naqd",
  CARD: "Karta",
  TRANSFER: "O'tkazma",
  CLICK: "Click",
  PAYME: "Payme",
  UZUM: "Uzum",
  OTHER: "Boshqa",
};

export default async function ReceiptPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { print?: string };
}) {
  const user = await requirePageUser("sales.view");
  const order = await getReceiptOrder(user.tenantId, params.id);
  if (!order) notFound();

  return (
    <div className="min-h-screen bg-muted/40 py-6 print:bg-white print:py-0">
      <style>{`
        @page { size: 80mm auto; margin: 0; }
        @media print {
          html, body { background: #fff !important; }
          .receipt-sheet { width: 80mm !important; margin: 0 !important; box-shadow: none !important; }
          .no-print { display: none !important; }
        }
      `}</style>
      <PrintControls autoPrint={searchParams.print === "1"} />

      <article className="receipt-sheet mx-auto w-[80mm] bg-white p-4 font-mono text-[11px] leading-tight text-black shadow-sm print:p-2">
        <header className="text-center">
          <p className="text-[14px] font-bold uppercase">{order.store?.name ?? order.tenant.name}</p>
          {order.store?.address && <p>{order.store.address}</p>}
          {(order.store?.phone || order.tenant.phone) && (
            <p>{order.store?.phone ?? order.tenant.phone}</p>
          )}
          {order.tenant.inn && <p>STIR: {order.tenant.inn}</p>}
        </header>

        <div className="my-2 border-t border-dashed border-black" />

        <div className="space-y-0.5">
          <div className="flex justify-between gap-2">
            <span>Chek:</span>
            <span className="font-semibold">{order.number}</span>
          </div>
          <div className="flex justify-between gap-2">
            <span>Sana:</span>
            <span>{formatDateTime(order.createdAt)}</span>
          </div>
          <div className="flex justify-between gap-2">
            <span>Kassir:</span>
            <span>{order.cashier?.name ?? "—"}</span>
          </div>
          {order.customer && (
            <div className="flex justify-between gap-2">
              <span>Mijoz:</span>
              <span>{order.customer.name}</span>
            </div>
          )}
        </div>

        <div className="my-2 border-t border-dashed border-black" />

        <div className="space-y-1.5">
          {order.items.map((item) => (
            <div key={item.id}>
              <p className="font-medium">
                {item.productName}
                {item.variantName !== "Standart" ? ` / ${item.variantName}` : ""}
              </p>
              <div className="flex justify-between gap-2">
                <span>
                  {formatMoney(item.quantity)} × {formatMoney(item.unitPrice)}
                </span>
                <span>{formatMoney(item.subtotal)}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="my-2 border-t border-dashed border-black" />

        <div className="space-y-0.5">
          <div className="flex justify-between gap-2">
            <span>Oraliq jami:</span>
            <span>{formatMoney(order.subtotal)}</span>
          </div>
          {order.discountAmount > 0 && (
            <div className="flex justify-between gap-2">
              <span>Chegirma:</span>
              <span>-{formatMoney(order.discountAmount)}</span>
            </div>
          )}
          {order.taxAmount > 0 && (
            <div className="flex justify-between gap-2">
              <span>Soliq:</span>
              <span>{formatMoney(order.taxAmount)}</span>
            </div>
          )}
          <div className="flex justify-between gap-2 text-[14px] font-bold">
            <span>JAMI:</span>
            <span>{formatMoney(order.totalAmount)} so&apos;m</span>
          </div>
        </div>

        <div className="my-2 border-t border-dashed border-black" />

        <div className="space-y-0.5">
          {order.payments.map((payment) => (
            <div key={payment.id} className="flex justify-between gap-2">
              <span>{PAYMENT_LABELS[payment.method] ?? payment.method}:</span>
              <span>{formatMoney(payment.amount)}</span>
            </div>
          ))}
          {order.debtAmount > 0 && (
            <div className="flex justify-between gap-2">
              <span>Nasiya:</span>
              <span>{formatMoney(order.debtAmount)}</span>
            </div>
          )}
        </div>

        <div className="my-2 border-t border-dashed border-black" />

        <footer className="space-y-1 text-center">
          <p className="font-semibold">Xaridingiz uchun rahmat!</p>
          <p>Chekni saqlab qo&apos;ying.</p>
          <p className="text-[9px]">Savdo ERP · {order.tenant.name}</p>
        </footer>
      </article>
    </div>
  );
}
