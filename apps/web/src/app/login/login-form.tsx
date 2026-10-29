"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowRight,
  BarChart3,
  Boxes,
  Building2,
  Eye,
  EyeOff,
  Loader2,
  LockKeyhole,
  Phone,
  ScanBarcode,
  ShieldCheck,
  Store,
} from "lucide-react";
import { Button, Card, CardContent, Input, Label } from "@repo/ui";

const FEATURES = [
  { icon: ScanBarcode, title: "Tezkor kassa", text: "Shtrix-kod, aralash to'lov va nasiya — bitta oynada." },
  { icon: Boxes, title: "Ombor va WMS", text: "Ko'p ombor, partiyalar, reviziya va ko'chirishlar." },
  { icon: BarChart3, title: "Haqiqiy foyda", text: "Tushum, tannarx va xarajatlar asosida P&L." },
  { icon: ShieldCheck, title: "Granular RBAC", text: "Har bir rol va amal uchun aniq ruxsatlar." },
];

export function LoginForm() {
  const router = useRouter();
  const [tenantSlug, setTenantSlug] = useState("baraka");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function fillDemo() {
    setTenantSlug("baraka");
    setPhone("+998901234567");
    setPassword("demo1234");
    setError(null);
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantSlug, phone, password }),
      });
      const data = (await response.json()) as { error?: string; redirectTo?: string };

      if (!response.ok) {
        setError(data.error ?? "Kirish amalga oshmadi.");
        return;
      }

      router.push(data.redirectTo ?? "/dashboard");
      router.refresh();
    } catch {
      setError("Serverga ulanib bo'lmadi. Internet aloqasini tekshiring.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
      {/* Chap panel — brend va imkoniyatlar */}
      <div className="relative hidden overflow-hidden bg-[#043d30] p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div
          className="pointer-events-none absolute inset-0 opacity-30"
          style={{
            backgroundImage:
              "radial-gradient(circle at 15% 20%, rgba(16,185,129,.5), transparent 40%), radial-gradient(circle at 85% 70%, rgba(5,150,105,.45), transparent 45%)",
          }}
        />
        <div className="relative">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/20">
              <Store className="h-6 w-6" />
            </div>
            <div>
              <p className="text-lg font-semibold tracking-tight">Savdo ERP</p>
              <p className="text-xs text-emerald-100/70">O&apos;zbekiston biznesi uchun</p>
            </div>
          </div>

          <h1 className="mt-16 max-w-md text-4xl font-semibold leading-tight tracking-tight">
            Do&apos;kon, ombor va nasiya — bitta ishonchli tizimda.
          </h1>
          <p className="mt-4 max-w-md text-sm leading-relaxed text-emerald-50/80">
            Web, desktop va mobil kassa uchun yagona arxitektura. Internet uzilsa ham savdo
            to&apos;xtamaydi, ma&apos;lumotlar keyin avtomatik sinxronlanadi.
          </p>

          <div className="mt-10 grid max-w-lg grid-cols-2 gap-4">
            {FEATURES.map((feature) => (
              <div key={feature.title} className="rounded-xl border border-white/10 bg-white/5 p-4">
                <feature.icon className="h-5 w-5 text-emerald-300" />
                <p className="mt-2.5 text-sm font-medium">{feature.title}</p>
                <p className="mt-1 text-xs leading-relaxed text-emerald-100/60">{feature.text}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="relative flex items-center gap-2 text-xs text-emerald-100/50">
          <ShieldCheck className="h-4 w-4" />
          Row-Level Security bilan himoyalangan multi-tenant arxitektura
        </div>
      </div>

      {/* O'ng panel — forma */}
      <div className="flex items-center justify-center bg-background px-4 py-10 sm:px-8">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <Store className="h-5 w-5" />
            </div>
            <div>
              <p className="font-semibold">Savdo ERP</p>
              <p className="text-xs text-muted-foreground">O&apos;zbekiston biznesi uchun</p>
            </div>
          </div>

          <div className="mb-7">
            <h2 className="text-2xl font-semibold tracking-tight">Tizimga kirish</h2>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Biznes kodingiz va telefon raqamingiz bilan kiring.
            </p>
          </div>

          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="tenantSlug">Biznes kodi</Label>
              <div className="relative">
                <Building2 className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="tenantSlug"
                  value={tenantSlug}
                  onChange={(e) => setTenantSlug(e.target.value.toLowerCase())}
                  placeholder="masalan: baraka"
                  autoComplete="organization"
                  className="pl-9"
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="phone">Telefon raqam</Label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="phone"
                  type="tel"
                  inputMode="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+998 90 123 45 67"
                  autoComplete="tel"
                  className="pl-9"
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password">Parol</Label>
              <div className="relative">
                <LockKeyhole className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  className="pl-9 pr-10"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label={showPassword ? "Parolni yashirish" : "Parolni ko'rsatish"}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="flex items-start gap-2 rounded-md border border-destructive/25 bg-destructive/5 p-3 text-sm text-destructive">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <Button type="submit" className="w-full" size="lg" disabled={loading}>
              {loading ? <Loader2 className="animate-spin" /> : <ArrowRight />}
              {loading ? "Tekshirilmoqda..." : "Kirish"}
            </Button>
          </form>

          <Card className="mt-6 border-dashed bg-muted/40 shadow-none">
            <CardContent className="space-y-2.5 p-4 text-xs">
              <div className="flex items-center justify-between">
                <p className="font-medium text-foreground">Demo hisob</p>
                <button
                  type="button"
                  onClick={fillDemo}
                  className="font-medium text-primary underline-offset-2 hover:underline"
                >
                  To&apos;ldirish
                </button>
              </div>
              <div className="space-y-1 text-muted-foreground">
                <p>Biznes kodi: <span className="font-mono text-foreground">baraka</span></p>
                <p>Telefon: <span className="font-mono text-foreground">+998901234567</span></p>
                <p>Parol: <span className="font-mono text-foreground">demo1234</span></p>
              </div>
              <p className="pt-1 text-[11px] leading-relaxed text-muted-foreground">
                Kassir va omborchi uchun demo hisoblar README faylida keltirilgan.
              </p>
            </CardContent>
          </Card>

          <p className="mt-8 text-center text-xs text-muted-foreground">
            © 2026 Savdo ERP · Toshkent, O&apos;zbekiston
          </p>
        </div>
      </div>
    </div>
  );
}
