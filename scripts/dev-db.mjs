/**
 * Lokal PostgreSQLni boshqarish (faqat ishlab chiqish uchun).
 *
 *   npm run db:up        — bazani ishga tushirish (birinchi marta avtomatik init qiladi)
 *   node scripts/dev-db.mjs start
 *   node scripts/dev-db.mjs stop
 *   node scripts/dev-db.mjs status
 *
 * Productionda oddiy PostgreSQL server va DATABASE_URL ishlatiladi.
 */
import EmbeddedPostgres from "embedded-postgres";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync } from "node:fs";
import path from "node:path";

const DATA_DIR = path.resolve(".pgdata");
const LOG_FILE = path.resolve(".pgdata.log");
const PORT = Number(process.env.PG_PORT ?? 5433);
const DB_NAME = process.env.PG_DB ?? "savdo_crm";
const USER = "crm";
const PASSWORD = "crm";
const command = process.argv[2] ?? "start";

/** Platformaga mos pg_ctl ni topadi (linux-x64, darwin-arm64, win32-x64 ...) */
function findPgCtl() {
  const root = path.resolve("node_modules/@embedded-postgres");
  if (!existsSync(root)) {
    throw new Error("embedded-postgres o'rnatilmagan. `npm install` bajaring.");
  }
  for (const pkg of readdirSync(root)) {
    for (const binary of ["pg_ctl", "pg_ctl.exe"]) {
      const candidate = path.join(root, pkg, "native", "bin", binary);
      if (existsSync(candidate)) return candidate;
    }
  }
  throw new Error("pg_ctl topilmadi — embedded-postgres to'liq o'rnatilmagan.");
}

const PG_CTL = findPgCtl();

const pg = new EmbeddedPostgres({
  databaseDir: DATA_DIR,
  user: USER,
  password: PASSWORD,
  port: PORT,
  persistent: true,
});

async function ensureDatabase() {
  const client = pg.getPgClient("postgres");
  await client.connect();
  try {
    const { rowCount } = await client.query("SELECT 1 FROM pg_database WHERE datname = $1", [DB_NAME]);
    if (!rowCount) {
      await client.query(`CREATE DATABASE "${DB_NAME}"`);
      console.log(`Baza yaratildi: ${DB_NAME}`);
    }
  } finally {
    await client.end();
  }
}

async function init() {
  if (existsSync(path.join(DATA_DIR, "PG_VERSION"))) return;
  mkdirSync(DATA_DIR, { recursive: true });
  console.log("PostgreSQL klasteri tayyorlanmoqda...");
  await pg.initialise();
}

if (command === "init") {
  await init();
  await ensureDatabase();
} else if (command === "start") {
  await init();
  const status = spawnSync(PG_CTL, ["-D", DATA_DIR, "status"], { encoding: "utf8" });
  if (status.status === 0) {
    console.log(`PostgreSQL allaqachon ishlayapti (port ${PORT}).`);
  } else {
    const started = spawnSync(
      PG_CTL,
      ["-D", DATA_DIR, "-l", LOG_FILE, "-o", `-p ${PORT} -k /tmp`, "-w", "start"],
      { stdio: "inherit" },
    );
    if (started.status !== 0) process.exit(started.status ?? 1);
  }
  await ensureDatabase();
  console.log(`PostgreSQL tayyor: postgresql://${USER}:***@127.0.0.1:${PORT}/${DB_NAME}`);
} else if (command === "stop") {
  spawnSync(PG_CTL, ["-D", DATA_DIR, "-m", "fast", "-w", "stop"], { stdio: "inherit" });
} else if (command === "status") {
  spawnSync(PG_CTL, ["-D", DATA_DIR, "status"], { stdio: "inherit" });
} else {
  console.error("Noma'lum buyruq. start | stop | status | init");
  process.exit(1);
}
