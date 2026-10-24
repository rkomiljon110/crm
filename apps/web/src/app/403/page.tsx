import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { Button } from "@repo/ui";

export const metadata = { title: "Ruxsat yo'q" };

export default function ForbiddenPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-6">
      <div className="w-full max-w-md rounded-xl border bg-card p-8 text-center shadow-sm">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
          <ShieldAlert className="h-6 w-6 text-destructive" />
        </div>
        <h1 className="mt-5 text-xl font-semibold">Ruxsat yo'q</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Bu sahifaga kirish uchun sizning rolingizda yetarli huquq yo'q. Biznes egasi bilan
          bog'lanib, ruxsatlarni tekshirishni so'rang.
        </p>
        <div className="mt-6">
          <Button asChild>
            <Link href="/dashboard">Bosh sahifaga qaytish</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
