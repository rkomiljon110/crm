"use client";

import { useMemo, useRef, useState } from "react";
import {
  Braces,
  Check,
  Copy,
  Loader2,
  Play,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Terminal,
} from "lucide-react";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Textarea,
  cn,
} from "@repo/ui";
import { API_OPERATIONS, API_TAGS, type ApiOperation } from "@/lib/openapi";

interface ApiExplorerProps {
  user: {
    name: string;
    roleCode: string;
    roleName: string;
    permissions: string[];
  };
}

interface ApiResponseState {
  status: number;
  statusText: string;
  durationMs: number;
  raw: string;
  parsed: unknown;
}

const METHOD_STYLES: Record<string, string> = {
  GET: "border-sky-200 bg-sky-50 text-sky-700",
  POST: "border-emerald-200 bg-emerald-50 text-emerald-700",
};

function pretty(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

function createUuid(): string {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }
  const bytes = new Uint8Array(16);
  globalThis.crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function ApiExplorer({ user }: ApiExplorerProps) {
  const [selectedId, setSelectedId] = useState(API_OPERATIONS[0]!.id);
  const [body, setBody] = useState(() =>
    API_OPERATIONS[0]!.bodyExample ? pretty(API_OPERATIONS[0]!.bodyExample) : "",
  );
  const [query, setQuery] = useState("");
  const [sending, setSending] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [response, setResponse] = useState<ApiResponseState | null>(null);
  const [copied, setCopied] = useState(false);
  const demoRequestRef = useRef(0);

  const selected = useMemo(
    () => API_OPERATIONS.find((operation) => operation.id === selectedId) ?? API_OPERATIONS[0]!,
    [selectedId],
  );
  const canUsePos = user.permissions.includes("pos.use");

  function selectOperation(operation: ApiOperation) {
    demoRequestRef.current += 1;
    setDemoLoading(false);
    setSelectedId(operation.id);
    setBody(operation.bodyExample ? pretty(operation.bodyExample) : "");
    setQuery("");
    setError(null);
    setResponse(null);
    setCopied(false);
  }

  async function loadBootstrap() {
    const httpResponse = await fetch("/api/v1/pos/bootstrap", { cache: "no-store" });
    const payload = await httpResponse.json().catch(() => null);
    if (!httpResponse.ok) {
      throw new Error(payload?.error ?? `Bootstrap xatosi (${httpResponse.status})`);
    }
    return payload as {
      shift: { id: string; storeId: string; expectedCash: number } | null;
      stores: Array<{ id: string; code: string; name: string }>;
      warehouses: Array<{ id: string; code: string; name: string }>;
      selectedWarehouseId: string;
      products: Array<{
        variantId: string;
        name: string;
        variantName: string;
        price: number;
        stock: number;
        barcode: string | null;
      }>;
      customers: Array<{ id: string; name: string }>;
    };
  }

  async function fillDemo() {
    const requestId = ++demoRequestRef.current;
    setError(null);
    setDemoLoading(true);
    try {
      if (selected.demoKind === "login") {
        setBody(pretty({ tenantSlug: "baraka", phone: "+998901234567", password: "demo1234" }));
        return;
      }

      if (!canUsePos) {
        throw new Error("Demo ma'lumotlari uchun pos.use ruxsati kerak.");
      }

      const context = await loadBootstrap();
      if (demoRequestRef.current !== requestId) return;

      if (selected.demoKind === "bootstrap") {
        const product = context.products[0];
        setQuery(product?.barcode ? `q=${encodeURIComponent(product.barcode)}` : "");
        return;
      }

      if (selected.demoKind === "shift-open") {
        const storeId = context.shift?.storeId ?? context.stores[0]?.id;
        if (!storeId) throw new Error("Filial topilmadi.");
        setBody(pretty({ storeId, openingCash: 100000, note: "API explorer demo" }));
        return;
      }

      if (selected.demoKind === "shift-close") {
        if (!context.shift) throw new Error("Ochiq smena yo'q. Avval smena oching.");
        setBody(
          pretty({
            shiftId: context.shift.id,
            closingCash: context.shift.expectedCash,
            note: "API explorer demo",
          }),
        );
        return;
      }

      const product =
        context.products.find((item) => item.price > 0 && item.stock > 0) ?? context.products[0];
      if (!product) throw new Error("Katalog bo'sh — demo chek tuzib bo'lmaydi.");
      if (!context.shift) {
        throw new Error("Ochiq smena yo'q. Avval Kassa → Smena ochish so'rovini yuboring.");
      }

      const order = {
        warehouseId: context.selectedWarehouseId,
        customerId: null,
        items: [
          {
            variantId: product.variantId,
            quantity: 1,
            unitPrice: product.price,
            discountAmount: 0,
          },
        ],
        discountAmount: 0,
        taxAmount: 0,
        payments: [{ method: "CASH", amount: product.price }],
        note: "API explorer demo",
      };

      setBody(
        pretty(
          selected.demoKind === "sync"
            ? {
                deviceId: "api-explorer-01",
                orders: [
                  {
                    ...order,
                    clientOrderId: createUuid(),
                    clientCreatedAt: new Date().toISOString(),
                  },
                ],
              }
            : order,
        ),
      );

      if (selected.demoKind === "sync") {
        setQuery("");
      }
    } catch (demoError) {
      if (demoRequestRef.current !== requestId) return;
      setError(demoError instanceof Error ? demoError.message : "Demo ma'lumotlarini yuklab bo'lmadi.");
    } finally {
      if (demoRequestRef.current === requestId) setDemoLoading(false);
    }
  }

  async function sendRequest() {
    setSending(true);
    setError(null);
    setResponse(null);
    setCopied(false);

    try {
      let payload: unknown;
      if (body.trim()) {
        try {
          payload = JSON.parse(body);
        } catch {
          throw new Error("JSON tanasi noto'g'ri. Qavslar va vergullarni tekshiring.");
        }
      }

      const cleanQuery = query.trim().replace(/^\?/, "");
      const url = `${selected.path}${cleanQuery ? `?${cleanQuery}` : ""}`;
      const started = performance.now();
      const httpResponse = await fetch(url, {
        method: selected.method,
        headers: payload === undefined ? {} : { "content-type": "application/json" },
        body: payload === undefined ? undefined : JSON.stringify(payload),
        cache: "no-store",
      });
      const durationMs = Math.round(performance.now() - started);
      const raw = await httpResponse.text();
      let parsed: unknown = raw;
      try {
        parsed = raw ? JSON.parse(raw) : null;
      } catch {
        // HTML yoki bo'sh javob
      }

      setResponse({
        status: httpResponse.status,
        statusText: httpResponse.statusText,
        durationMs,
        raw,
        parsed,
      });
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "So'rov yuborilmadi.");
    } finally {
      setSending(false);
    }
  }

  async function copyResponse() {
    if (!response) return;
    await navigator.clipboard.writeText(pretty(response.parsed));
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Terminal className="h-5 w-5 text-primary" />
            <h1 className="text-2xl font-semibold tracking-tight">API interfeysi</h1>
          </div>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            OpenAPI 3.1 shartnomasi asosidagi interaktiv interfeys. So&apos;rovlar joriy
            sessiya cookie&apos;si bilan same-origin yuboriladi; demo tugmasi real smena,
            ombor va tovar ma&apos;lumotlarini oladi.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="success" className="gap-1">
            <ShieldCheck className="h-3 w-3" />
            {user.roleName}
          </Badge>
          <Badge variant="outline">{API_OPERATIONS.length} endpoint</Badge>
          <Button variant="outline" size="sm" asChild>
            <a href="/api/openapi" target="_blank" rel="noreferrer">
              <Braces className="h-4 w-4" />
              OpenAPI JSON
            </a>
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[300px_minmax(0,1fr)]">
        <Card className="h-fit lg:sticky lg:top-24">
          <CardHeader className="pb-3">
            <CardTitle>Endpointlar</CardTitle>
            <CardDescription>Sessiya: {user.name}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5 px-3 pb-4">
            {API_TAGS.map((tag) => (
              <div key={tag}>
                <p className="px-2 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {tag}
                </p>
                <div className="space-y-1">
                  {API_OPERATIONS.filter((operation) => operation.tag === tag).map((operation) => (
                    <button
                      key={operation.id}
                      type="button"
                      onClick={() => selectOperation(operation)}
                      className={cn(
                        "flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm transition-colors",
                        selected.id === operation.id
                          ? "bg-primary/10 text-primary"
                          : "text-muted-foreground hover:bg-accent hover:text-foreground",
                      )}
                    >
                      <span
                        className={cn(
                          "inline-flex w-11 shrink-0 justify-center rounded border px-1 py-0.5 font-mono text-[10px] font-semibold",
                          METHOD_STYLES[operation.method],
                        )}
                      >
                        {operation.method}
                      </span>
                      <span className="truncate font-mono text-[11px]">{operation.path}</span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={cn(
                    "inline-flex rounded border px-2 py-0.5 font-mono text-xs font-semibold",
                    METHOD_STYLES[selected.method],
                  )}
                >
                  {selected.method}
                </span>
                <CardTitle className="font-mono text-sm">{selected.path}</CardTitle>
                {selected.secured ? (
                  <Badge variant="secondary" className="ml-auto gap-1">
                    <ShieldCheck className="h-3 w-3" /> Cookie auth
                  </Badge>
                ) : (
                  <Badge variant="outline" className="ml-auto">
                    Ochiq
                  </Badge>
                )}
              </div>
              <CardDescription>{selected.description}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {selected.method === "GET" && (
                <div className="space-y-1.5">
                  <Label htmlFor="query">Query string (ixtiyoriy)</Label>
                  <Input
                    id="query"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="q=4780001000011 yoki warehouseId=..."
                    className="font-mono text-xs"
                  />
                </div>
              )}

              {selected.method === "POST" && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <Label htmlFor="body">JSON tanasi</Label>
                    <span className="text-xs text-muted-foreground">application/json</span>
                  </div>
                  {selected.demoKind && selected.demoKind !== "login" && (
                    <p className="text-xs text-muted-foreground">
                      Namunadagi IDlar haqiqiy emas — <span className="font-medium text-foreground">Demo ma&apos;lumotlarini yuklash</span> tugmasi ularni joriy smena, ombor va tovar bilan almashtiradi.
                    </p>
                  )}
                  <Textarea
                    id="body"
                    value={body}
                    onChange={(event) => setBody(event.target.value)}
                    spellCheck={false}
                    className="min-h-[300px] font-mono text-xs leading-relaxed"
                  />
                </div>
              )}

              <div className="flex flex-wrap items-center gap-2">
                <Button type="button" onClick={sendRequest} disabled={sending}>
                  {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                  Yuborish
                </Button>

                {selected.demoKind && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={fillDemo}
                    disabled={demoLoading}
                  >
                    {demoLoading ? (
                      <RefreshCw className="h-4 w-4 animate-spin" />
                    ) : (
                      <Sparkles className="h-4 w-4" />
                    )}
                    Demo ma&apos;lumotlarini yuklash
                  </Button>
                )}

                {selected.method === "POST" && (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      setBody("");
                      setError(null);
                      setResponse(null);
                    }}
                  >
                    Tozalash
                  </Button>
                )}
              </div>

              {error && (
                <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                  {error}
                </div>
              )}

              {!canUsePos && (
                <p className="text-xs text-muted-foreground">
                  Sizda `pos.use` yo&apos;q — POS demo ma&apos;lumotlari yuklanmaydi, lekin
                  autentifikatsiya va kassa so&apos;rovlarini ko&apos;rishingiz mumkin.
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <CardTitle>Javob</CardTitle>
                  {response && (
                    <Badge
                      variant={
                        response.status >= 200 && response.status < 300
                          ? "success"
                          : response.status >= 500
                            ? "destructive"
                            : "warning"
                      }
                    >
                      {response.status} {response.statusText}
                    </Badge>
                  )}
                  {response && (
                    <span className="text-xs text-muted-foreground">{response.durationMs} ms</span>
                  )}
                </div>
                {response && (
                  <Button type="button" variant="ghost" size="sm" onClick={copyResponse}>
                    {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    {copied ? "Nusxalandi" : "Nusxalash"}
                  </Button>
                )}
              </div>
              <CardDescription>
                {response
                  ? response.status === 401
                    ? "Sessiya tugagan bo'lishi mumkin — qayta kiring."
                    : "Server javobi (JSON yoki matn)."
                  : "So'rov yuborilgach natija shu yerda chiqadi."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <pre className="max-h-[460px] overflow-auto rounded-lg bg-slate-950 p-4 text-xs leading-relaxed text-slate-100">
                {response ? pretty(response.parsed) : "// response"}
              </pre>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
