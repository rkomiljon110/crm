/**
 * Demo matritsasi tekshiruvi — haqiqiy HTTP + haqiqiy PostgreSQL.
 *
 *   npm run verify:demo
 *
 * Oldindan `npm run db:seed` va `npm run dev` (3000) ishlab turishi kerak.
 *
 * Qamrov:
 *   - 5 demo rol: login, ruxsatlar, sahifa va API chegaralari
 *   - POS bootstrap: smena, ombor, katalog, shtrix-kod/nom qidiruvi
 *   - 7 to'lov usuli + split payment + nasiya
 *   - X/Z hisobot va kassa farqi
 *   - 401/403/404/409/422 xatolari va CSRF
 *   - OpenAPI 3.1 va /api-docs interfeysi
 */
import { randomUUID } from "node:crypto";
import { Client } from "pg";

const BASE = process.env.VERIFY_BASE_URL ?? "http://127.0.0.1:3000";
const PASSWORD = "demo1234";
const TENANT_SLUG = "baraka";

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL topilmadi. `node --env-file=.env scripts/verify-demo.mjs` bilan ishga tushiring.");
  process.exit(1);
}

const db = new Client({ connectionString: process.env.DATABASE_URL });
await db.connect();

let passed = 0;
let failed = 0;
const failures = [];

function check(name, condition, detail = "") {
  if (condition) {
    passed += 1;
    console.log(`  ✅ ${name}`);
  } else {
    failed += 1;
    failures.push(`${name}${detail ? ` — ${detail}` : ""}`);
    console.log(`  ❌ ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

function round2(value) {
  return Math.round(Number(value) * 100) / 100;
}

function closeTo(actual, expected, tolerance = 0.01) {
  return Math.abs(Number(actual) - Number(expected)) <= tolerance;
}

async function waitForServer() {
  for (let attempt = 0; attempt < 120; attempt += 1) {
    try {
      const response = await fetch(`${BASE}/api/health`);
      if (response.ok) return true;
    } catch {
      // hali ko'tarilmagan
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  return false;
}

async function http(path, { method = "GET", body, cookie, headers = {}, origin = BASE, redirect = "manual" } = {}) {
  const response = await fetch(`${BASE}${path}`, {
    method,
    redirect,
    cache: "no-store",
    headers: {
      origin,
      ...(body ? { "content-type": "application/json" } : {}),
      ...(cookie ? { cookie } : {}),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const raw = await response.text();
  let data = null;
  try {
    data = raw ? JSON.parse(raw) : null;
  } catch {
    data = { raw: raw.slice(0, 500) };
  }

  return {
    status: response.status,
    data,
    raw,
    location: response.headers.get("location"),
    headers: response.headers,
  };
}

async function login(phone) {
  const response = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: BASE },
    body: JSON.stringify({ tenantSlug: TENANT_SLUG, phone, password: PASSWORD }),
  });
  const raw = await response.text();
  if (!response.ok) throw new Error(`Login xatosi (${phone}): ${response.status} ${raw}`);
  const cookies = response.headers.getSetCookie?.() ?? [response.headers.get("set-cookie") ?? ""];
  const cookie = cookies.map((value) => value.split(";")[0]).find((value) => value.startsWith("savdo_session="));
  if (!cookie) throw new Error("Sessiya cookie topilmadi.");
  return { cookie, data: JSON.parse(raw) };
}

async function q(sql, params = []) {
  const result = await db.query(sql, params);
  return result.rows;
}

async function setStock(warehouseId, variantId, quantity) {
  await db.query(
    'UPDATE "Inventory" SET quantity = $3, "updatedAt" = now() WHERE "warehouseId" = $1 AND "variantId" = $2',
    [warehouseId, variantId, quantity],
  );
}

async function getStock(warehouseId, variantId) {
  const rows = await q(
    'SELECT quantity::float8 AS quantity FROM "Inventory" WHERE "warehouseId" = $1 AND "variantId" = $2',
    [warehouseId, variantId],
  );
  return rows[0]?.quantity ?? 0;
}

const expected = { count: 0, cash: 0, card: 0, transfer: 0, other: 0, debt: 0, sales: 0 };

function recordSale({ cash = 0, card = 0, transfer = 0, other = 0, debt = 0, total }) {
  expected.count += 1;
  expected.cash = round2(expected.cash + cash);
  expected.card = round2(expected.card + card);
  expected.transfer = round2(expected.transfer + transfer);
  expected.other = round2(expected.other + other);
  expected.debt = round2(expected.debt + debt);
  expected.sales = round2(expected.sales + total);
}

function makeOrder({ warehouseId, product, quantity = 1, payments, customerId = null, note, discountAmount = 0, items }) {
  return {
    warehouseId,
    customerId,
    items:
      items ??
      [
        {
          variantId: product.variantId,
          quantity,
          unitPrice: product.price,
          discountAmount: 0,
        },
      ],
    discountAmount,
    taxAmount: 0,
    payments,
    note,
  };
}

try {
  if (!(await waitForServer())) {
    throw new Error(`${BASE} javob bermayapti. Avval \`npm run dev\` ni ishga tushiring.`);
  }

  console.log("\n🔧 Demo muhiti tayyorlanmoqda...");
  const [tenant] = await q('SELECT id FROM "Tenant" WHERE slug = $1', [TENANT_SLUG]);
  const [shop] = await q('SELECT id, code FROM "Store" WHERE "tenantId" = $1 AND code = $2', [
    tenant.id,
    "SHOP-1",
  ]);
  const [warehouse] = await q('SELECT id FROM "Warehouse" WHERE "tenantId" = $1 AND code = $2', [
    tenant.id,
    "SHOP-1",
  ]);
  const users = await q(
    `SELECT u.id, u.phone, r.code AS "roleCode"
     FROM "User" u JOIN "Role" r ON r.id = u."roleId"
     WHERE u."tenantId" = $1 ORDER BY r.code`,
    [tenant.id],
  );
  const userByRole = new Map(users.map((user) => [user.roleCode, user]));
  const [debtCustomer] = await q(
    'SELECT id, name FROM "Customer" WHERE "tenantId" = $1 ORDER BY "maxDebtLimit" DESC LIMIT 1',
    [tenant.id],
  );

  if (!tenant || !shop || !warehouse || !debtCustomer || userByRole.size < 5) {
    throw new Error("Seed ma'lumotlari to'liq emas. `npm run db:seed` bajaring.");
  }

  await db.query(
    'UPDATE "CashShift" SET status = \'CLOSED\', "closedAt" = now() WHERE "tenantId" = $1 AND "userId" = ANY($2::text[]) AND status = \'OPEN\'',
    [tenant.id, [userByRole.get("CASHIER").id, userByRole.get("BRANCH_MANAGER").id]],
  );
  await db.query(
    'UPDATE "Customer" SET "debtBalance" = 0, "maxDebtLimit" = 10000000, "isBlocked" = false WHERE id = $1',
    [debtCustomer.id],
  );

  const cashierLogin = await login(userByRole.get("CASHIER").phone);
  const cashierCookie = cashierLogin.cookie;

  // ── 1. Demo rollari ─────────────────────────────────────────────────────
  console.log("\n1) Demo rollari va ruxsatlar");
  const sessions = {};
  for (const role of ["SUPER_ADMIN", "BRANCH_MANAGER", "CASHIER", "WAREHOUSE", "ACCOUNTANT"]) {
    const user = userByRole.get(role);
    const session = await login(user.phone);
    const me = await http("/api/auth/me", { cookie: session.cookie });
    sessions[role] = { ...session, user: me.data?.user };
    check(
      `${role}: login va /me`,
      me.status === 200 && me.data?.user?.roleCode === role,
      JSON.stringify(me.data),
    );
  }
  check(
    "Kassir shifts.manage va pos.use ruxsatlariga ega",
    sessions.CASHIER.user?.roleCode === "CASHIER" &&
      ["shifts.manage", "pos.use", "sales.create"].every((permission) =>
        sessions.CASHIER.user?.permissions?.includes(permission),
      ),
  );

  const adminDashboard = await http("/dashboard", { cookie: sessions.SUPER_ADMIN.cookie });
  const adminFinance = await http("/finance", { cookie: sessions.SUPER_ADMIN.cookie });
  const adminDocs = await http("/api-docs", { cookie: sessions.SUPER_ADMIN.cookie });
  check("Admin /dashboard → 200", adminDashboard.status === 200);
  check("Admin /finance → 200", adminFinance.status === 200);
  check(
    "Admin /api-docs → 200 va interfeys render bo'ldi",
    adminDocs.status === 200 && adminDocs.raw.includes("API interfeysi"),
  );

  const cashierDashboard = await http("/dashboard", { cookie: cashierCookie });
  const cashierDocs = await http("/api-docs", { cookie: cashierCookie });
  check(
    "Kassir /dashboard → /403",
    [307, 302].includes(cashierDashboard.status) && String(cashierDashboard.location).includes("/403"),
    `${cashierDashboard.status} ${cashierDashboard.location}`,
  );
  check("Kassir /api-docs → 200", cashierDocs.status === 200);

  const accountantFinance = await http("/finance", { cookie: sessions.ACCOUNTANT.cookie });
  const warehouseDashboard = await http("/dashboard", { cookie: sessions.WAREHOUSE.cookie });
  check("Buxgalter /finance → 200", accountantFinance.status === 200);
  check(
    "Omborchi /dashboard → /403",
    [307, 302].includes(warehouseDashboard.status) &&
      String(warehouseDashboard.location).includes("/403"),
  );

  const unauthDocs = await http("/api-docs");
  check(
    "Avtorizatsiyasiz /api-docs → /login",
    [307, 302].includes(unauthDocs.status) && String(unauthDocs.location).includes("/login"),
    `${unauthDocs.status} ${unauthDocs.location}`,
  );

  const warehouseOrder = await http("/api/v1/orders", {
    method: "POST",
    cookie: sessions.WAREHOUSE.cookie,
    body: { warehouseId: warehouse.id, items: [] },
  });
  const accountantOrder = await http("/api/v1/orders", {
    method: "POST",
    cookie: sessions.ACCOUNTANT.cookie,
    body: { warehouseId: warehouse.id, items: [] },
  });
  const accountantBootstrap = await http("/api/v1/pos/bootstrap", {
    cookie: sessions.ACCOUNTANT.cookie,
  });
  check("Omborchi savdo yarata olmaydi → 403", warehouseOrder.status === 403, JSON.stringify(warehouseOrder.data));
  check("Buxgalter savdo yarata olmaydi → 403", accountantOrder.status === 403, JSON.stringify(accountantOrder.data));
  check("Buxgalter POS bootstrap olmaydi → 403", accountantBootstrap.status === 403);

  // ── 2. Smena va POS bootstrap ───────────────────────────────────────────
  console.log("\n2) Smena va POS bootstrap");
  const openShift = await http("/api/v1/shifts/open", {
    method: "POST",
    cookie: cashierCookie,
    body: { storeId: shop.id, openingCash: 500000, note: "verify-demo" },
  });
  check("Kassir smena ochdi", openShift.status === 201 && openShift.data?.shift?.status === "OPEN", JSON.stringify(openShift.data));
  const shiftId = openShift.data?.shift?.id;
  if (!shiftId) throw new Error("Smena ID olinmadi.");

  const bootstrap = await http("/api/v1/pos/bootstrap", { cookie: cashierCookie });
  check("POS bootstrap → 200", bootstrap.status === 200, JSON.stringify(bootstrap.data));
  check(
    "Bootstrap smena, ombor, katalog va mijozlarni qaytardi",
    !!bootstrap.data?.shift?.id &&
      !!bootstrap.data?.selectedWarehouseId &&
      bootstrap.data?.products?.length > 0 &&
      bootstrap.data?.customers?.length > 0,
  );
  check(
    "Bootstrap tannarxni oshkor qilmaydi",
    !bootstrap.raw.includes("costPrice") && !bootstrap.raw.includes("unitCost"),
  );
  check(
    "Bootstrap 8 ta to'lov usulini qaytardi",
    bootstrap.data?.paymentMethods?.length === 8,
    JSON.stringify(bootstrap.data?.paymentMethods),
  );

  const product = bootstrap.data.products.find((item) => item.price > 0);
  const secondProduct = bootstrap.data.products.find(
    (item) => item.variantId !== product?.variantId && item.price > 0,
  );
  if (!product || !secondProduct) throw new Error("Test uchun ikki tovar kerak.");
  await setStock(bootstrap.data.selectedWarehouseId, product.variantId, 200);
  await setStock(bootstrap.data.selectedWarehouseId, secondProduct.variantId, 1);

  const barcodeSearch = product.barcode
    ? await http(`/api/v1/pos/bootstrap?q=${encodeURIComponent(product.barcode)}`, {
        cookie: cashierCookie,
      })
    : null;
  const nameSearch = await http(`/api/v1/pos/bootstrap?q=${encodeURIComponent(product.name.slice(0, 8))}`, {
    cookie: cashierCookie,
  });
  check(
    "Shtrix-kod bo'yicha qidiruv bitta tovarni topdi",
    barcodeSearch
      ? barcodeSearch.status === 200 &&
          barcodeSearch.data.products.length === 1 &&
          barcodeSearch.data.products[0].variantId === product.variantId
      : true,
  );
  check(
    "Nom bo'yicha qidiruv natija qaytardi",
    nameSearch.status === 200 && nameSearch.data.products.some((item) => item.variantId === product.variantId),
  );

  const badWarehouse = await http("/api/v1/pos/bootstrap?warehouseId=nonexistent123", {
    cookie: cashierCookie,
  });
  check(
    "Noto'g'ri ombor → 404 WAREHOUSE_NOT_FOUND",
    badWarehouse.status === 404 && badWarehouse.data?.code === "WAREHOUSE_NOT_FOUND",
    JSON.stringify(badWarehouse.data),
  );
  const longQuery = await http(`/api/v1/pos/bootstrap?q=${"a".repeat(101)}`, { cookie: cashierCookie });
  check("100 belgidan uzun qidiruv → 422", longQuery.status === 422);

  // ── 3. Barcha to'lov usullari ───────────────────────────────────────────
  console.log("\n3) To'lov usullari");
  const methods = ["CASH", "CARD", "TRANSFER", "CLICK", "PAYME", "UZUM", "OTHER"];
  for (const method of methods) {
    const response = await http("/api/v1/orders", {
      method: "POST",
      cookie: cashierCookie,
      headers: { "idempotency-key": randomUUID() },
      body: makeOrder({
        warehouseId: bootstrap.data.selectedWarehouseId,
        product,
        payments: [{ method, amount: product.price }],
        note: `verify-demo-${method}`,
      }),
    });
    check(
      `${method}: chek yaratildi va PaymentTransaction yozildi`,
      response.status === 201 &&
        response.data?.order?.payments?.length === 1 &&
        response.data?.order?.payments?.[0]?.method === method,
      JSON.stringify(response.data),
    );
    if (method === "CASH") recordSale({ cash: product.price, total: product.price });
    if (method === "CARD") recordSale({ card: product.price, total: product.price });
    if (method === "TRANSFER") recordSale({ transfer: product.price, total: product.price });
    if (["CLICK", "PAYME", "UZUM", "OTHER"].includes(method)) {
      recordSale({ other: product.price, total: product.price });
    }
  }

  const splitCash = Math.floor(product.price / 2);
  const splitCard = round2(product.price - splitCash);
  const splitResponse = await http("/api/v1/orders", {
    method: "POST",
    cookie: cashierCookie,
    headers: { "idempotency-key": randomUUID() },
    body: makeOrder({
      warehouseId: bootstrap.data.selectedWarehouseId,
      product,
      payments: [
        { method: "CASH", amount: splitCash },
        { method: "CARD", amount: splitCard },
      ],
      note: "verify-demo-SPLIT",
    }),
  });
  check(
    "Split payment 2 ta tranzaksiya bilan yozildi",
    splitResponse.status === 201 && splitResponse.data?.order?.payments?.length === 2,
    JSON.stringify(splitResponse.data),
  );
  recordSale({ cash: splitCash, card: splitCard, total: product.price });

  const customerBefore = await q(
    'SELECT "debtBalance"::float8 AS balance FROM "Customer" WHERE id = $1',
    [debtCustomer.id],
  );
  const debtResponse = await http("/api/v1/orders", {
    method: "POST",
    cookie: cashierCookie,
    headers: { "idempotency-key": randomUUID() },
    body: makeOrder({
      warehouseId: bootstrap.data.selectedWarehouseId,
      product,
      customerId: debtCustomer.id,
      payments: [{ method: "DEBT", amount: product.price }],
      note: "verify-demo-DEBT",
    }),
  });
  check(
    "DEBT: nasiya cheki va DebtRecord yaratildi",
    debtResponse.status === 201 &&
      closeTo(debtResponse.data?.order?.debtAmount, product.price) &&
      debtResponse.data?.order?.payments?.length === 0 &&
      debtResponse.data?.order?.paymentStatus === "UNPAID",
    JSON.stringify(debtResponse.data?.order),
  );
  const debtRows = debtResponse.data?.order?.id
    ? await q('SELECT amount::float8 AS amount FROM "DebtRecord" WHERE "orderId" = $1', [
        debtResponse.data.order.id,
      ])
    : [];
  const customerAfter = await q(
    'SELECT "debtBalance"::float8 AS balance FROM "Customer" WHERE id = $1',
    [debtCustomer.id],
  );
  check("DEBT: DebtRecord summasi to'g'ri", debtRows.length === 1 && closeTo(debtRows[0].amount, product.price));
  check(
    "DEBT: mijoz balansi oshdi",
    closeTo(customerAfter[0].balance, customerBefore[0].balance + product.price),
  );
  recordSale({ debt: product.price, total: product.price });

  // ── 4. Xato yo'llari va xavfsizlik ───────────────────────────────────────
  console.log("\n4) Xatolar va xavfsizlik");
  const mismatch = await http("/api/v1/orders", {
    method: "POST",
    cookie: cashierCookie,
    headers: { "idempotency-key": randomUUID() },
    body: makeOrder({
      warehouseId: bootstrap.data.selectedWarehouseId,
      product,
      payments: [{ method: "CASH", amount: product.price - 1000 }],
      note: "verify-demo-mismatch",
    }),
  });
  check(
    "To'lov summasi mos emas → 422 PAYMENT_MISMATCH",
    mismatch.status === 422 && mismatch.data?.code === "PAYMENT_MISMATCH",
    JSON.stringify(mismatch.data),
  );

  const discount = await http("/api/v1/orders", {
    method: "POST",
    cookie: cashierCookie,
    headers: { "idempotency-key": randomUUID() },
    body: makeOrder({
      warehouseId: bootstrap.data.selectedWarehouseId,
      product,
      discountAmount: 1000,
      payments: [{ method: "CASH", amount: product.price - 1000 }],
      note: "verify-demo-discount",
    }),
  });
  check(
    "Kassir chegirma bera olmaydi → 403 DISCOUNT_FORBIDDEN",
    discount.status === 403 && discount.data?.code === "DISCOUNT_FORBIDDEN",
    JSON.stringify(discount.data),
  );

  const duplicate = await http("/api/v1/orders", {
    method: "POST",
    cookie: cashierCookie,
    headers: { "idempotency-key": randomUUID() },
    body: makeOrder({
      warehouseId: bootstrap.data.selectedWarehouseId,
      product,
      items: [
        { variantId: product.variantId, quantity: 1, unitPrice: product.price, discountAmount: 0 },
        { variantId: product.variantId, quantity: 1, unitPrice: product.price, discountAmount: 0 },
      ],
      payments: [{ method: "CASH", amount: product.price * 2 }],
      note: "verify-demo-duplicate",
    }),
  });
  check(
    "Takroriy tovar → 422 DUPLICATE_ITEM",
    duplicate.status === 422 && duplicate.data?.code === "DUPLICATE_ITEM",
    JSON.stringify(duplicate.data),
  );

  const lowStockBefore = await getStock(bootstrap.data.selectedWarehouseId, secondProduct.variantId);
  const insufficient = await http("/api/v1/orders", {
    method: "POST",
    cookie: cashierCookie,
    headers: { "idempotency-key": randomUUID() },
    body: makeOrder({
      warehouseId: bootstrap.data.selectedWarehouseId,
      product: secondProduct,
      quantity: 2,
      payments: [{ method: "CASH", amount: secondProduct.price * 2 }],
      note: "verify-demo-stock",
    }),
  });
  const lowStockAfter = await getStock(bootstrap.data.selectedWarehouseId, secondProduct.variantId);
  check(
    "Qoldiq yetmadi → 409 INSUFFICIENT_STOCK",
    insufficient.status === 409 && insufficient.data?.code === "INSUFFICIENT_STOCK",
    JSON.stringify(insufficient.data),
  );
  check("Qoldiq rad etilganda o'zgarmadi", closeTo(lowStockAfter, lowStockBefore));

  const wrongOrigin = await http("/api/v1/orders", {
    method: "POST",
    cookie: cashierCookie,
    origin: "http://evil.example",
    body: makeOrder({
      warehouseId: bootstrap.data.selectedWarehouseId,
      product,
      payments: [{ method: "CASH", amount: product.price }],
      note: "verify-demo-origin",
    }),
  });
  check("Begona Origin → 403", wrongOrigin.status === 403);

  const unauthOrder = await http("/api/v1/orders", {
    method: "POST",
    body: makeOrder({
      warehouseId: bootstrap.data.selectedWarehouseId,
      product,
      payments: [{ method: "CASH", amount: product.price }],
    }),
  });
  check("Avtorizatsiyasiz savdo → 401", unauthOrder.status === 401);

  // ── 5. Menejer smenasi ──────────────────────────────────────────────────
  console.log("\n5) Menejer smenasi va sotuvi");
  const managerCookie = sessions.BRANCH_MANAGER.cookie;
  const managerOpen = await http("/api/v1/shifts/open", {
    method: "POST",
    cookie: managerCookie,
    body: { storeId: shop.id, openingCash: 200000, note: "verify-demo-manager" },
  });
  check("Menejer o'z smenasini ochdi", managerOpen.status === 201, JSON.stringify(managerOpen.data));
  const managerShiftId = managerOpen.data?.shift?.id;

  const managerBootstrap = await http("/api/v1/pos/bootstrap", { cookie: managerCookie });
  check("Menejer POS bootstrap oldi", managerBootstrap.status === 200 && !!managerBootstrap.data?.shift);

  const managerSale = await http("/api/v1/orders", {
    method: "POST",
    cookie: managerCookie,
    headers: { "idempotency-key": randomUUID() },
    body: makeOrder({
      warehouseId: managerBootstrap.data.selectedWarehouseId,
      product,
      payments: [{ method: "CARD", amount: product.price }],
      note: "verify-demo-manager-sale",
    }),
  });
  check("Menejer karta savdosini yaratdi", managerSale.status === 201, JSON.stringify(managerSale.data));

  const managerCurrent = await http("/api/v1/shifts/current", { cookie: managerCookie });
  check(
    "Menejer X-hisoboti 1 chek va karta tushumini ko'rsatdi",
    managerCurrent.data?.shift?.salesCount === 1 &&
      closeTo(managerCurrent.data?.shift?.totals?.card, product.price),
    JSON.stringify(managerCurrent.data?.shift?.totals),
  );

  const managerClose = await http("/api/v1/shifts/close", {
    method: "POST",
    cookie: managerCookie,
    body: { shiftId: managerShiftId, closingCash: 200000, note: "verify-demo-manager-close" },
  });
  check(
    "Menejer smenasini yopdi, farq 0",
    managerClose.status === 200 &&
      managerClose.data?.shift?.status === "CLOSED" &&
      closeTo(managerClose.data?.shift?.difference, 0),
    JSON.stringify(managerClose.data?.shift),
  );

  // ── 6. Kassir X/Z hisoboti ──────────────────────────────────────────────
  console.log("\n6) Kassir X/Z hisoboti");
  const current = await http("/api/v1/shifts/current", { cookie: cashierCookie });
  const totals = current.data?.shift?.totals;
  check(
    "X-hisobot: cheklar soni",
    current.data?.shift?.salesCount === expected.count,
    `${current.data?.shift?.salesCount} != ${expected.count}`,
  );
  check("X-hisobot: naqd", closeTo(totals?.cash, expected.cash), `${totals?.cash} != ${expected.cash}`);
  check("X-hisobot: karta", closeTo(totals?.card, expected.card), `${totals?.card} != ${expected.card}`);
  check("X-hisobot: o'tkazma", closeTo(totals?.transfer, expected.transfer), `${totals?.transfer} != ${expected.transfer}`);
  check("X-hisobot: boshqa usullar", closeTo(totals?.other, expected.other), `${totals?.other} != ${expected.other}`);
  check("X-hisobot: nasiya", closeTo(totals?.debt, expected.debt), `${totals?.debt} != ${expected.debt}`);
  check("X-hisobot: jami savdo", closeTo(totals?.sales, expected.sales), `${totals?.sales} != ${expected.sales}`);
  const expectedCash = round2(500000 + expected.cash);
  check("X-hisobot: kutilgan naqd", closeTo(current.data?.shift?.expectedCash, expectedCash));

  const difference = -5000;
  const close = await http("/api/v1/shifts/close", {
    method: "POST",
    cookie: cashierCookie,
    body: { shiftId, closingCash: round2(expectedCash + difference), note: "verify-demo-close" },
  });
  check(
    "Kassir smenasini yopdi, farq -5000",
    close.status === 200 &&
      close.data?.shift?.status === "CLOSED" &&
      closeTo(close.data?.shift?.difference, difference),
    JSON.stringify(close.data?.shift),
  );
  const shiftRows = await q(
    `SELECT status, "salesCount", "totalCash"::float8 AS cash, "totalCard"::float8 AS card,
            "totalTransfer"::float8 AS transfer, "totalOther"::float8 AS other,
            "totalDebt"::float8 AS debt, "expectedCash"::float8 AS expected, "difference"::float8 AS difference
     FROM "CashShift" WHERE id = $1`,
    [shiftId],
  );
  const shiftRow = shiftRows[0];
  check(
    "Z-hisobot DBda to'liq saqlandi",
    shiftRow.status === "CLOSED" &&
      shiftRow.salesCount === expected.count &&
      closeTo(shiftRow.cash, expected.cash) &&
      closeTo(shiftRow.card, expected.card) &&
      closeTo(shiftRow.transfer, expected.transfer) &&
      closeTo(shiftRow.other, expected.other) &&
      closeTo(shiftRow.debt, expected.debt) &&
      closeTo(shiftRow.expected, expectedCash) &&
      closeTo(shiftRow.difference, difference),
    JSON.stringify(shiftRow),
  );

  const closedCurrent = await http("/api/v1/shifts/current", { cookie: cashierCookie });
  check("Yopilgandan keyin joriy smena null", closedCurrent.status === 200 && closedCurrent.data?.shift === null);
  const blockedSale = await http("/api/v1/orders", {
    method: "POST",
    cookie: cashierCookie,
    headers: { "idempotency-key": randomUUID() },
    body: makeOrder({
      warehouseId: bootstrap.data.selectedWarehouseId,
      product,
      payments: [{ method: "CASH", amount: product.price }],
      note: "verify-demo-after-close",
    }),
  });
  check(
    "Yopilgan smenada chek → 400 SHIFT_REQUIRED",
    blockedSale.status === 400 && blockedSale.data?.code === "SHIFT_REQUIRED",
    JSON.stringify(blockedSale.data),
  );

  // ── 7. OpenAPI va API interfeysi ────────────────────────────────────────
  console.log("\n7) OpenAPI va API interfeysi");
  const spec = await http("/api/openapi");
  check("OpenAPI JSON → 200, 3.1.0", spec.status === 200 && spec.data?.openapi === "3.1.0");
  check(
    "OpenAPI barcha asosiy pathlarni o'z ichiga oladi",
    ["/api/v1/pos/bootstrap", "/api/v1/orders", "/api/v1/sync/orders", "/api/v1/shifts/open", "/api/v1/shifts/current", "/api/v1/shifts/close"].every(
      (path) => Object.hasOwn(spec.data?.paths ?? {}, path),
    ),
    JSON.stringify(Object.keys(spec.data?.paths ?? {})),
  );
  check(
    "OpenAPI login va health pathlari ham bor",
    Object.hasOwn(spec.data?.paths ?? {}, "/api/auth/login") &&
      Object.hasOwn(spec.data?.paths ?? {}, "/api/health"),
  );
} catch (error) {
  failed += 1;
  failures.push(String(error?.stack ?? error));
  console.error("\n❌ Tekshiruv to'xtadi:", error);
} finally {
  await db.end();
}

console.log(`\n${failed === 0 ? "✅" : "❌"} Natija: ${passed} ta o'tdi, ${failed} ta xato.`);
if (failures.length > 0) {
  console.error("\nXatolar:");
  for (const failure of failures) console.error(` - ${failure}`);
  process.exit(1);
}
