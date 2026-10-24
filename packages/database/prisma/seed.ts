/**
 * Demo seed — "Baraka Savdo" tenantasi.
 *
 * Ishga tushirish:  npm run db:seed
 * Demo login:       biznes kodi `baraka`, admin `+998901234567` / `demo1234`
 *
 * Seed idempotent: avval barcha tenant ma'lumotlari TRUNCATE CASCADE bilan
 * tozalanadi, keyin qayta yaratiladi. Permission katalogi global bo'lib qoladi.
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import {
  EXPENSE_CATEGORIES,
  PERMISSION_KEYS,
  PERMISSIONS,
  ROLE_DEFINITIONS,
  UNITS,
  addDays,
  startOfUzDay,
} from "@repo/shared";

const db = new PrismaClient();

const TENANT_SLUG = "baraka";
const DEMO_PASSWORD = "demo1234";

// Deterministik tasodifiy generator — har seed bir xil demo beradi
let seedState = 20261023;
function rand(): number {
  seedState = (seedState * 1664525 + 1013904223) % 4294967296;
  return seedState / 4294967296;
}
function randInt(min: number, max: number): number {
  return Math.floor(rand() * (max - min + 1)) + min;
}
function pick<T>(arr: T[]): T {
  return arr[Math.floor(rand() * arr.length)] as T;
}

interface VariantSeed {
  name: string;
  cost: number;
  sell: number;
  wholesale?: number;
  barcode: string;
  main: number;
  shop1: number;
  shop2: number;
}
interface ProductSeed {
  name: string;
  sku: string;
  category: string;
  unit: string;
  minStock: number;
  hasVariants?: boolean;
  variants: VariantSeed[];
}

const PRODUCTS: ProductSeed[] = [
  {
    name: "Oq shakar (1 kg)",
    sku: "SHK-1",
    category: "Oziq-ovqat",
    unit: "kg",
    minStock: 20,
    variants: [
      { name: "Standart", cost: 10500, sell: 12500, wholesale: 11800, barcode: "4780001000011", main: 120, shop1: 35, shop2: 12 },
    ],
  },
  {
    name: "Lazer guruch (1 kg)",
    sku: "GRC-1",
    category: "Oziq-ovqat",
    unit: "kg",
    minStock: 25,
    variants: [
      { name: "Standart", cost: 14000, sell: 18000, wholesale: 16800, barcode: "4780001000028", main: 150, shop1: 42, shop2: 18 },
    ],
  },
  {
    name: "O'simlik yog'i (1 L)",
    sku: "YOG-1",
    category: "Oziq-ovqat",
    unit: "litr",
    minStock: 15,
    variants: [
      { name: "Standart", cost: 17000, sell: 21000, wholesale: 19800, barcode: "4780001000035", main: 90, shop1: 24, shop2: 10 },
    ],
  },
  {
    name: "Tuxum (10 dona)",
    sku: "TUX-10",
    category: "Oziq-ovqat",
    unit: "paket",
    minStock: 10,
    variants: [
      { name: "Standart", cost: 17000, sell: 21000, wholesale: 20000, barcode: "4780001000042", main: 60, shop1: 14, shop2: 6 },
    ],
  },
  {
    name: "Non (patir)",
    sku: "NON-1",
    category: "Oziq-ovqat",
    unit: "dona",
    minStock: 20,
    variants: [
      { name: "Standart", cost: 3000, sell: 4000, barcode: "4780001000059", main: 30, shop1: 4, shop2: 0 },
    ],
  },
  {
    name: "Coca-Cola (1.5 L)",
    sku: "COLA-15",
    category: "Ichimliklar",
    unit: "dona",
    minStock: 12,
    variants: [
      { name: "Standart", cost: 12000, sell: 15000, wholesale: 14000, barcode: "4780001000066", main: 80, shop1: 36, shop2: 20 },
    ],
  },
  {
    name: "Ichimlik suvi (1.5 L)",
    sku: "SUV-15",
    category: "Ichimliklar",
    unit: "dona",
    minStock: 24,
    variants: [
      { name: "Standart", cost: 3500, sell: 5000, wholesale: 4500, barcode: "4780001000073", main: 200, shop1: 60, shop2: 30 },
    ],
  },
  {
    name: "Qora choy Akbar (100 g)",
    sku: "CHOY-100",
    category: "Ichimliklar",
    unit: "dona",
    minStock: 10,
    variants: [
      { name: "Standart", cost: 9000, sell: 13000, wholesale: 12000, barcode: "4780001000080", main: 45, shop1: 18, shop2: 8 },
    ],
  },
  {
    name: "Ariel kir yuvish kukuni (3 kg)",
    sku: "ARIEL-3",
    category: "Maishiy kimyo",
    unit: "dona",
    minStock: 8,
    variants: [
      { name: "Standart", cost: 52000, sell: 65000, wholesale: 61000, barcode: "4780001000097", main: 40, shop1: 12, shop2: 5 },
    ],
  },
  {
    name: "Atir sovun (85 g)",
    sku: "SOVUN-85",
    category: "Maishiy kimyo",
    unit: "dona",
    minStock: 20,
    variants: [
      { name: "Standart", cost: 6000, sell: 9000, barcode: "4780001000103", main: 100, shop1: 44, shop2: 20 },
    ],
  },
  {
    name: "Erkaklar futbolkasi",
    sku: "FUT-BAS",
    category: "Kiyim-kechak",
    unit: "dona",
    minStock: 5,
    hasVariants: true,
    variants: [
      { name: "M / Oq", cost: 45000, sell: 79000, wholesale: 70000, barcode: "4780001000110", main: 25, shop1: 8, shop2: 4 },
      { name: "L / Oq", cost: 45000, sell: 79000, wholesale: 70000, barcode: "4780001000127", main: 20, shop1: 6, shop2: 3 },
      { name: "XL / Qora", cost: 48000, sell: 84000, wholesale: 75000, barcode: "4780001000134", main: 15, shop1: 5, shop2: 2 },
    ],
  },
  {
    name: "USB Type-C kabel (1 m)",
    sku: "USB-C1",
    category: "Elektronika",
    unit: "dona",
    minStock: 10,
    variants: [
      { name: "Standart", cost: 12000, sell: 25000, wholesale: 22000, barcode: "4780001000141", main: 70, shop1: 22, shop2: 9 },
    ],
  },
];

async function main() {
  console.log("🧹 Eski demo ma'lumotlar tozalanmoqda...");
  await db.$executeRawUnsafe('TRUNCATE TABLE "Tenant" RESTART IDENTITY CASCADE');

  // ── Permission katalogi (global) ─────────────────────────────────────────
  console.log("🔐 Permission katalogi...");
  for (const permission of PERMISSIONS) {
    await db.permission.upsert({
      where: { key: permission.key },
      update: { group: permission.group, description: permission.description },
      create: { key: permission.key, group: permission.group, description: permission.description },
    });
  }
  const permissionMap = new Map(
    (await db.permission.findMany()).map((p) => [p.key, p.id] as const),
  );

  // ── Tenant ───────────────────────────────────────────────────────────────
  console.log("🏢 Tenant yaratilmoqda...");
  const tenant = await db.tenant.create({
    data: {
      name: "Baraka Savdo",
      slug: TENANT_SLUG,
      inn: "301234567",
      phone: "+998712001122",
      email: "info@baraka.uz",
      currency: "UZS",
      usdRate: 12650,
      timezone: "Asia/Tashkent",
      locale: "uz",
    },
  });

  // ── Rollar ───────────────────────────────────────────────────────────────
  console.log("👥 Rollar va ruxsatlar...");
  const roleMap = new Map<string, string>();
  for (const roleDef of ROLE_DEFINITIONS) {
    const keys = roleDef.permissions === "*" ? PERMISSION_KEYS : roleDef.permissions;
    const role = await db.role.create({
      data: {
        tenantId: tenant.id,
        code: roleDef.code,
        name: roleDef.name,
        description: roleDef.description,
        isSystem: true,
        permissions: {
          create: keys.map((key) => ({
            tenantId: tenant.id,
            permissionId: permissionMap.get(key)!,
          })),
        },
      },
    });
    roleMap.set(roleDef.code, role.id);
  }

  // ── Filial va omborlar ───────────────────────────────────────────────────
  const shop1 = await db.store.create({
    data: { tenantId: tenant.id, code: "SHOP-1", name: "Markaziy do'kon", address: "Toshkent, Chilonzor 9-mavze", phone: "+998712001133" },
  });
  const shop2 = await db.store.create({
    data: { tenantId: tenant.id, code: "SHOP-2", name: "Yunusobod filiali", address: "Toshkent, Yunusobod 4-mavze", phone: "+998712001144" },
  });
  const mainWarehouse = await db.warehouse.create({
    data: { tenantId: tenant.id, code: "MAIN", name: "Markaziy ombor", type: "MAIN", address: "Toshkent, Sergeli logistika markazi" },
  });
  const shop1Warehouse = await db.warehouse.create({
    data: { tenantId: tenant.id, storeId: shop1.id, code: "SHOP-1", name: "Markaziy do'kon ombori", type: "SHOP" },
  });
  const shop2Warehouse = await db.warehouse.create({
    data: { tenantId: tenant.id, storeId: shop2.id, code: "SHOP-2", name: "Yunusobod ombori", type: "SHOP" },
  });

  // ── Xodimlar ─────────────────────────────────────────────────────────────
  console.log("🧑‍💼 Xodimlar...");
  const passwordHash = bcrypt.hashSync(DEMO_PASSWORD, 10);
  const users = {
    admin: await db.user.create({
      data: {
        tenantId: tenant.id,
        storeId: shop1.id,
        roleId: roleMap.get("SUPER_ADMIN")!,
        name: "Bekzod Karimov",
        phone: "+998901234567",
        email: "bekzod@baraka.uz",
        passwordHash,
      },
    }),
    manager: await db.user.create({
      data: {
        tenantId: tenant.id,
        storeId: shop1.id,
        roleId: roleMap.get("BRANCH_MANAGER")!,
        name: "Malika Rahimova",
        phone: "+998901112233",
        passwordHash,
      },
    }),
    cashier: await db.user.create({
      data: {
        tenantId: tenant.id,
        storeId: shop1.id,
        roleId: roleMap.get("CASHIER")!,
        name: "Dilshod Tursunov",
        phone: "+998902223344",
        passwordHash,
      },
    }),
    warehouse: await db.user.create({
      data: {
        tenantId: tenant.id,
        storeId: shop1.id,
        roleId: roleMap.get("WAREHOUSE")!,
        name: "Sherzod Aliyev",
        phone: "+998903334455",
        passwordHash,
      },
    }),
    accountant: await db.user.create({
      data: {
        tenantId: tenant.id,
        storeId: shop1.id,
        roleId: roleMap.get("ACCOUNTANT")!,
        name: "Nigora Saidova",
        phone: "+998904445566",
        passwordHash,
      },
    }),
  };

  // ── O'lchov birliklari va kategoriyalar ──────────────────────────────────
  const unitMap = new Map<string, string>();
  for (const unit of UNITS) {
    const created = await db.unit.create({
      data: { tenantId: tenant.id, name: unit.name, shortName: unit.shortName, allowDecimal: unit.allowDecimal },
    });
    unitMap.set(unit.shortName, created.id);
  }

  const categoryNames = ["Oziq-ovqat", "Ichimliklar", "Maishiy kimyo", "Kiyim-kechak", "Elektronika"];
  const categoryMap = new Map<string, string>();
  for (const name of categoryNames) {
    const created = await db.category.create({ data: { tenantId: tenant.id, name } });
    categoryMap.set(name, created.id);
  }

  // ── Tovar katalogi ───────────────────────────────────────────────────────
  console.log("📦 Tovar katalogi...");
  interface SaleableVariant {
    id: string;
    productName: string;
    variantName: string;
    cost: number;
    sell: number;
    unit: string;
  }
  const saleable: SaleableVariant[] = [];
  const openingLogs: Array<{
    tenantId: string;
    warehouseId: string;
    variantId: string;
    type: "OPENING";
    quantity: number;
    unitCost: number;
    reason: string;
    userId: string;
  }> = [];

  for (const p of PRODUCTS) {
    const product = await db.product.create({
      data: {
        tenantId: tenant.id,
        categoryId: categoryMap.get(p.category)!,
        unitId: unitMap.get(p.unit)!,
        name: p.name,
        sku: p.sku,
        hasVariants: p.hasVariants ?? false,
        minStockAlert: p.minStock,
        variants: {
          create: p.variants.map((v, index) => ({
            tenantId: tenant.id,
            name: v.name,
            sku: p.hasVariants ? `${p.sku}-${index + 1}` : p.sku,
            costPrice: v.cost,
            sellingPrice: v.sell,
            wholesalePrice: v.wholesale ?? null,
            isDefault: index === 0,
            barcodes: {
              create: [{ tenantId: tenant.id, code: v.barcode, isPrimary: true }],
            },
            inventories: {
              create: [
                { tenantId: tenant.id, warehouseId: mainWarehouse.id, quantity: v.main },
                { tenantId: tenant.id, warehouseId: shop1Warehouse.id, quantity: v.shop1 },
                { tenantId: tenant.id, warehouseId: shop2Warehouse.id, quantity: v.shop2 },
              ],
            },
          })),
        },
      },
      include: { variants: true },
    });

    product.variants.forEach((variant, index) => {
      const vs = p.variants[index]!;
      saleable.push({
        id: variant.id,
        productName: product.name,
        variantName: variant.name,
        cost: vs.cost,
        sell: vs.sell,
        unit: p.unit,
      });
      openingLogs.push(
        { tenantId: tenant.id, warehouseId: mainWarehouse.id, variantId: variant.id, type: "OPENING", quantity: vs.main, unitCost: vs.cost, reason: "Demo boshlang'ich qoldiq", userId: users.warehouse.id },
        { tenantId: tenant.id, warehouseId: shop1Warehouse.id, variantId: variant.id, type: "OPENING", quantity: vs.shop1, unitCost: vs.cost, reason: "Demo boshlang'ich qoldiq", userId: users.warehouse.id },
        { tenantId: tenant.id, warehouseId: shop2Warehouse.id, variantId: variant.id, type: "OPENING", quantity: vs.shop2, unitCost: vs.cost, reason: "Demo boshlang'ich qoldiq", userId: users.warehouse.id },
      );
    });
  }
  await db.stockMovementLog.createMany({ data: openingLogs });

  // ── Yetkazib beruvchilar ─────────────────────────────────────────────────
  const supplier1 = await db.supplier.create({
    data: {
      tenantId: tenant.id,
      name: "Toshkent Optom Savdo",
      phone: "+998712445566",
      address: "Toshkent, Uchtepa tumani",
      note: "Oziq-ovqat va ichimliklar",
      balanceDebt: 0,
    },
  });
  const supplier2 = await db.supplier.create({
    data: { tenantId: tenant.id, name: "Farg'ona Oziq-ovqat", phone: "+998733112233", balanceDebt: 0 },
  });
  const supplier3 = await db.supplier.create({
    data: { tenantId: tenant.id, name: "Global Kimyo", phone: "+998712778899", balanceDebt: 0 },
  });

  // ── Mijozlar (nasiya daftari) ────────────────────────────────────────────
  console.log("📕 Mijozlar...");
  const customerSeeds = [
    { name: "Aziz Karimov", phone: "+998935551122", limit: 2000000, passport: "AB1234567" },
    { name: "Dilnoza Yusupova", phone: "+998935552233", limit: 5000000, passport: "AC7654321" },
    { name: "Sardor Toshmatov", phone: "+998935553344", limit: 1000000, passport: null },
    { name: "Nodira Alimova", phone: "+998935554455", limit: 3000000, passport: "AD1122334" },
    { name: "Jasur Rahimov", phone: "+998935555566", limit: 10000000, passport: "AE9988776" },
    { name: "Gulnora Ismoilova", phone: "+998935556677", limit: 1500000, passport: null },
  ];
  const customers = [];
  for (const c of customerSeeds) {
    customers.push(
      await db.customer.create({
        data: {
          tenantId: tenant.id,
          storeId: shop1.id,
          name: c.name,
          phone: c.phone,
          passport: c.passport,
          maxDebtLimit: c.limit,
          debtBalance: 0,
        },
      }),
    );
  }

  // ── Savdo tarixi (45 kun) ────────────────────────────────────────────────
  console.log("🧾 45 kunlik savdo tarixi...");
  const today = startOfUzDay();
  const debtTotals = new Map<string, number>();
  let orderSequence = 0;

  for (let dayOffset = 44; dayOffset >= 0; dayOffset--) {
    const dayStart = addDays(today, -dayOffset);
    const ordersToday = randInt(1, 4);
    for (let n = 0; n < ordersToday; n++) {
      const isShop2 = rand() < 0.3;
      const store = isShop2 ? shop2 : shop1;
      const warehouse = isShop2 ? shop2Warehouse : shop1Warehouse;

      const itemCount = randInt(1, 3);
      const chosen: SaleableVariant[] = [];
      while (chosen.length < itemCount) {
        const candidate = pick(saleable);
        if (!chosen.some((v) => v.id === candidate.id)) chosen.push(candidate);
      }

      const items = chosen.map((v) => {
        const quantity = randInt(1, 3);
        return {
          variantId: v.id,
          productName: v.productName,
          variantName: v.variantName,
          quantity,
          unitPrice: v.sell,
          unitCost: v.cost,
          subtotal: quantity * v.sell,
        };
      });

      const subtotal = items.reduce((acc, i) => acc + i.subtotal, 0);
      const discountAmount = rand() < 0.18 ? Math.min(5000, subtotal - 1000) : 0;
      const totalAmount = subtotal - discountAmount;

      const scenario = rand();
      const customer = pick(customers);
      const withDebt = scenario >= 0.78;
      const partial = scenario >= 0.78 && scenario < 0.92;
      const paidAmount = withDebt ? (partial ? Math.round(totalAmount * (0.4 + rand() * 0.2)) : 0) : totalAmount;
      const debtAmount = totalAmount - paidAmount;
      const paymentStatus = debtAmount === 0 ? "PAID" : paidAmount > 0 ? "PARTIAL" : "UNPAID";

      // Sana: 09:00–20:00 oralig'ida; bugungi kun uchun hozirgi vaqtdan oshmaydi
      const hour = randInt(9, 20);
      const minute = randInt(0, 59);
      let createdAt = new Date(dayStart.getTime() + hour * 3600_000 + minute * 60_000);
      if (createdAt.getTime() > Date.now()) createdAt = new Date(Date.now() - randInt(5, 120) * 60_000);

      orderSequence += 1;
      const dateKey = createdAt.toISOString().slice(2, 10).replace(/-/g, "");
      const number = `S-${dateKey}-${String(orderSequence).padStart(4, "0")}`;
      const dueDate = withDebt ? addDays(createdAt, 14) : null;

      const payments: Array<{ method: "CASH" | "CARD"; amount: number }> = [];
      if (paidAmount > 0) {
        if (rand() < 0.45 && paidAmount > 10000) {
          const cashPart = Math.round(paidAmount * 0.6);
          payments.push({ method: "CASH", amount: cashPart });
          payments.push({ method: "CARD", amount: paidAmount - cashPart });
        } else {
          payments.push({ method: rand() < 0.7 ? "CASH" : "CARD", amount: paidAmount });
        }
      }

      const order = await db.order.create({
        data: {
          tenantId: tenant.id,
          number,
          type: "SALE",
          status: "COMPLETED",
          storeId: store.id,
          warehouseId: warehouse.id,
          cashierId: users.cashier.id,
          customerId: withDebt ? customer.id : null,
          subtotal,
          discountAmount,
          totalAmount,
          paidAmount,
          debtAmount,
          paymentStatus,
          dueDate,
          note: withDebt ? "Nasiya savdo" : null,
          createdAt,
          completedAt: createdAt,
        },
      });

      await db.orderItem.createMany({
        data: items.map((item) => ({ ...item, tenantId: tenant.id, orderId: order.id })),
      });

      if (payments.length > 0) {
        await db.paymentTransaction.createMany({
          data: payments.map((p) => ({
            tenantId: tenant.id,
            orderId: order.id,
            method: p.method,
            amount: p.amount,
            status: "COMPLETED" as const,
            receivedById: users.cashier.id,
            createdAt,
          })),
        });
      }

      if (debtAmount > 0) {
        await db.debtRecord.create({
          data: {
            tenantId: tenant.id,
            type: "RECEIVABLE",
            orderId: order.id,
            customerId: customer.id,
            amount: debtAmount,
            paidAmount: 0,
            dueDate,
            status: dueDate && dueDate.getTime() < Date.now() ? "OVERDUE" : "OPEN",
            description: `Chek ${number} bo'yicha nasiya`,
            createdAt,
          },
        });
        debtTotals.set(customer.id, (debtTotals.get(customer.id) ?? 0) + debtAmount);
      }
    }
  }

  // Mijoz qarzdorlik balanslarini yozuvlardan qayta hisoblash
  for (const customer of customers) {
    await db.customer.update({
      where: { id: customer.id },
      data: { debtBalance: debtTotals.get(customer.id) ?? 0 },
    });
  }

  // ── Yetkazib beruvchi qarzlari ───────────────────────────────────────────
  const supplierDebts: Array<{ supplierId: string; amount: number; note: string }> = [
    { supplierId: supplier1.id, amount: 4500000, note: "Oxirgi partiya uchun qarz" },
    { supplierId: supplier2.id, amount: 1800000, note: "Oziq-ovqat partiyasi" },
    { supplierId: supplier3.id, amount: 950000, note: "Maishiy kimyo partiyasi" },
  ];
  for (const debt of supplierDebts) {
    await db.debtRecord.create({
      data: {
        tenantId: tenant.id,
        type: "PAYABLE",
        supplierId: debt.supplierId,
        amount: debt.amount,
        paidAmount: 0,
        status: "OPEN",
        dueDate: addDays(new Date(), 10),
        description: debt.note,
      },
    });
    await db.supplier.update({
      where: { id: debt.supplierId },
      data: { balanceDebt: debt.amount },
    });
  }

  // ── Xarajat kategoriyalari va xarajatlar ─────────────────────────────────
  const expenseCategoryMap = new Map<string, string>();
  for (const cat of EXPENSE_CATEGORIES) {
    const created = await db.expenseCategory.create({
      data: { tenantId: tenant.id, code: cat.code, name: cat.name, isSystem: true },
    });
    expenseCategoryMap.set(cat.code, created.id);
  }

  const monthStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1, -5));
  const expenses = [
    { code: "RENT", amount: 6000000, description: "Markaziy do'kon ijarasi", day: 1 },
    { code: "SALARY", amount: 12500000, description: "Xodimlar oyligi (oktyabr)", day: 5 },
    { code: "UTILITIES", amount: 1250000, description: "Elektr va suv", day: 8 },
    { code: "TRANSPORT", amount: 850000, description: "Yetkazib berish transporti", day: 11 },
    { code: "TAX", amount: 2400000, description: "QQS avans to'lovi", day: 15 },
    { code: "SUPPLIES", amount: 420000, description: "Paket va chek qog'ozi", day: 18 },
    { code: "FOOD", amount: 350000, description: "Xodimlar tushligi", day: 20 },
  ];
  for (const exp of expenses) {
    await db.expense.create({
      data: {
        tenantId: tenant.id,
        storeId: shop1.id,
        categoryId: expenseCategoryMap.get(exp.code)!,
        amount: exp.amount,
        description: exp.description,
        date: addDays(monthStart, exp.day),
        createdById: users.admin.id,
      },
    });
  }

  // ── Kassa smenalari ──────────────────────────────────────────────────────
  await db.cashShift.create({
    data: {
      tenantId: tenant.id,
      storeId: shop1.id,
      userId: users.cashier.id,
      openingCash: 500000,
      status: "OPEN",
      note: "Ertalabki smena",
    },
  });

  for (let d = 1; d <= 5; d++) {
    const openedAt = addDays(today, -d);
    const openingCash = 500000;
    const cashSales = randInt(800000, 3500000);
    const closedAt = new Date(openedAt.getTime() + 10 * 3600_000);
    await db.cashShift.create({
      data: {
        tenantId: tenant.id,
        storeId: shop1.id,
        userId: users.cashier.id,
        openingCash,
        closingCash: openingCash + cashSales - 50000,
        expectedCash: openingCash + cashSales - 50000,
        difference: 0,
        status: "CLOSED",
        openedAt,
        closedAt,
      },
    });
  }

  // ── Audit jurnali ────────────────────────────────────────────────────────
  await db.auditLog.createMany({
    data: [
      {
        tenantId: tenant.id,
        userId: users.admin.id,
        action: "LOGIN",
        entityType: "User",
        entityId: users.admin.id,
        ip: "127.0.0.1",
        userAgent: "Seed",
        createdAt: new Date(Date.now() - 3600_000),
      },
      {
        tenantId: tenant.id,
        userId: users.admin.id,
        action: "PRICE_CHANGE",
        entityType: "ProductVariant",
        entityId: saleable[0]!.id,
        before: { sellingPrice: 12000 },
        after: { sellingPrice: 12500 },
        createdAt: new Date(Date.now() - 7200_000),
      },
      {
        tenantId: tenant.id,
        userId: users.warehouse.id,
        action: "STOCK_RECEIVE",
        entityType: "Warehouse",
        entityId: mainWarehouse.id,
        after: { items: saleable.length, note: "Demo boshlang'ich qoldiq" },
        createdAt: new Date(Date.now() - 86_400_000),
      },
    ],
  });

  // ── Yakuniy hisobot ──────────────────────────────────────────────────────
  const [orderCount, customerCount, variantCount, debtSum] = await Promise.all([
    db.order.count({ where: { tenantId: tenant.id } }),
    db.customer.count({ where: { tenantId: tenant.id } }),
    db.productVariant.count({ where: { tenantId: tenant.id } }),
    db.debtRecord.aggregate({
      where: { tenantId: tenant.id, type: "RECEIVABLE", status: { in: ["OPEN", "OVERDUE", "PARTIAL"] } },
      _sum: { amount: true },
    }),
  ]);

  console.log("\n✅ Seed tugadi");
  console.log(`   Tenant:      ${tenant.name} (${TENANT_SLUG})`);
  console.log(`   Filiallar:   2 ta, omborlar: 3 ta`);
  console.log(`   Tovarlar:    ${PRODUCTS.length} ta, variantlar: ${variantCount} ta`);
  console.log(`   Savdolar:    ${orderCount} ta chek`);
  console.log(`   Mijozlar:    ${customerCount} ta, qarz: ${Number(debtSum._sum.amount ?? 0).toLocaleString("uz-UZ")} so'm`);
  console.log("\n🔑 Demo hisoblar (parol: demo1234):");
  console.log("   Super admin : +998901234567");
  console.log("   Menejer     : +998901112233");
  console.log("   Kassir      : +998902223344");
  console.log("   Omborchi    : +998903334455");
  console.log("   Buxgalter   : +998904445566");
  console.log(`   Biznes kodi : ${TENANT_SLUG}\n`);
}

main()
  .catch((error) => {
    console.error("❌ Seed xatosi:", error);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
