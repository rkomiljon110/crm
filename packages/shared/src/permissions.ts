/**
 * Granular RBAC katalogi.
 * Permission kalitlari DBdagi `Permission.key` bilan bir xil bo'lishi shart.
 */

export const PERMISSIONS = [
  { key: "dashboard.view", group: "Boshqaruv", description: "Boshqaruv paneli va KPIlarni ko'rish" },
  { key: "reports.export", group: "Boshqaruv", description: "Hisobotlarni eksport qilish" },
  { key: "audit.view", group: "Boshqaruv", description: "Audit jurnalini ko'rish" },

  { key: "pos.use", group: "Kassa", description: "POS kassada savdo qilish" },
  { key: "pos.discount", group: "Kassa", description: "Chegirma berish" },
  { key: "shifts.manage", group: "Kassa", description: "Kassa smenasini ochish/yopish" },

  { key: "sales.view", group: "Savdo", description: "Savdolarni ko'rish" },
  { key: "sales.create", group: "Savdo", description: "Yangi savdo yaratish" },
  { key: "sales.refund", group: "Savdo", description: "Tovarni qaytarish" },
  { key: "sales.cancel", group: "Savdo", description: "Chekni bekor qilish" },

  { key: "customers.view", group: "Mijozlar", description: "Mijozlar va qarzlarni ko'rish" },
  { key: "customers.manage", group: "Mijozlar", description: "Mijoz qo'shish/tahrirlash" },
  { key: "customers.pay", group: "Mijozlar", description: "Qarz to'lovini qabul qilish" },

  { key: "products.view", group: "Tovar", description: "Tovar katalogini ko'rish" },
  { key: "products.viewCost", group: "Tovar", description: "Tannarx va foydani ko'rish" },
  { key: "products.manage", group: "Tovar", description: "Tovar va narxlarni boshqarish" },

  { key: "inventory.view", group: "Ombor", description: "Ombor qoldiqlarini ko'rish" },
  { key: "inventory.manage", group: "Ombor", description: "Kirim, reviziya, yo'qotish" },
  { key: "inventory.transfer", group: "Ombor", description: "Omborlar orasida ko'chirish" },

  { key: "suppliers.view", group: "Ta'minot", description: "Yetkazib beruvchilarni ko'rish" },
  { key: "suppliers.manage", group: "Ta'minot", description: "Yetkazib beruvchi va qarzlarni boshqarish" },

  { key: "finance.view", group: "Moliya", description: "P&L, cash flow va kassa hisobotlari" },
  { key: "finance.manage", group: "Moliya", description: "Moliyaviy sozlamalar va yopish" },
  { key: "expenses.manage", group: "Moliya", description: "Xarajatlarni kiritish" },

  { key: "staff.manage", group: "Xodimlar", description: "Xodim va rollarni boshqarish" },
  { key: "settings.manage", group: "Tizim", description: "Do'kon va tizim sozlamalari" },
  { key: "sync.manage", group: "Tizim", description: "Offline sync va qurilmalarni boshqarish" },
] as const;

export type PermissionKey = (typeof PERMISSIONS)[number]["key"];

export const PERMISSION_KEYS: PermissionKey[] = PERMISSIONS.map((p) => p.key);

export const PERMISSION_GROUPS = Array.from(new Set(PERMISSIONS.map((p) => p.group)));

export type RoleCode =
  | "SUPER_ADMIN"
  | "BRANCH_MANAGER"
  | "SENIOR_SELLER"
  | "CASHIER"
  | "WAREHOUSE"
  | "ACCOUNTANT";

export interface RoleDefinition {
  code: RoleCode;
  name: string;
  description: string;
  permissions: PermissionKey[] | "*";
}

export const ROLE_DEFINITIONS: RoleDefinition[] = [
  {
    code: "SUPER_ADMIN",
    name: "Super admin",
    description: "Biznes egasi — barcha huquqlar",
    permissions: "*",
  },
  {
    code: "BRANCH_MANAGER",
    name: "Filial boshqaruvchisi",
    description: "Filial savdosi, ombori va moliyasini boshqaradi",
    permissions: [
      "dashboard.view",
      "reports.export",
      "audit.view",
      "pos.use",
      "pos.discount",
      "shifts.manage",
      "sales.view",
      "sales.create",
      "sales.refund",
      "sales.cancel",
      "customers.view",
      "customers.manage",
      "customers.pay",
      "products.view",
      "products.viewCost",
      "products.manage",
      "inventory.view",
      "inventory.manage",
      "inventory.transfer",
      "suppliers.view",
      "suppliers.manage",
      "finance.view",
      "expenses.manage",
    ],
  },
  {
    code: "SENIOR_SELLER",
    name: "Katta sotuvchi",
    description: "Kassa, qaytarish va mijozlar bilan ishlash",
    permissions: [
      "pos.use",
      "pos.discount",
      "shifts.manage",
      "sales.view",
      "sales.create",
      "sales.refund",
      "customers.view",
      "customers.manage",
      "customers.pay",
      "products.view",
    ],
  },
  {
    code: "CASHIER",
    name: "Kassir",
    description: "Faqat kassa va nasiya qabul qilish",
    permissions: [
      "pos.use",
      "shifts.manage",
      "sales.view",
      "sales.create",
      "customers.view",
      "customers.pay",
      "products.view",
    ],
  },
  {
    code: "WAREHOUSE",
    name: "Omborchi",
    description: "Kirim, reviziya va omborlar orasida ko'chirish",
    permissions: [
      "products.view",
      "products.manage",
      "inventory.view",
      "inventory.manage",
      "inventory.transfer",
      "suppliers.view",
      "suppliers.manage",
    ],
  },
  {
    code: "ACCOUNTANT",
    name: "Buxgalter",
    description: "Moliya, hisobot va ta'minot hisob-kitoblari",
    permissions: [
      "dashboard.view",
      "reports.export",
      "audit.view",
      "sales.view",
      "customers.view",
      "products.view",
      "products.viewCost",
      "suppliers.view",
      "suppliers.manage",
      "finance.view",
      "finance.manage",
      "expenses.manage",
    ],
  },
];

export const ROLE_CODES: RoleCode[] = ROLE_DEFINITIONS.map((r) => r.code);

export function permissionsForRole(code: RoleCode): PermissionKey[] {
  const role = ROLE_DEFINITIONS.find((r) => r.code === code);
  if (!role) return [];
  return role.permissions === "*" ? PERMISSION_KEYS : role.permissions;
}

export function can(permissions: readonly string[] | undefined, key: PermissionKey): boolean {
  return !!permissions?.includes(key);
}

export function canAny(permissions: readonly string[] | undefined, keys: PermissionKey[]): boolean {
  return keys.some((k) => can(permissions, k));
}

/** URL prefiksi -> sahifani ko'rish uchun kerakli ruxsat */
export const ROUTE_PERMISSIONS: Record<string, PermissionKey> = {
  "/dashboard": "dashboard.view",
  "/pos": "pos.use",
  "/sales": "sales.view",
  "/customers": "customers.view",
  "/products": "products.view",
  "/inventory": "inventory.view",
  "/suppliers": "suppliers.view",
  "/finance": "finance.view",
  "/staff": "staff.manage",
  "/settings": "settings.manage",
  "/audit": "audit.view",
};

export function homePathForPermissions(permissions: readonly string[]): string {
  const ordered = Object.entries(ROUTE_PERMISSIONS);
  for (const [path, key] of ordered) {
    if (permissions.includes(key)) return path;
  }
  return "/403";
}
