"use client";

import { useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, Printer } from "lucide-react";
import { Button } from "@repo/ui";

export function PrintControls({ autoPrint }: { autoPrint: boolean }) {
  useEffect(() => {
    if (!autoPrint) return;
    const timer = window.setTimeout(() => window.print(), 500);
    return () => window.clearTimeout(timer);
  }, [autoPrint]);

  return (
    <div className="no-print mx-auto mb-4 flex w-[80mm] items-center justify-between gap-2">
      <Button variant="outline" size="sm" asChild>
        <Link href="/sales">
          <ArrowLeft /> Savdolar
        </Link>
      </Button>
      <Button size="sm" onClick={() => window.print()}>
        <Printer /> Chop etish
      </Button>
    </div>
  );
}
