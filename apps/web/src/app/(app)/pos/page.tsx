import type { Metadata } from "next";
import { requirePageUser } from "@/lib/auth";
import { PosTerminal } from "@/components/pos/pos-terminal";

export const metadata: Metadata = { title: "Kassa (POS) · Savdo ERP" };
export const dynamic = "force-dynamic";

export default async function PosPage() {
  const user = await requirePageUser("pos.use");
  return <PosTerminal userName={user.name} storeName={user.storeName} />;
}
