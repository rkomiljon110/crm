/**
 * 3-bosqich tekshiruvi — haqiqiy HTTP + haqiqiy PostgreSQL.
 *
 *   npm run verify:sales
 *
 * Oldindan: `npm run db:seed` va `npm run dev` (3000-port) ishlab turishi kerak.
 *
 * Tekshiriladi:
 *   1. Idempotentlik — bir xil clientOrderId ikkinchi chek yaratmaydi, qoldiq
 *      ikkinchi marta kamaymaydi.
 *   2. Concurrent stock — 8 parallel sotuvdan faqat qoldiq yetgani o'tadi,
 *      qoldiq manfiyga tushmaydi.
 *   3. Smena to'sig'i — smenasiz/yopilgan smenada chek rad etiladi.
 *   4. Smena yopilishi — naqd/karta/o'tkazma/qarz yig'indisi va kassa farqi.
 *   5. Nasiya — DebtRecord, mijoz balansi, kredit limiti va bloklash.
 *   6. Batch partial success — processed / skipped_duplicate / failed.
 */
import { randomUUID } from "node:crypto";
import { Client } from "pg";

const BASE = process.env.VERIFY_BASE_URL ?? "http://127.0.0.1:3000";
const PASSWORD = "demo1234";
const TENANT_SLUG = "baraka";
const DEVICE = "verify-pos-01";

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL topilmadi. `node --env-file=.env scripts/verify-sales.mjs` bilan ishga tushiring.");
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

function closeTo(actual, expected, tolerance = 0.01) {
  return Math.abs(Number(actual) - Number(expected)) <= tolerance;
}

function round2(value) {
  return Math.round(Number(value) * 100) / 100;
}

async function waitForServer() {
  for (let attempt = 0; attempt < 120; attempt += 1) {
    try {
      const response = await fetch(`${BASE}/api/health`);
      if (response.ok) return true;
    } catch {
      // server hali ko'tarilmagan
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  return false;
}

async function http(path, { method = "GET", body, headers = {}, cookie } = {}) {
  const response = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      origin: BASE,
      ...(body ? { "content-type": "application/json" } : {}),
      ...(cookie ? { cookie } : {}),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text.slice(0, 300) };
  }

  return { status: response.status, data, headers: response.headers };
}

async function login(phone) {
  const response = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: BASE },
    body: JSON.stringify({ tenantSlug: TENANT_SLUG, phone, password: PASSWORD }),
  });
  if (!response.ok) {
    throw new Error(`Login xatosi (${phone}): ${response.status} ${await response.text()}`);
  }
  const cookies = response.headers.getSetCookie?.() ?? [response.headers.get("set-cookie") ?? ""];
  const session = cookies.map((value) => value.split(";")[0]).find((value) => value.startsWith("savdo_session="));
  if (!session) throw new Error("Login javobida sessiya cookie topilmadi.");
  return session;
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

function baseOrder({ variant, quantity = 1, payments, customerId = null, note }) {
  return {
    warehouseId: state.warehouse.id,
    customerId,
    items: [{ variantId: variant.variantId, quantity, unitPrice: variant.price }],
    discountAmount: 0,
    taxAmount: 0,
    payments,
    note,
  };
}

function offlineOrder({ variant, quantity = 1, payments, customerId = null, note }) {
  return {
    ...baseOrder({ variant, quantity, payments, customerId, note }),
    clientOrderId: randomUUID(),
    clientCreatedAt: new Date().toISOString(),
  };
}

function sync(orders, cookie) {
  return http("/api/v1/sync/orders", {
    method: "POST",
    body: { deviceId: DEVICE, orders },
    cookie,
  });
}

const state = {};
const expected = { count: 0, cash: 0, card: 0, debt: 0, sales: 0 };

function recordSale({ cash = 0, card = 0, debt = 0, total }) {
  expected.count += 1;
  expected.cash = round2(expected.cash + cash);
  expected.card = round2(expected.card + card);
  expected.debt = round2(expected.debt + debt);
  expected.sales = round2(expected.sales + total);
}

try {
  if (!(await waitForServer())) {
    throw new Error(`${BASE} javob bermayapti. Avval \`npm run dev\` ni ishga tushiring.`);
  }

  console.log("\n🔧 Test muhiti tayyorlanmoqda...");
  const [tenant] = await q('SELECT id FROM "Tenant" WHERE slug = $1', [TENANT_SLUG]);
  const [admin] = await q('SELECT id FROM "User" WHERE "tenantId" = $1 AND phone = $2', [
    tenant.id,
    "+998901234567",
  ]);
  const [shop] = await q('SELECT id, code FROM "Store" WHERE "tenantId" = $1 AND code = $2', [
    tenant.id,
    "SHOP-1",
  ]);
  const [warehouse] = await q('SELECT id FROM "Warehouse" WHERE "tenantId" = $1 AND code = $2', [
    tenant.id,
    "SHOP-1",
  ]);
  if (!tenant || !admin || !shop || !warehouse) {
    throw new Error("Seed ma'lumotlari topilmadi. `npm run db:seed` bajaring.");
  }
  state.warehouse = warehouse;

  const variants = await q(
    `SELECT v.id AS "variantId", v."sellingPrice"::float8 AS price, p.name
     FROM "ProductVariant" v
     JOIN "Product" p ON p.id = v."productId"
     JOIN "Inventory" i ON i."variantId" = v.id
     WHERE i."warehouseId" = $1 AND v."isActive" = true
     ORDER BY v."sellingPrice" DESC`,
    [warehouse.id],
  );
  const splitVariant = variants[0];
  const concurrencyVariant = variants[1];
  const idemVariant = variants[2];
  const debtVariant = variants[variants.length - 1];
  if (!splitVariant || !concurrencyVariant || !idemVariant || !debtVariant) {
    throw new Error("Test uchun tovar variantlari yetarli emas.");
  }

  const customers = await q(
    'SELECT id, name FROM "Customer" WHERE "tenantId" = $1 ORDER BY "maxDebtLimit" DESC LIMIT 2',
    [tenant.id],
  );
  if (customers.length < 2) throw new Error("Test uchun kamida 2 mijoz kerak.");
  const debtCustomer = customers[0];
  const lowLimitCustomer = customers[1];

  // Toza va deterministik holat
  await db.query(
    'UPDATE "CashShift" SET status = \'CLOSED\', "closedAt" = now() WHERE "tenantId" = $1 AND "userId" = $2 AND status = \'OPEN\'',
    [tenant.id, admin.id],
  );
  await setStock(warehouse.id, idemVariant.variantId, 10);
  await setStock(warehouse.id, concurrencyVariant.variantId, 5);
  await setStock(warehouse.id, splitVariant.variantId, 20);
  await setStock(warehouse.id, debtVariant.variantId, 20);
  await db.query(
    'UPDATE "Customer" SET "debtBalance" = 0, "maxDebtLimit" = 10000000, "isBlocked" = false WHERE id = $1',
    [debtCustomer.id],
  );
  await db.query(
    'UPDATE "Customer" SET "debtBalance" = 0, "maxDebtLimit" = $2, "isBlocked" = false WHERE id = $1',
    [lowLimitCustomer.id, Math.max(100, Math.floor(debtVariant.price / 2))],
  );

  const cookie = await login("+998901234567");
  console.log("  Admin sessiyasi olindi.\n");

  // ── 1. Smena ochish ─────────────────────────────────────────────────────
  console.log("1) Kassa smenasi");
  const openingCash = 100000;
  const open = await http("/api/v1/shifts/open", {
    method: "POST",
    body: { storeId: shop.id, openingCash, note: "verify-sales" },
    cookie,
  });
  check("Smena ochildi", open.status === 201 && open.data?.shift?.status === "OPEN", JSON.stringify(open.data));
  const shiftId = open.data?.shift?.id;
  if (!shiftId) throw new Error("Smena ID olinmadi — davom etib bo'lmaydi.");

  const current0 = await http("/api/v1/shifts/current", { cookie });
  check(
    "Yangi smenada kutilgan naqd = ochilish qoldig'i",
    current0.status === 200 && closeTo(current0.data?.shift?.expectedCash, openingCash),
    JSON.stringify(current0.data),
  );

  // ── 2. Idempotentlik ────────────────────────────────────────────────────
  console.log("\n2) Idempotentlik (clientOrderId)");
  const idemPayload = offlineOrder({
    variant: idemVariant,
    payments: [{ method: "CASH", amount: idemVariant.price }],
    note: "verify-idem",
  });
  const idemKey = idemPayload.clientOrderId;
  const idemStockBefore = await getStock(warehouse.id, idemVariant.variantId);

  const first = await sync([idemPayload], cookie);
  const firstResult = first.data?.results?.[0];
  check(
    "Birinchi sync processed",
    first.status === 200 && firstResult?.status === "processed",
    JSON.stringify(first.data),
  );

  const afterFirst = await q(
    'SELECT count(*)::int AS count FROM "Order" WHERE "tenantId" = $1 AND "offlineId" = $2',
    [tenant.id, idemKey],
  );
  const stockAfterFirst = await getStock(warehouse.id, idemVariant.variantId);
  check("Birinchi sync bitta chek yaratdi", afterFirst[0].count === 1, `count=${afterFirst[0].count}`);
  check(
    "Birinchi sync qoldiqni bir marta kamaytirdi",
    closeTo(stockAfterFirst, idemStockBefore - 1),
    `${idemStockBefore} -> ${stockAfterFirst}`,
  );

  const second = await sync([idemPayload], cookie);
  const secondResult = second.data?.results?.[0];
  const afterSecond = await q(
    'SELECT count(*)::int AS count FROM "Order" WHERE "tenantId" = $1 AND "offlineId" = $2',
    [tenant.id, idemKey],
  );
  const stockAfterSecond = await getStock(warehouse.id, idemVariant.variantId);

  check(
    "Takroriy sync skipped_duplicate",
    second.status === 200 && secondResult?.status === "skipped_duplicate",
    JSON.stringify(second.data),
  );
  check(
    "Takroriy sync o'sha chekni qaytardi",
    secondResult?.orderId === firstResult?.orderId && secondResult?.orderNumber === firstResult?.orderNumber,
  );
  check("Takroriy sync ikkinchi chek yaratmadi", afterSecond[0].count === 1, `count=${afterSecond[0].count}`);
  check(
    "Takroriy sync qoldiqni qayta kamaytirmadi",
    closeTo(stockAfterSecond, stockAfterFirst),
    `${stockAfterFirst} -> ${stockAfterSecond}`,
  );
  recordSale({ cash: idemVariant.price, total: idemVariant.price });

  // ── 3. Concurrent stock ─────────────────────────────────────────────────
  console.log("\n3) Parallel savdo (race condition)");
  const concurrentCount = 8;
  const concurrencyStock = 5;
  await setStock(warehouse.id, concurrencyVariant.variantId, concurrencyStock);
  const concurrentIds = Array.from({ length: concurrentCount }, () => randomUUID());
  const concurrentResponses = await Promise.all(
    concurrentIds.map((key) =>
      http("/api/v1/orders", {
        method: "POST",
        body: baseOrder({
          variant: concurrencyVariant,
          payments: [{ method: "CASH", amount: concurrencyVariant.price }],
          note: "verify-concurrency",
        }),
        headers: { "idempotency-key": key },
        cookie,
      }),
    ),
  );
  const created = concurrentResponses.filter((response) => response.status === 201);
  const rejected = concurrentResponses.filter(
    (response) => response.status === 409 && response.data?.code === "INSUFFICIENT_STOCK",
  );
  const finalStock = await getStock(warehouse.id, concurrencyVariant.variantId);
  const orderRows = await q(
    'SELECT id FROM "Order" WHERE "tenantId" = $1 AND "offlineId" = ANY($2::text[])',
    [tenant.id, concurrentIds],
  );
  const movementRows = await q(
    'SELECT count(*)::int AS count FROM "StockMovementLog" WHERE "referenceType" = \'Order\' AND "referenceId" = ANY($1::text[])',
    [orderRows.map((row) => row.id)],
  );

  check(
    `Parallel so'rovlardan faqat ${concurrencyStock} tasi o'tdi`,
    created.length === concurrencyStock,
    `created=${created.length}`,
  );
  check(
    `Qolgan ${concurrentCount - concurrencyStock} tasi INSUFFICIENT_STOCK bilan rad etildi`,
    rejected.length === concurrentCount - concurrencyStock,
    `rejected=${rejected.length}`,
  );
  check("Qoldiq manfiyga tushmadi", closeTo(finalStock, 0), `stock=${finalStock}`);
  check("Yaratilgan cheklar soni qoldiqqa teng", orderRows.length === concurrencyStock);
  check("Har bir sotuv uchun StockMovementLog yozildi", movementRows[0].count === concurrencyStock);
  for (let index = 0; index < created.length; index += 1) {
    recordSale({ cash: concurrencyVariant.price, total: concurrencyVariant.price });
  }

  // ── 4. Aralash to'lov va nasiya ─────────────────────────────────────────
  console.log("\n4) Aralash to'lov va nasiya");
  const splitCash = Math.min(10000, Math.floor(splitVariant.price / 2));
  const splitCard = round2(splitVariant.price - splitCash);
  const splitResponse = await http("/api/v1/orders", {
    method: "POST",
    body: baseOrder({
      variant: splitVariant,
      payments: [
        { method: "CASH", amount: splitCash },
        { method: "CARD", amount: splitCard },
      ],
      note: "verify-split",
    }),
    headers: { "idempotency-key": randomUUID() },
    cookie,
  });
  check("Aralash to'lov cheki yaratildi", splitResponse.status === 201, JSON.stringify(splitResponse.data));
  check(
    "Aralash to'lov 2 ta PaymentTransaction bilan yozildi",
    splitResponse.data?.order?.payments?.length === 2,
    JSON.stringify(splitResponse.data?.order?.payments),
  );
  recordSale({ cash: splitCash, card: splitCard, total: splitVariant.price });

  const debtResponse = await http("/api/v1/orders", {
    method: "POST",
    body: baseOrder({
      variant: debtVariant,
      payments: [{ method: "DEBT", amount: debtVariant.price }],
      customerId: debtCustomer.id,
      note: "verify-debt",
    }),
    headers: { "idempotency-key": randomUUID() },
    cookie,
  });
  const debtOrder = debtResponse.data?.order;
  check("Nasiya cheki yaratildi", debtResponse.status === 201, JSON.stringify(debtResponse.data));
  check("Nasiya summasi to'g'ri", closeTo(debtOrder?.debtAmount, debtVariant.price));
  check("Nasiyada haqiqiy PaymentTransaction yo'q", debtOrder?.payments?.length === 0);
  check("Nasiya cheki UNPAID holatida", debtOrder?.paymentStatus === "UNPAID", debtOrder?.paymentStatus);
  const debtRecordRows = debtOrder
    ? await q(
        'SELECT amount::float8 AS amount FROM "DebtRecord" WHERE "orderId" = $1 AND "tenantId" = $2',
        [debtOrder.id, tenant.id],
      )
    : [];
  const customerAfterDebt = await q(
    'SELECT "debtBalance"::float8 AS balance FROM "Customer" WHERE id = $1',
    [debtCustomer.id],
  );
  check("DebtRecord yaratildi", debtRecordRows.length === 1 && closeTo(debtRecordRows[0]?.amount, debtVariant.price));
  check(
    "Mijoz qarz balansi oshdi",
    closeTo(customerAfterDebt[0]?.balance, debtVariant.price),
    `balance=${customerAfterDebt[0]?.balance}`,
  );
  recordSale({ debt: debtVariant.price, total: debtVariant.price });

  // Kredit limiti
  await setStock(warehouse.id, debtVariant.variantId, 10);
  const limitStockBefore = await getStock(warehouse.id, debtVariant.variantId);
  const limitKey = randomUUID();
  const limitResponse = await http("/api/v1/orders", {
    method: "POST",
    body: baseOrder({
      variant: debtVariant,
      payments: [{ method: "DEBT", amount: debtVariant.price }],
      customerId: lowLimitCustomer.id,
      note: "verify-limit",
    }),
    headers: { "idempotency-key": limitKey },
    cookie,
  });
  const limitStockAfter = await getStock(warehouse.id, debtVariant.variantId);
  check(
    "Kredit limiti oshganda CREDIT_LIMIT_EXCEEDED",
    limitResponse.status === 409 && limitResponse.data?.code === "CREDIT_LIMIT_EXCEEDED",
    JSON.stringify(limitResponse.data),
  );
  check("Limit rad etilganda qoldiq o'zgarmadi", closeTo(limitStockAfter, limitStockBefore));
  const limitOrders = await q(
    'SELECT count(*)::int AS count FROM "Order" WHERE "tenantId" = $1 AND "offlineId" = $2',
    [tenant.id, limitKey],
  );
  check("Limit rad etilganda chek yaratilmadi", limitOrders[0].count === 0);

  // Bloklangan mijoz
  await db.query('UPDATE "Customer" SET "isBlocked" = true, "maxDebtLimit" = 10000000 WHERE id = $1', [
    lowLimitCustomer.id,
  ]);
  const blockedResponse = await http("/api/v1/orders", {
    method: "POST",
    body: baseOrder({
      variant: debtVariant,
      payments: [{ method: "DEBT", amount: debtVariant.price }],
      customerId: lowLimitCustomer.id,
      note: "verify-blocked",
    }),
    headers: { "idempotency-key": randomUUID() },
    cookie,
  });
  check(
    "Bloklangan mijozga nasiya rad etildi",
    blockedResponse.status === 403 && blockedResponse.data?.code === "CUSTOMER_BLOCKED",
    JSON.stringify(blockedResponse.data),
  );
  await db.query('UPDATE "Customer" SET "isBlocked" = false WHERE id = $1', [lowLimitCustomer.id]);

  // ── 5. Batch partial success ────────────────────────────────────────────
  console.log("\n5) Batch partial success");
  await setStock(warehouse.id, idemVariant.variantId, 1);
  const batchKey = randomUUID();
  const batchValid = {
    ...baseOrder({
      variant: idemVariant,
      quantity: 1,
      payments: [{ method: "CASH", amount: idemVariant.price }],
      note: "verify-batch-valid",
    }),
    clientOrderId: batchKey,
    clientCreatedAt: new Date().toISOString(),
  };
  const batchInvalid = offlineOrder({
    variant: idemVariant,
    quantity: 5,
    payments: [{ method: "CASH", amount: idemVariant.price * 5 }],
    note: "verify-batch-invalid",
  });
  const batchResponse = await sync([batchValid, batchValid, batchInvalid], cookie);
  const statuses = batchResponse.data?.results?.map((result) => result.status);
  check(
    "Batch uch xil status qaytardi",
    batchResponse.status === 200 &&
      statuses?.[0] === "processed" &&
      statuses?.[1] === "skipped_duplicate" &&
      statuses?.[2] === "failed",
    JSON.stringify(batchResponse.data),
  );
  check(
    "Batch summary to'g'ri",
    batchResponse.data?.summary?.processed === 1 &&
      batchResponse.data?.summary?.skippedDuplicate === 1 &&
      batchResponse.data?.summary?.failed === 1,
    JSON.stringify(batchResponse.data?.summary),
  );
  const batchOrders = await q(
    'SELECT count(*)::int AS count FROM "Order" WHERE "tenantId" = $1 AND "offlineId" = $2',
    [tenant.id, batchKey],
  );
  check("Batch dublikatni qayta yozmadi", batchOrders[0].count === 1);
  check("Batch valid chek qoldiqni kamaytirdi", closeTo(await getStock(warehouse.id, idemVariant.variantId), 0));
  recordSale({ cash: idemVariant.price, total: idemVariant.price });

  // ── 6. X-hisobot va smenani yopish ──────────────────────────────────────
  console.log("\n6) X-hisobot va Z-hisobot");
  const current = await http("/api/v1/shifts/current", { cookie });
  const totals = current.data?.shift?.totals;
  check(
    "X-hisobot: cheklar soni",
    current.data?.shift?.salesCount === expected.count,
    `${current.data?.shift?.salesCount} != ${expected.count}`,
  );
  check(
    "X-hisobot: naqd tushum",
    closeTo(totals?.cash, expected.cash),
    `${totals?.cash} != ${expected.cash}`,
  );
  check(
    "X-hisobot: karta tushum",
    closeTo(totals?.card, expected.card),
    `${totals?.card} != ${expected.card}`,
  );
  check(
    "X-hisobot: nasiya summasi",
    closeTo(totals?.debt, expected.debt),
    `${totals?.debt} != ${expected.debt}`,
  );
  const expectedCash = round2(openingCash + expected.cash);
  check(
    "X-hisobot: kutilgan naqd",
    closeTo(current.data?.shift?.expectedCash, expectedCash),
    `${current.data?.shift?.expectedCash} != ${expectedCash}`,
  );

  const cashDifference = -10000;
  const closingCash = round2(expectedCash + cashDifference);
  const close = await http("/api/v1/shifts/close", {
    method: "POST",
    body: { shiftId, closingCash, note: "verify close" },
    cookie,
  });
  check("Smena yopildi", close.status === 200 && close.data?.shift?.status === "CLOSED", JSON.stringify(close.data));
  check(
    "Kassa farqi to'g'ri hisoblandi",
    closeTo(close.data?.shift?.difference, cashDifference),
    `difference=${close.data?.shift?.difference}`,
  );
  check(
    "Z-hisobot tushumlari X-hisobot bilan mos",
    closeTo(close.data?.shift?.totals?.cash, expected.cash) &&
      closeTo(close.data?.shift?.totals?.card, expected.card) &&
      closeTo(close.data?.shift?.totals?.debt, expected.debt),
  );

  const shiftRows = await q(
    `SELECT status, "salesCount", "totalCash"::float8 AS cash, "totalCard"::float8 AS card,
            "totalDebt"::float8 AS debt, "expectedCash"::float8 AS expected, "difference"::float8 AS difference
     FROM "CashShift" WHERE id = $1`,
    [shiftId],
  );
  const shiftRow = shiftRows[0];
  check(
    "DBda smena yakuniy holati saqlandi",
    shiftRow?.status === "CLOSED" &&
      shiftRow.salesCount === expected.count &&
      closeTo(shiftRow.cash, expected.cash) &&
      closeTo(shiftRow.card, expected.card) &&
      closeTo(shiftRow.debt, expected.debt) &&
      closeTo(shiftRow.expected, expectedCash) &&
      closeTo(shiftRow.difference, cashDifference),
    JSON.stringify(shiftRow),
  );

  // ── 7. Smena to'sig'i ───────────────────────────────────────────────────
  console.log("\n7) Yopilgan smena to'sig'i");
  await setStock(warehouse.id, idemVariant.variantId, 5);
  const barrierStock = await getStock(warehouse.id, idemVariant.variantId);
  const barrier = await http("/api/v1/orders", {
    method: "POST",
    body: baseOrder({
      variant: idemVariant,
      payments: [{ method: "CASH", amount: idemVariant.price }],
      note: "verify-shift-barrier",
    }),
    headers: { "idempotency-key": randomUUID() },
    cookie,
  });
  check(
    "Smenasiz onlayn chek SHIFT_REQUIRED bilan rad etildi",
    barrier.status === 400 && barrier.data?.code === "SHIFT_REQUIRED",
    JSON.stringify(barrier.data),
  );
  const barrierStockAfter = await getStock(warehouse.id, idemVariant.variantId);
  check("Rad etilgan chek qoldiqni o'zgartirmadi", closeTo(barrierStockAfter, barrierStock));

  const barrierSync = await sync(
    [
      offlineOrder({
        variant: idemVariant,
        payments: [{ method: "CASH", amount: idemVariant.price }],
        note: "verify-shift-barrier-sync",
      }),
    ],
    cookie,
  );
  check(
    "Smenasiz sync failed + SHIFT_REQUIRED qaytardi",
    barrierSync.status === 200 &&
      barrierSync.data?.results?.[0]?.status === "failed" &&
      barrierSync.data?.results?.[0]?.code === "SHIFT_REQUIRED",
    JSON.stringify(barrierSync.data),
  );

  // ── 8. Kassir ruxsati ───────────────────────────────────────────────────
  console.log("\n8) Kassir smena ruxsati");
  const cashierCookie = await login("+998902223344");
  const cashierMe = await http("/api/auth/me", { cookie: cashierCookie });
  check(
    "Kassir shifts.manage ruxsatiga ega",
    cashierMe.status === 200 && cashierMe.data?.user?.permissions?.includes("shifts.manage"),
    JSON.stringify(cashierMe.data?.user?.permissions),
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
