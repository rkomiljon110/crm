"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  Banknote,
  CheckCircle2,
  CreditCard,
  Loader2,
  Minus,
  PackageSearch,
  Plus,
  Printer,
  ReceiptText,
  RefreshCw,
  ScanBarcode,
  Search,
  ShoppingCart,
  Trash2,
  UserRound,
  Wallet,
  X,
} from "lucide-react";
import {
  calculateSaleTotals,
  formatDateTime,
  formatMoney,
  moneyEquals,
  roundUzs,
} from "@repo/shared";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Select,
} from "@repo/ui";

type PaymentMethod = "CASH" | "CARD" | "TRANSFER" | "CLICK" | "PAYME" | "UZUM" | "OTHER" | "DEBT";

interface PosShift {
  id: string;
  status: string;
  storeId: string;
  store: { id: string; code: string; name: string } | null;
  openingCash: number;
  expectedCash: number;
  difference: number | null;
  salesCount: number;
  totals: { cash: number; card: number; transfer: number; other: number; debt: number; sales: number };
  openedAt: string;
}

interface PosProduct {
  variantId: string;
  productId: string;
  name: string;
  variantName: string;
  sku: string | null;
  barcodes: string[];
  barcode: string | null;
  price: number;
  stock: number;
  unit: string;
  allowDecimal: boolean;
  category: string;
}

interface PosCustomer {
  id: string;
  name: string;
  phone: string | null;
  debtBalance: number;
  maxDebtLimit: number;
  isBlocked: boolean;
}

interface PosBootstrap {
  shift: PosShift | null;
  stores: Array<{ id: string; code: string; name: string }>;
  warehouses: Array<{ id: string; code: string; name: string; storeId: string | null }>;
  selectedWarehouseId: string;
  products: PosProduct[];
  customers: PosCustomer[];
  paymentMethods: readonly PaymentMethod[];
  user: { name: string; permissions: string[] };
}

interface CartLine {
  variantId: string;
  name: string;
  variantName: string;
  unit: string;
  allowDecimal: boolean;
  price: number;
  quantity: number;
  stock: number;
}

interface PaymentLine {
  id: string;
  method: PaymentMethod;
  amount: number;
}

interface Receipt {
  id: string;
  number: string;
  totalAmount: number;
  debtAmount: number;
  paymentStatus: string;
  createdAt: string;
  customer: { name: string } | null;
  items: Array<{ productName: string; variantName: string; quantity: number; subtotal: number }>;
  payments: Array<{ method: string; amount: number }>;
}

const METHOD_LABELS: Record<PaymentMethod, string> = {
  CASH: "Naqd",
  CARD: "Karta",
  TRANSFER: "O'tkazma",
  CLICK: "Click",
  PAYME: "Payme",
  UZUM: "Uzum",
  OTHER: "Boshqa",
  DEBT: "Nasiya",
};

const QUICK_METHODS: PaymentMethod[] = ["CASH", "CARD", "DEBT"];

function roundQty(value: number, allowDecimal: boolean): number {
  return allowDecimal ? Math.round(value * 1000) / 1000 : Math.round(value);
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function createUuid(): string {
  if (typeof globalThis.crypto?.randomUUID === "function") return globalThis.crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function PosTerminal({ userName, storeName }: { userName: string; storeName: string | null }) {
  const [data, setData] = useState<PosBootstrap | null>(null);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [customerId, setCustomerId] = useState("");
  const [payments, setPayments] = useState<PaymentLine[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("CASH");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [openShiftPanel, setOpenShiftPanel] = useState(false);
  const [openingCash, setOpeningCash] = useState("0");
  const [opening, setOpening] = useState(false);
  const [closeOpen, setCloseOpen] = useState(false);
  const [closingCash, setClosingCash] = useState("");
  const [closing, setClosing] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const requestRef = useRef(0);

  const load = useCallback(async (q: string, selectedWarehouse: string, silent = false) => {
    const requestId = ++requestRef.current;
    if (!silent) setLoading(true);
    setSearching(true);
    try {
      const params = new URLSearchParams();
      if (q.trim()) params.set("q", q.trim());
      if (selectedWarehouse) params.set("warehouseId", selectedWarehouse);
      const response = await fetch(`/api/v1/pos/bootstrap${params.size ? `?${params}` : ""}`, {
        cache: "no-store",
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error ?? `Yuklash xatosi (${response.status})`);
      if (requestRef.current !== requestId) return;
      setData(payload);
      setWarehouseId(payload.selectedWarehouseId);
      if (!selectedWarehouse) setWarehouseId(payload.selectedWarehouseId);
    } catch (loadError) {
      if (requestRef.current !== requestId) return;
      setError(loadError instanceof Error ? loadError.message : "POS ma'lumotlari yuklanmadi.");
    } finally {
      if (requestRef.current === requestId) {
        setLoading(false);
        setSearching(false);
      }
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(query, warehouseId), query.trim() ? 250 : 0);
    return () => window.clearTimeout(timer);
    // warehouseId intentionally only triggers on explicit warehouse change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "F2") {
        event.preventDefault();
        searchRef.current?.focus();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const products = data?.products ?? [];
  const customers = data?.customers ?? [];
  const shift = data?.shift ?? null;
  const selectedCustomer = customers.find((customer) => customer.id === customerId) ?? null;
  const canManageShift = data?.user.permissions.includes("shifts.manage") ?? false;

  const totals = useMemo(
    () =>
      calculateSaleTotals(
        cart.map((line) => ({
          quantity: line.quantity,
          unitPrice: line.price,
          discountAmount: 0,
        })),
      ),
    [cart],
  );
  const total = totals.totalAmount;
  const paid = roundMoney(payments.reduce((sum, payment) => sum + payment.amount, 0));
  const remaining = roundMoney(Math.max(0, total - paid));
  const debtAmount = roundMoney(
    payments.filter((payment) => payment.method === "DEBT").reduce((sum, payment) => sum + payment.amount, 0),
  );
  const canSubmit =
    !!shift && cart.length > 0 && payments.length > 0 && moneyEquals(paid, total) && !submitting;

  function showError(message: string) {
    setError(message);
  }

  function addProduct(product: PosProduct) {
    setError(null);
    if (!shift) {
      showError("Avval smena oching.");
      return;
    }
    if (product.stock <= 0) {
      showError(`${product.name}: qoldiq yo'q.`);
      return;
    }
    setCart((current) => {
      const existing = current.find((line) => line.variantId === product.variantId);
      if (existing) {
        const nextQuantity = roundQty(existing.quantity + 1, existing.allowDecimal);
        if (nextQuantity > existing.stock) {
          showError(`${product.name}: qoldiq ${existing.stock} ${existing.unit}.`);
          return current;
        }
        return current.map((line) =>
          line.variantId === product.variantId ? { ...line, quantity: nextQuantity } : line,
        );
      }
      return [
        ...current,
        {
          variantId: product.variantId,
          name: product.name,
          variantName: product.variantName,
          unit: product.unit,
          allowDecimal: product.allowDecimal,
          price: product.price,
          quantity: 1,
          stock: product.stock,
        },
      ];
    });
  }

  function setQuantity(line: CartLine, value: number) {
    const quantity = roundQty(Math.min(Math.max(value, 0), line.stock), line.allowDecimal);
    if (quantity <= 0) {
      setCart((current) => current.filter((item) => item.variantId !== line.variantId));
      return;
    }
    setCart((current) =>
      current.map((item) => (item.variantId === line.variantId ? { ...item, quantity } : item)),
    );
  }

  function searchSubmit() {
    const term = query.trim();
    if (!term) return;
    const exact = products.find((product) => product.barcodes.includes(term));
    const target = exact ?? (products.length === 1 ? products[0] : null);
    if (target) {
      addProduct(target);
      setQuery("");
      searchRef.current?.focus();
    }
  }

  function addPayment(method: PaymentMethod, amount?: number) {
    setError(null);
    if (!shift) return showError("Avval smena oching.");
    if (total <= 0) return;
    if (method === "DEBT" && !customerId) return showError("Nasiya uchun mijozni tanlang.");
    const value = roundMoney(amount ?? (Number(paymentAmount.replace(/\s/g, "")) || 0));
    if (!Number.isFinite(value) || value <= 0) return showError("To'lov summasini kiriting.");
    if (value > remaining + 0.009) return showError(`Qoldiqdan ko'p: ${formatMoney(remaining)} so'm.`);
    setPayments((current) => [...current, { id: createUuid(), method, amount: value }]);
    setPaymentAmount("");
  }

  function resetSale() {
    setCart([]);
    setPayments([]);
    setCustomerId("");
    setPaymentAmount("");
    setError(null);
  }

  async function submitSale() {
    if (!data || !shift || cart.length === 0) return;
    if (!moneyEquals(paid, total)) return showError("To'lov summasi chek summasiga teng emas.");
    if (debtAmount > 0 && !customerId) return showError("Nasiya uchun mijozni tanlang.");
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch("/api/v1/orders", {
        method: "POST",
        headers: { "content-type": "application/json", "idempotency-key": createUuid() },
        body: JSON.stringify({
          storeId: shift.storeId,
          warehouseId: data.selectedWarehouseId,
          customerId: customerId || null,
          items: cart.map((line) => ({
            variantId: line.variantId,
            quantity: line.quantity,
            unitPrice: line.price,
            discountAmount: 0,
          })),
          discountAmount: 0,
          taxAmount: 0,
          payments: payments.map((payment) => ({ method: payment.method, amount: payment.amount })),
          note: "POS terminal",
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error ?? `Chek yaratilmadi (${response.status})`);
      }
      setReceipt(payload.order as Receipt);
      setCart([]);
      setPayments([]);
      setCustomerId("");
      setQuery("");
      setWarehouseId(data.selectedWarehouseId);
      void load("", data.selectedWarehouseId, true);
    } catch (submitError) {
      showError(submitError instanceof Error ? submitError.message : "Chek yaratilmadi.");
    } finally {
      setSubmitting(false);
    }
  }

  async function openShift() {
    if (!data) return;
    const storeId = data.stores[0]?.id;
    if (!storeId) return showError("Filial topilmadi.");
    setOpening(true);
    setError(null);
    try {
      const response = await fetch("/api/v1/shifts/open", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          storeId,
          openingCash: roundUzs(Number(openingCash.replace(/\s/g, "")) || 0),
          note: "POS terminal",
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error ?? "Smena ochilmadi.");
      setOpenShiftPanel(false);
      await load(query, warehouseId, true);
    } catch (openError) {
      showError(openError instanceof Error ? openError.message : "Smena ochilmadi.");
    } finally {
      setOpening(false);
    }
  }

  async function closeShift() {
    if (!shift) return;
    setClosing(true);
    setError(null);
    try {
      const response = await fetch("/api/v1/shifts/close", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          shiftId: shift.id,
          closingCash: roundUzs(Number(closingCash.replace(/\s/g, "")) || 0),
          note: "POS terminal Z-hisobot",
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error ?? "Smena yopilmadi.");
      setCloseOpen(false);
      await load(query, warehouseId, true);
    } catch (closeError) {
      showError(closeError instanceof Error ? closeError.message : "Smena yopilmadi.");
    } finally {
      setClosing(false);
    }
  }

  if (loading && !data) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" /> POS yuklanmoqda...
      </div>
    );
  }

  if (!data) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-destructive">
          {error ?? "POS ma'lumotlari yuklanmadi."}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <ScanBarcode className="h-5 w-5 text-primary" />
            <h1 className="text-2xl font-semibold tracking-tight">Kassa terminali</h1>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {storeName ?? shift?.store?.name ?? data.stores[0]?.name} · {userName}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={shift ? "success" : "warning"}>
            {shift ? "Smena ochiq" : "Smena yopiq"}
          </Badge>
          {shift && (
            <span className="text-xs text-muted-foreground">
              {shift.salesCount} chek · kutilgan naqd {formatMoney(shift.expectedCash)} so&apos;m
            </span>
          )}
          {shift && canManageShift && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setClosingCash(String(shift.expectedCash));
                setCloseOpen(true);
              }}
            >
              <ReceiptText /> Smena yopish
            </Button>
          )}
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span className="flex-1">{error}</span>
          <button type="button" onClick={() => setError(null)} aria-label="Yopish">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {!shift && (
        <Card className="border-dashed">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
            <div>
              <p className="text-sm font-medium">Savdo uchun smena oching</p>
              <p className="text-xs text-muted-foreground">
                Smena ochilmasa chek yaratilmaydi. Kassa qoldig&apos;ini kiriting.
              </p>
            </div>
            <Button onClick={() => setOpenShiftPanel((value) => !value)}>
              <Banknote /> Smena ochish
            </Button>
          </CardContent>
          {openShiftPanel && (
            <CardContent className="grid gap-3 border-t pt-4 sm:grid-cols-[1fr_180px_auto] sm:items-end">
              <div className="space-y-1.5">
                <Label>Filial</Label>
                <Select value={data.stores[0]?.id ?? ""} disabled>
                  {data.stores.map((store) => (
                    <option key={store.id} value={store.id}>
                      {store.name}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="openingCash">Ochilish naqdi</Label>
                <Input
                  id="openingCash"
                  inputMode="decimal"
                  value={openingCash}
                  onChange={(event) => setOpeningCash(event.target.value)}
                />
              </div>
              <Button onClick={() => void openShift()} disabled={opening}>
                {opening ? <Loader2 className="animate-spin" /> : <CheckCircle2 />} Ochish
              </Button>
            </CardContent>
          )}
        </Card>
      )}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
        <section className="space-y-3">
          <Card>
            <CardContent className="space-y-3 p-4">
              <div className="flex flex-wrap items-end gap-3">
                <div className="min-w-[240px] flex-1 space-y-1.5">
                  <Label htmlFor="pos-search">Tovar qidirish</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      ref={searchRef}
                      id="pos-search"
                      autoFocus
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          searchSubmit();
                        }
                      }}
                      placeholder="Shtrix-kod, SKU yoki nom · Enter bilan qo'shish (F2)"
                      className="h-10 pl-9 pr-9"
                    />
                    {searching && (
                      <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
                    )}
                  </div>
                </div>
                <div className="w-full space-y-1.5 sm:w-52">
                  <Label>Ombor</Label>
                  <Select
                    value={data.selectedWarehouseId}
                    onChange={(event) => {
                      setWarehouseId(event.target.value);
                      void load(query, event.target.value);
                    }}
                  >
                    {data.warehouses.map((warehouse) => (
                      <option key={warehouse.id} value={warehouse.id}>
                        {warehouse.name}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                {products.length} ta natija · qoldiq faqat tanlangan ombordan
              </p>
            </CardContent>
          </Card>

          <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
            {products.map((product) => (
              <button
                key={product.variantId}
                type="button"
                onClick={() => addProduct(product)}
                disabled={product.stock <= 0}
                className="group flex min-h-[132px] flex-col justify-between rounded-xl border bg-card p-3 text-left shadow-sm transition-colors hover:border-primary/50 hover:bg-primary/5 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <div>
                  <p className="line-clamp-2 text-sm font-medium leading-snug">{product.name}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {product.variantName}
                    {product.barcode ? ` · ${product.barcode}` : ""}
                  </p>
                </div>
                <div className="mt-3 flex items-end justify-between gap-2">
                  <div>
                    <p className="text-base font-semibold">{formatMoney(product.price)}</p>
                    <p className="text-[11px] text-muted-foreground">so&apos;m / {product.unit}</p>
                  </div>
                  <Badge variant={product.stock > 0 ? "secondary" : "destructive"}>
                    {product.stock > 0 ? `${formatMoney(product.stock)} ${product.unit}` : "qoldiq yo'q"}
                  </Badge>
                </div>
              </button>
            ))}
          </div>

          {products.length === 0 && (
            <Card>
              <CardContent className="flex flex-col items-center gap-2 p-10 text-center text-sm text-muted-foreground">
                <PackageSearch className="h-8 w-8" />
                <p>Tovar topilmadi. Shtrix-kod yoki nomni boshqacha kiriting.</p>
              </CardContent>
            </Card>
          )}
        </section>

        <aside className="space-y-3 xl:sticky xl:top-20 xl:self-start">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <ShoppingCart className="h-4 w-4" /> Savat
                  </CardTitle>
                  <CardDescription>{cart.length} ta pozitsiya</CardDescription>
                </div>
                {cart.length > 0 && (
                  <Button variant="ghost" size="sm" onClick={resetSale}>
                    <Trash2 /> Tozalash
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-2 pt-0">
              {cart.length === 0 && (
                <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                  Tovarni bosing yoki shtrix-kodni skanerlang.
                </p>
              )}
              {cart.map((line) => (
                <div key={line.variantId} className="rounded-lg border p-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{line.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatMoney(line.price)} so&apos;m / {line.unit}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setQuantity(line, 0)}
                      className="text-muted-foreground hover:text-destructive"
                      aria-label="Olib tashlash"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => setQuantity(line, line.quantity - 1)}
                      >
                        <Minus />
                      </Button>
                      <Input
                        aria-label="Miqdor"
                        inputMode="decimal"
                        value={line.quantity}
                        onChange={(event) => setQuantity(line, Number(event.target.value))}
                        className="h-7 w-16 px-1 text-center text-xs"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => setQuantity(line, line.quantity + 1)}
                      >
                        <Plus />
                      </Button>
                      <span className="text-xs text-muted-foreground">{line.unit}</span>
                    </div>
                    <p className="text-sm font-semibold">
                      {formatMoney(line.price * line.quantity)}
                    </p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-3 p-4">
              <div className="space-y-1.5">
                <Label htmlFor="customer">
                  <UserRound className="mr-1 inline h-3.5 w-3.5" /> Mijoz (nasiya uchun)
                </Label>
                <Select id="customer" value={customerId} onChange={(event) => setCustomerId(event.target.value)}>
                  <option value="">Mijozsiz</option>
                  {customers.map((customer) => (
                    <option key={customer.id} value={customer.id}>
                      {customer.name}
                      {customer.debtBalance > 0 ? ` · qarz ${formatMoney(customer.debtBalance)}` : ""}
                    </option>
                  ))}
                </Select>
                {selectedCustomer && (
                  <p className="text-xs text-muted-foreground">
                    Qarz: {formatMoney(selectedCustomer.debtBalance)} / limit{" "}
                    {formatMoney(selectedCustomer.maxDebtLimit)}
                    {selectedCustomer.isBlocked ? " · bloklangan" : ""}
                  </p>
                )}
              </div>

              <div className="flex items-center justify-between border-t pt-3">
                <span className="text-sm text-muted-foreground">Jami</span>
                <span className="text-xl font-semibold">{formatMoney(total)} so&apos;m</span>
              </div>

              <div className="space-y-2">
                <div className="grid grid-cols-3 gap-2">
                  {QUICK_METHODS.map((method) => (
                    <Button
                      key={method}
                      type="button"
                      variant={method === "DEBT" ? "outline" : "secondary"}
                      size="sm"
                      disabled={total <= 0 || remaining <= 0}
                      onClick={() => addPayment(method, remaining)}
                    >
                      {method === "CASH" ? <Banknote /> : method === "CARD" ? <CreditCard /> : <Wallet />}
                      {METHOD_LABELS[method]}
                    </Button>
                  ))}
                </div>

                <div className="grid grid-cols-[1fr_110px_auto] items-end gap-2">
                  <div className="space-y-1">
                    <Label htmlFor="payment-method" className="text-xs">
                      Aralash to&apos;lov
                    </Label>
                    <Select
                      id="payment-method"
                      value={paymentMethod}
                      onChange={(event) => setPaymentMethod(event.target.value as PaymentMethod)}
                    >
                      {data.paymentMethods.map((method) => (
                        <option key={method} value={method}>
                          {METHOD_LABELS[method]}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="payment-amount" className="text-xs">
                      Summa
                    </Label>
                    <Input
                      id="payment-amount"
                      inputMode="decimal"
                      value={paymentAmount}
                      onChange={(event) => setPaymentAmount(event.target.value)}
                      placeholder={String(remaining)}
                      className="h-9"
                    />
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => addPayment(paymentMethod)}
                    disabled={total <= 0 || remaining <= 0}
                  >
                    <Plus /> Qo&apos;shish
                  </Button>
                </div>
                <button
                  type="button"
                  className="text-xs text-primary underline-offset-2 hover:underline"
                  onClick={() => setPaymentAmount(String(remaining))}
                  disabled={remaining <= 0}
                >
                  Qoldiqni to&apos;lash: {formatMoney(remaining)} so&apos;m
                </button>
              </div>

              {payments.length > 0 && (
                <div className="space-y-1.5 rounded-lg bg-muted/50 p-2">
                  {payments.map((payment) => (
                    <div key={payment.id} className="flex items-center justify-between text-sm">
                      <span>
                        {METHOD_LABELS[payment.method]}{" "}
                        <span className="text-xs text-muted-foreground">
                          {payment.method === "DEBT" ? "(nasiya)" : ""}
                        </span>
                      </span>
                      <span className="flex items-center gap-2">
                        <span className="font-medium">{formatMoney(payment.amount)}</span>
                        <button
                          type="button"
                          onClick={() =>
                            setPayments((current) => current.filter((item) => item.id !== payment.id))
                          }
                          className="text-muted-foreground hover:text-destructive"
                          aria-label="To'lovni olib tashlash"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </span>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">To&apos;langan</span>
                <span className={moneyEquals(paid, total) && total > 0 ? "text-success" : "text-amber-700"}>
                  {formatMoney(paid)} / {formatMoney(total)}
                </span>
              </div>

              <Button
                className="h-12 w-full text-base"
                size="lg"
                onClick={() => void submitSale()}
                disabled={!canSubmit}
              >
                {submitting ? <Loader2 className="animate-spin" /> : <CheckCircle2 />}
                Chekni yakunlash {total > 0 ? `· ${formatMoney(total)} so'm` : ""}
              </Button>
              {!shift && <p className="text-center text-xs text-destructive">Smena ochilmagan.</p>}
            </CardContent>
          </Card>
        </aside>
      </div>

      <Dialog open={!!receipt} onOpenChange={(open) => !open && setReceipt(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-success" /> Chek yaratildi
            </DialogTitle>
            <DialogDescription>
              {receipt?.number} · {formatDateTime(receipt?.createdAt)}
            </DialogDescription>
          </DialogHeader>
          {receipt && (
            <div className="space-y-3 text-sm">
              <div className="space-y-1 rounded-lg border bg-muted/30 p-3">
                {receipt.items.map((item, index) => (
                  <div key={index} className="flex justify-between gap-3">
                    <span className="min-w-0 truncate">
                      {item.productName} × {item.quantity}
                    </span>
                    <span className="shrink-0 font-medium">{formatMoney(item.subtotal)}</span>
                  </div>
                ))}
              </div>
              <div className="flex justify-between text-base font-semibold">
                <span>Jami</span>
                <span>{formatMoney(receipt.totalAmount)} so&apos;m</span>
              </div>
              <div className="space-y-1 text-xs text-muted-foreground">
                {receipt.payments.map((payment) => (
                  <div key={payment.method} className="flex justify-between">
                    <span>{METHOD_LABELS[payment.method as PaymentMethod] ?? payment.method}</span>
                    <span>{formatMoney(payment.amount)}</span>
                  </div>
                ))}
                {receipt.debtAmount > 0 && (
                  <div className="flex justify-between">
                    <span>Nasiya</span>
                    <span>{formatMoney(receipt.debtAmount)}</span>
                  </div>
                )}
                {receipt.customer && (
                  <div className="flex justify-between">
                    <span>Mijoz</span>
                    <span>{receipt.customer.name}</span>
                  </div>
                )}
              </div>
            </div>
          )}
          <DialogFooter className="sm:justify-between">
            <Button
              variant="outline"
              onClick={() => {
                if (!receipt) return;
                window.open(`/receipt/${receipt.id}?print=1`, "_blank", "noopener,noreferrer");
              }}
            >
              <Printer /> Chop etish
            </Button>
            <Button onClick={() => setReceipt(null)}>Yangi savdo</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={closeOpen} onOpenChange={setCloseOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Z-hisobot · smenani yopish</DialogTitle>
            <DialogDescription>
              {shift ? `${shift.salesCount} chek · kutilgan naqd ${formatMoney(shift.expectedCash)} so'm` : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="closingCash">Kassadagi naqd</Label>
            <Input
              id="closingCash"
              inputMode="decimal"
              value={closingCash}
              onChange={(event) => setClosingCash(event.target.value)}
            />
            {shift && (
              <p className="text-xs text-muted-foreground">
                Farq:{" "}
                {formatMoney(roundUzs(Number(closingCash.replace(/\s/g, "")) || 0) - shift.expectedCash)}{" "}
                so&apos;m
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCloseOpen(false)}>
              Bekor qilish
            </Button>
            <Button variant="destructive" onClick={() => void closeShift()} disabled={closing}>
              {closing ? <Loader2 className="animate-spin" /> : <ReceiptText />} Smenani yopish
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="fixed bottom-5 right-5 z-20 bg-card shadow-md xl:hidden"
        onClick={() => void load(query, warehouseId, true)}
      >
        <RefreshCw /> Yangilash
      </Button>
    </div>
  );
}
