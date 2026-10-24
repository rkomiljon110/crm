import Link from "next/link";
import { FileQuestion } from "lucide-react";
import { Button } from "@repo/ui";

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-6">
      <div className="w-full max-w-md rounded-xl border bg-card p-8 text-center shadow-sm">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted">
          <FileQuestion className="h-6 w-6 text-muted-foreground" />
        </div>
        <h1 className="mt-5 text-xl font-semibold">Sahifa topilmadi</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Bu sahifa hozircha mavjud emas yoki manzil o'zgargan.
        </p>
        <div className="mt-6">
          <Button asChild>
            <Link href="/dashboard">Boshqaruv paneliga qaytish</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
