/**
 * RLS (Row-Level Security) tekshiruvi.
 *
 *   npm run db:verify-rls
 *
 * 1. `savdo_app` nomli owner bo'lmagan rol yaratadi (agar yo'q bo'lsa).
 * 2. Unga jadval huquqlarini beradi.
 * 3. Tenant konteksti yo'q / noto'g'ri / to'g'ri bo'lganda ko'rinadigan
 *    qatorlarni solishtiradi va cross-tenant INSERT rad etilishini tekshiradi.
 *
 * Bu fayl faqat ishlab chiqish tekshiruvi uchun; productionda rollar va
 * GRANTlar DBA tomonidan alohida boshqariladi.
 */
import { Client } from "pg";

const OWNER_URL = process.env.DATABASE_URL;
if (!OWNER_URL) {
  console.error("DATABASE_URL topilmadi. `.env` faylni tekshiring.");
  process.exit(1);
}

const APP_ROLE = "savdo_app";
const APP_PASSWORD = "savdo_app_dev";
const APP_URL = new URL(OWNER_URL);
APP_URL.username = APP_ROLE;
APP_URL.password = APP_PASSWORD;

let failures = 0;

function check(name, condition, detail = "") {
  if (condition) {
    console.log(`  ✅ ${name}`);
  } else {
    failures += 1;
    console.log(`  ❌ ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

const owner = new Client({ connectionString: OWNER_URL });
await owner.connect();

const exists = await owner.query("SELECT 1 FROM pg_roles WHERE rolname = $1", [APP_ROLE]);
if (!exists.rowCount) {
  await owner.query(`CREATE ROLE ${APP_ROLE} LOGIN PASSWORD '${APP_PASSWORD}' NOSUPERUSER NOCREATEDB NOCREATEROLE`);
}
await owner.query(`GRANT CONNECT ON DATABASE ${owner.database} TO ${APP_ROLE}`);
await owner.query(`GRANT USAGE ON SCHEMA public TO ${APP_ROLE}`);
await owner.query(`GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO ${APP_ROLE}`);
await owner.query(`GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO ${APP_ROLE}`);

const tenants = await owner.query('SELECT id, slug FROM "Tenant" ORDER BY "createdAt" LIMIT 1');
const tenant = tenants.rows[0];
if (!tenant) {
  console.error("Tenant topilmadi. Avval `npm run db:seed` bajaring.");
  await owner.end();
  process.exit(1);
}

const policyCount = await owner.query("SELECT count(*)::int AS count FROM pg_policies WHERE policyname = 'tenant_isolation'");
const securedTables = await owner.query(
  'SELECT count(*)::int AS count FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = $1 AND c.relrowsecurity',
  ["public"],
);

console.log(`\n🔎 Tenant: ${tenant.slug} (${tenant.id})`);
console.log(`   RLS siyosatlari: ${policyCount.rows[0].count}, RLS yoqilgan jadvallar: ${securedTables.rows[0].count}\n`);

const app = new Client({ connectionString: APP_URL.toString() });
await app.connect();

// 1. Kontekstsiz — hech narsa ko'rinmasligi kerak
const withoutContext = await app.query('SELECT count(*)::int AS count FROM "User"');
check("Kontekstsiz tenant jadvallari bo'sh", withoutContext.rows[0].count === 0, `count=${withoutContext.rows[0].count}`);

// 2. To'g'ri kontekst
await app.query("SELECT set_config('app.tenant_id', $1, false)", [tenant.id]);
const withContext = await app.query('SELECT count(*)::int AS count FROM "User"');
check("To'g'ri tenant kontekstida yozuvlar ko'rinadi", withContext.rows[0].count > 0, `count=${withContext.rows[0].count}`);

const productCount = await app.query('SELECT count(*)::int AS count FROM "Product"');
check("Product jadvali tenant bilan cheklangan", productCount.rows[0].count > 0, `count=${productCount.rows[0].count}`);

// 3. Boshqa tenant konteksti
await app.query("SELECT set_config('app.tenant_id', $1, false)", ["boshqa-tenant-id"]);
const wrongContext = await app.query('SELECT count(*)::int AS count FROM "User"');
check("Boshqa tenant kontekstida yozuvlar ko'rinmaydi", wrongContext.rows[0].count === 0, `count=${wrongContext.rows[0].count}`);

// 4. Cross-tenant INSERT rad etilishi
let insertBlocked = false;
try {
  await app.query(
    'INSERT INTO "Store" (id, "tenantId", code, name, "createdAt", "updatedAt") VALUES ($1, $2, $3, $4, now(), now())',
    ["rls-test-store", "boshqa-tenant-id", "RLS-TEST", "RLS test"],
  );
} catch (error) {
  insertBlocked = /row-level security|violates/i.test(String(error));
}
check("Boshqa tenant nomiga INSERT rad etiladi", insertBlocked);

await app.end();
await owner.end();

if (failures > 0) {
  console.error(`\n❌ RLS tekshiruvi muvaffaqiyatsiz (${failures} ta).\n`);
  process.exit(1);
}
console.log("\n✅ RLS izolyatsiyasi to'g'ri ishlaydi.\n");
