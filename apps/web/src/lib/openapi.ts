/**
 * Savdo ERP REST API shartnomasi (OpenAPI 3.1).
 *
 * - `/api/openapi` — mashina o'qiydigan JSON.
 * - `/api-docs` — shu katalog asosidagi interaktiv API interfeysi.
 *
 * Barcha `/api/v1/*` endpointlar HttpOnly sessiya cookie'si (savdo_session)
 * orqali autentifikatsiya qilinadi. Mutatsion so'rovlarda same-origin
 * `Origin` header'i majburiy (CSRF himoyasi).
 */

export type ApiMethod = "GET" | "POST";
export type ApiDemoKind = "login" | "bootstrap" | "order" | "sync" | "shift-open" | "shift-close";

export interface ApiOperation {
  id: string;
  method: ApiMethod;
  path: string;
  tag: string;
  summary: string;
  description: string;
  secured: boolean;
  demoKind?: ApiDemoKind;
  bodyExample?: unknown;
}

const ORDER_EXAMPLE = {
  warehouseId: "wh_shop1",
  customerId: null,
  items: [{ variantId: "v_123", quantity: 1, unitPrice: 15000, discountAmount: 0 }],
  discountAmount: 0,
  taxAmount: 0,
  payments: [{ method: "CASH", amount: 15000 }],
  note: "API explorer demo",
};

const SYNC_EXAMPLE = {
  deviceId: "pos-01",
  orders: [
    {
      ...ORDER_EXAMPLE,
      clientOrderId: "0f8fad5b-d9cb-469f-a165-70867728950e",
      clientCreatedAt: "2026-10-24T14:02:11+05:00",
    },
  ],
};

export const API_OPERATIONS: ApiOperation[] = [
  {
    id: "login",
    method: "POST",
    path: "/api/auth/login",
    tag: "Autentifikatsiya",
    summary: "Tizimga kirish",
    description:
      "Biznes kodi, telefon va parol bilan sessiya ochadi. Muvaffaqiyatli javobda HttpOnly `savdo_session` cookie o'rnatiladi.",
    secured: false,
    demoKind: "login",
    bodyExample: { tenantSlug: "baraka", phone: "+998901234567", password: "<parol>" },
  },
  {
    id: "logout",
    method: "POST",
    path: "/api/auth/logout",
    tag: "Autentifikatsiya",
    summary: "Tizimdan chiqish",
    description: "Joriy sessiyani DBda bekor qiladi va cookie'ni o'chiradi.",
    secured: true,
  },
  {
    id: "me",
    method: "GET",
    path: "/api/auth/me",
    tag: "Autentifikatsiya",
    summary: "Joriy foydalanuvchi",
    description: "Sessiya, rol va granular ruxsatlar ro'yxatini qaytaradi.",
    secured: true,
  },
  {
    id: "health",
    method: "GET",
    path: "/api/health",
    tag: "Tizim",
    summary: "Health check",
    description: "DB javob vaqtini tekshiradi. Monitoring uchun autentifikatsiyasiz.",
    secured: false,
  },
  {
    id: "openapi",
    method: "GET",
    path: "/api/openapi",
    tag: "Tizim",
    summary: "OpenAPI 3.1 hujjati",
    description: "Mashina o'qiydigan API shartnomasi (JSON).",
    secured: false,
  },
  {
    id: "bootstrap",
    method: "GET",
    path: "/api/v1/pos/bootstrap",
    tag: "POS",
    summary: "POS bootstrap va qidiruv",
    description:
      "Joriy smena, omborlar, tovar katalogi va nasiya mijozlarini qaytaradi. `q` bilan shtrix-kod, SKU yoki nom bo'yicha qidiradi; tannarx qaytarilmaydi.",
    secured: true,
    demoKind: "bootstrap",
  },
  {
    id: "order-create",
    method: "POST",
    path: "/api/v1/orders",
    tag: "Savdo",
    summary: "Onlayn POS cheki",
    description:
      "Bitta tranzaksiyada qoldiq, Order, to'lov, nasiya va auditni yozadi. Ixtiyoriy `Idempotency-Key` header'i bilan xavfsiz retry qilinadi.",
    secured: true,
    demoKind: "order",
    bodyExample: ORDER_EXAMPLE,
  },
  {
    id: "sync-orders",
    method: "POST",
    path: "/api/v1/sync/orders",
    tag: "Savdo",
    summary: "Offline cheklarni sinxronlash",
    description:
      "1–100 chekdan iborat batch. Har bir chek alohida tranzaksiyada ishlanadi; natija `processed`, `skipped_duplicate` yoki `failed` bo'ladi.",
    secured: true,
    demoKind: "sync",
    bodyExample: SYNC_EXAMPLE,
  },
  {
    id: "shift-open",
    method: "POST",
    path: "/api/v1/shifts/open",
    tag: "Kassa",
    summary: "Smena ochish",
    description: "Foydalanuvchi uchun bitta ochiq smena ochadi. `shifts.manage` ruxsati kerak.",
    secured: true,
    demoKind: "shift-open",
    bodyExample: { storeId: "store_shop1", openingCash: 100000, note: "API explorer" },
  },
  {
    id: "shift-current",
    method: "GET",
    path: "/api/v1/shifts/current",
    tag: "Kassa",
    summary: "Joriy smena va X-hisobot",
    description:
      "Ochiq smena bo'yicha jonli naqd/karta/o'tkazma/boshqa/qarz yig'indilarini qaytaradi. Smena bo'lmasa `shift: null`.",
    secured: true,
    demoKind: "bootstrap",
  },
  {
    id: "shift-close",
    method: "POST",
    path: "/api/v1/shifts/close",
    tag: "Kassa",
    summary: "Smenani yopish (Z-hisobot)",
    description:
      "Naqd sanog'ini qabul qiladi, kutilgan naqd va farqni hisoblab DBga yozadi. Yopilgach yangi chek `SHIFT_REQUIRED` bilan rad etiladi.",
    secured: true,
    demoKind: "shift-close",
    bodyExample: { shiftId: "shift_id", closingCash: 100000, note: "API explorer" },
  },
];

const ERROR_SCHEMA = {
  type: "object",
  required: ["error"],
  properties: {
    error: { type: "string" },
    code: { type: "string", description: "Mashina o'qiydigan domen xatosi" },
    details: { type: "object", additionalProperties: true },
  },
};

const ORDER_INPUT_SCHEMA = {
  type: "object",
  required: ["warehouseId", "items"],
  properties: {
    type: { type: "string", enum: ["SALE", "RETURN"], default: "SALE" },
    storeId: { type: ["string", "null"] },
    warehouseId: { type: "string" },
    customerId: { type: ["string", "null"] },
    items: {
      type: "array",
      minItems: 1,
      items: {
        type: "object",
        required: ["variantId", "quantity", "unitPrice"],
        properties: {
          variantId: { type: "string" },
          quantity: { type: "number", exclusiveMinimum: 0 },
          unitPrice: { type: "number", minimum: 0 },
          discountAmount: { type: "number", minimum: 0, default: 0 },
        },
      },
    },
    discountAmount: { type: "number", minimum: 0, default: 0 },
    taxAmount: { type: "number", minimum: 0, default: 0 },
    dueDate: { type: ["string", "null"], format: "date-time" },
    note: { type: ["string", "null"], maxLength: 500 },
    payments: {
      type: "array",
      items: {
        type: "object",
        required: ["method", "amount"],
        properties: {
          method: {
            type: "string",
            enum: ["CASH", "CARD", "TRANSFER", "CLICK", "PAYME", "UZUM", "OTHER", "DEBT"],
          },
          amount: { type: "number", exclusiveMinimum: 0 },
          provider: { type: ["string", "null"] },
          providerRef: { type: ["string", "null"] },
        },
      },
    },
  },
};

export const openApiDocument = {
  openapi: "3.1.0",
  info: {
    title: "Savdo ERP API",
    version: "1.0.0",
    description:
      "O'zbekiston bozori uchun multi-tenant POS/ERP API. Sessiya HttpOnly cookie orqali; mutatsiyalarda Origin tekshiriladi.",
  },
  servers: [{ url: "/", description: "Joriy server" }],
  tags: [
    { name: "Autentifikatsiya" },
    { name: "POS" },
    { name: "Savdo" },
    { name: "Kassa" },
    { name: "Tizim" },
  ],
  security: [{ sessionCookie: [] }],
  components: {
    securitySchemes: {
      sessionCookie: { type: "apiKey", in: "cookie", name: "savdo_session" },
    },
    schemas: {
      ErrorResponse: ERROR_SCHEMA,
      LoginRequest: {
        type: "object",
        required: ["tenantSlug", "phone", "password"],
        properties: {
          tenantSlug: { type: "string", example: "baraka" },
          phone: { type: "string", example: "+998901234567" },
          password: { type: "string", format: "password" },
        },
      },
      OrderInput: ORDER_INPUT_SCHEMA,
      SyncOrderInput: {
        allOf: [
          { $ref: "#/components/schemas/OrderInput" },
          {
            type: "object",
            required: ["clientOrderId", "clientCreatedAt"],
            properties: {
              clientOrderId: { type: "string", format: "uuid" },
              clientCreatedAt: { type: "string", format: "date-time" },
            },
          },
        ],
      },
      SyncBatchInput: {
        type: "object",
        required: ["deviceId", "orders"],
        properties: {
          deviceId: { type: "string" },
          orders: {
            type: "array",
            minItems: 1,
            maxItems: 100,
            items: { $ref: "#/components/schemas/SyncOrderInput" },
          },
        },
      },
      ShiftOpenInput: {
        type: "object",
        required: ["storeId", "openingCash"],
        properties: {
          storeId: { type: "string" },
          openingCash: { type: "number", minimum: 0 },
          note: { type: "string", maxLength: 300 },
        },
      },
      ShiftCloseInput: {
        type: "object",
        required: ["shiftId", "closingCash"],
        properties: {
          shiftId: { type: "string" },
          closingCash: { type: "number", minimum: 0 },
          note: { type: "string", maxLength: 300 },
        },
      },
    },
  },
  paths: {
    "/api/auth/login": {
      post: {
        tags: ["Autentifikatsiya"],
        summary: "Tizimga kirish",
        security: [],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/LoginRequest" },
              example: API_OPERATIONS[0]!.bodyExample,
            },
          },
        },
        responses: {
          "200": { description: "Sessiya cookie o'rnatildi" },
          "401": { description: "Noto'g'ri biznes kodi, telefon yoki parol" },
          "429": { description: "Juda ko'p urinish" },
        },
      },
    },
    "/api/auth/logout": {
      post: {
        tags: ["Autentifikatsiya"],
        summary: "Tizimdan chiqish",
        responses: { "200": { description: "Sessiya bekor qilindi" } },
      },
    },
    "/api/auth/me": {
      get: {
        tags: ["Autentifikatsiya"],
        summary: "Joriy foydalanuvchi",
        responses: {
          "200": { description: "Sessiya, rol va ruxsatlar" },
          "401": { description: "Sessiya yo'q yoki bekor qilingan" },
        },
      },
    },
    "/api/health": {
      get: {
        tags: ["Tizim"],
        summary: "Health check",
        security: [],
        responses: { "200": { description: "DB holati" } },
      },
    },
    "/api/openapi": {
      get: {
        tags: ["Tizim"],
        summary: "OpenAPI 3.1 hujjati",
        security: [],
        responses: { "200": { description: "OpenAPI JSON" } },
      },
    },
    "/api/v1/pos/bootstrap": {
      get: {
        tags: ["POS"],
        summary: "POS bootstrap va qidiruv",
        parameters: [
          { name: "warehouseId", in: "query", schema: { type: "string" } },
          { name: "q", in: "query", schema: { type: "string", maxLength: 100 } },
        ],
        responses: {
          "200": { description: "Smena, omborlar, katalog va mijozlar" },
          "403": { description: "pos.use ruxsati yo'q", content: { "application/json": { schema: ERROR_SCHEMA } } },
        },
      },
    },
    "/api/v1/orders": {
      post: {
        tags: ["Savdo"],
        summary: "Onlayn POS cheki",
        parameters: [
          {
            name: "Idempotency-Key",
            in: "header",
            description: "Ixtiyoriy; 8–100 belgi. Bir xil kalit ikkinchi chek yaratmaydi.",
            schema: { type: "string", minLength: 8, maxLength: 100 },
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/OrderInput" },
              example: ORDER_EXAMPLE,
            },
          },
        },
        responses: {
          "201": { description: "Chek yaratildi" },
          "200": { description: "Idempotent takror — mavjud chek qaytdi" },
          "400": { description: "Smena yo'q (SHIFT_REQUIRED)" },
          "403": { description: "Ruxsat yo'q (DISCOUNT_FORBIDDEN va h.k.)" },
          "409": { description: "Qoldiq yetmadi yoki kredit limiti" },
          "422": { description: "Validatsiya xatosi" },
        },
      },
    },
    "/api/v1/sync/orders": {
      post: {
        tags: ["Savdo"],
        summary: "Offline cheklarni sinxronlash",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/SyncBatchInput" },
              example: SYNC_EXAMPLE,
            },
          },
        },
        responses: {
          "200": { description: "Batch natijasi (partial success mumkin)" },
          "422": { description: "Batch validatsiyasi xato" },
        },
      },
    },
    "/api/v1/shifts/open": {
      post: {
        tags: ["Kassa"],
        summary: "Smena ochish",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ShiftOpenInput" },
              example: { storeId: "store_shop1", openingCash: 100000, note: "API explorer" },
            },
          },
        },
        responses: {
          "201": { description: "Smena ochildi" },
          "409": { description: "Ochiq smena allaqachon bor" },
        },
      },
    },
    "/api/v1/shifts/current": {
      get: {
        tags: ["Kassa"],
        summary: "Joriy smena va X-hisobot",
        responses: { "200": { description: "Smena yoki null" } },
      },
    },
    "/api/v1/shifts/close": {
      post: {
        tags: ["Kassa"],
        summary: "Smenani yopish (Z-hisobot)",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ShiftCloseInput" },
              example: { shiftId: "shift_id", closingCash: 100000, note: "API explorer" },
            },
          },
        },
        responses: {
          "200": { description: "Smena yopildi, farq hisoblandi" },
          "409": { description: "Smena allaqachon yopilgan" },
        },
      },
    },
  },
} as const;

export const API_TAGS = Array.from(new Set(API_OPERATIONS.map((operation) => operation.tag)));
