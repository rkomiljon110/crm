# Savdo ERP — O'zbekiston uchun omni-channel CRM / POS / ERP

Chakana va ulgurji savdo, omborxona va xizmat ko'rsatish korxonalari uchun
ko'p tenantli (SaaS) platforma. Hozirgi holat: **1–4 bosqichning katta qismi
yakunlangan** — Turborepo monorepo, to'liq ma'lumotlar modeli, Row-Level Security,
granular RBAC, tenant sessiyasi, tranzaksiyali savdo yadrosi, kassa smenalari,
idempotent offline-sync API va real POS terminal UI.

> To'liq arxitektura qarorlari, offline-sync shartnomasi va yo'l xaritasi:
> [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) ·
> API shartnomasi va curl misollari: [docs/API.md](docs/API.md)
> Interaktiv API: **`/api-docs`** · OpenAPI JSON: **`/api/openapi`**

## Nima tayyor

| Qatlam | Holat |
| --- | --- |
| `apps/web` — Next.js 14 admin portal, RBAC, POS terminal va API, smena X/Z, `/api-docs` | Ishlaydi |
| `packages/database` — PostgreSQL + Prisma, 28 model, 4 migratsiya, RLS, seed | Ishlaydi |
| `packages/shared` — 27 granular ruxsat, 6 rol, Zod sxemalari, moliya/sana formulalari | Ishlaydi |
| `packages/ui` — umumiy Tailwind/Radix dizayn tizimi | Ishlaydi |
| `apps/backend` (NestJS), `apps/desktop` (Tauri), `apps/mobile` (Expo), `apps/telegram-bot` | 3–6-bosqichlar |

Demo baza: **Baraka Savdo** tenantasi — 2 filial, 3 ombor, 12 tovar (14 variant),
6 mijoz, 3 yetkazib beruvchi, 45 kunlik 104 chek, xarajatlar, kassa smenalari va audit jurnali.
Kassir uchun seed ochiq smena yaratadi; admin uchun smena yo'q.

## Tez boshlash

Talablar: **Node.js 20+**, **npm 11+**. PostgreSQL alohida o'rnatish shart emas —
ishlab chiqish uchun `embedded-postgres` ishlatiladi.

```bash
cp .env.example .env          # AUTH_SECRET ni almashtiring!
npm install

npm run db:up                 # lokal PostgreSQL (127.0.0.1:5433)
npm run db:deploy             # migratsiyalarni qo'llash
npm run db:seed               # demo tenant + 45 kunlik savdo

npm run dev                   # http://localhost:3000
```

`.env` faylida `AUTH_SECRET` kamida 32 belgi bo'lishi shart:

```bash
openssl rand -hex 32
```

### Demo hisoblar

Biznes kodi: **`baraka`** · parol: **`demo1234`**

| Rol | Telefon | Nima ko'radi |
| --- | --- | --- |
| Super admin | `+998901234567` | Barcha ruxsatlar, dashboard, foyda |
| Filial boshqaruvchisi | `+998901112233` | Filial savdosi, ombor, moliya (ko'rish) |
| Kassir | `+998902223344` | Kassa, o'z savdolari, mijoz qarzlari |
| Omborchi | `+998903334455` | Tovar, ombor, reviziya, ta'minot |
| Buxgalter | `+998904445566` | Moliya, P&L, hisobotlar, audit |

Kassir `/pos` dagi real kassa terminaliga, omborchi `/products` ga tushadi; ruxsati
yo'q sahifa `/403` ga yo'naltiriladi. POSda shtrix-kod/nom qidiruvi, savat, aralash
to'lov, nasiya, smena ochish/yopish va chek oynasi ishlaydi. Qolgan modul sahifalari
hozircha rejalashtirilgan bosqichni ko'rsatadi.

## Buyruqlar

| Buyruq | Vazifasi |
| --- | --- |
| `npm run dev` | Turborepo orqali barcha app'larni ishga tushirish |
| `npm run build` | Produksiya build (barcha workspace) |
| `npm run typecheck` | Barcha paketlarda TypeScript tekshiruvi |
| `npm run db:up` / `db:stop` | Lokal PostgreSQLni ochish/yopish |
| `npm run db:deploy` | Migratsiyalarni qo'llash (production uchun ham) |
| `npm run db:migrate` | Yangi migratsiya yaratish (dev) |
| `npm run db:seed` | Demo ma'lumotlarni qayta yaratish |
| `npm run db:studio` | Prisma Studio |
| `npm run db:verify-rls` | Owner bo'lmagan rol bilan RLS izolyatsiyasini tekshirish |
| `npm run verify:sales` | Savdo/sync/smena uchun 43 ta HTTP + DB tekshiruvi |
| `npm run verify:demo` | 5 rol, 8 to'lov usuli, POS bootstrap, X/Z va OpenAPI (64 check) |

## Monorepo tuzilishi

```text
.
├── apps/
│   └── web/                    # Next.js 14 — admin portal, auth, POS terminal, /api-docs
│       └── src/
│           ├── app/            # login, dashboard, /api-docs, v1 API route handlers
│           ├── components/     # app shell, sidebar, interaktiv API explorer
│           └── lib/            # auth, JWT, sales engine, pos bootstrap, openapi
├── packages/
│   ├── database/               # Prisma sxema, migratsiyalar, seed, tenant context
│   ├── shared/                 # RBAC katalogi, Zod, money, date, sync kontraktlari
│   └── ui/                     # Button, Input, Card, Dialog, Table, Select...
├── scripts/
│   ├── dev-db.mjs              # embedded PostgreSQL boshqaruvi
│   ├── verify-rls.mjs          # RLS izolyatsiya testi
│   ├── verify-sales.mjs        # idempotentlik, race, smena, nasiya testi
│   └── verify-demo.mjs         # rollar, to'lov usullari, POS bootstrap, OpenAPI
├── docs/ARCHITECTURE.md
├── docs/API.md
├── turbo.json
└── tsconfig.base.json
```

## Tekshirilgan natijalar

- `npm run typecheck` — 4/4 paket toza.
- Migratsiyalar bo'sh bazaga qo'llandi, seed 104 chek yaratdi.
- `npm run db:verify-rls` — 26 jadvalda RLS yoqilgan; kontekstsiz 0 qator,
  boshqa tenant kontekstida 0 qator, cross-tenant INSERT rad etiladi.
- HTTP orqali: noto'g'ri parol → 401, muvaffaqiyatli login → cookie,
  `/dashboard` → 200, kassir `/dashboard` → `/403`, logoutdan keyin sessiya
  bekor → 401; `Origin` mos kelmasa → 403.
- `npm run verify:sales` — 43/43: idempotent sync, 8 parallel sotuvda
  oversell yo'qligi, batch partial success, nasiya limiti/bloklash, X/Z hisobot
  va yopilgan smenada chek rad etilishi. Xuddi shu to'plam **`savdo_app`**
  (owner bo'lmagan, RLS amal qiladigan) rol bilan ham 43/43 o'tdi.
- `npm run verify:demo` — 64/64: 5 demo rol va sahifa/API chegaralari, POS
  bootstrap va shtrix-kod qidiruvi, 7 to'lov usuli + split + nasiya, 401/403/
  404/409/422, CSRF, X/Z hisobot, OpenAPI 3.1 va `/api-docs` renderi.
- Brauzer smoke (headless Chromium) — 37/37: kassir login, `/api-docs`
  endpointlari, barcha demo tugmalari real smena/ombor/tovar IDlari bilan,
  onlayn chek `201`, offline sync `200 processed`, 401/409/422 xatolari
  interfeysda va buxgalter uchun `pos.use` chegarasi.
- POS terminal brauzer smoke — **16/16**: smena holati, shtrix-kod bilan savatga
  qo'shish, naqd chek `201`, nasiya cheki va qoldiqning kamayishi, menejer uchun
  smena ochish va Z-hisobot bilan yopish.
- `npm run build` — `/pos`, `/api-docs`, `/api/openapi` va barcha POS API route'lari
  bilan produksiya build muvaffaqiyatli.

## Productionga chiqishdan oldin

1. `AUTH_SECRET` ni almashtiring, demo parollarni o'chiring.
2. PostgreSQLda **owner bo'lmagan** `savdo_app` roli yarating va `DATABASE_URL` ni
   shu rolga bering (aks holda RLS chetlab o'tiladi). SQL namuna:
   [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md#rlsni-productionda-yoqish).
3. `npm run db:deploy` ni owner roli bilan bajaring.
4. Rate-limitni Redisga ko'chiring (hozir in-memory), HTTPS va xavfsiz cookie
   (`NODE_ENV=production`) ta'minlang.
5. Zaxira (PITR) va monitoringni sozlang.

## Keyingi bosqichlar

1. **4-bosqich (davom)** — POS uchun ESC/POS chek printer, qaytarish (refund) oqimi,
   savdo tarixi va chekni qayta chop etish.
2. **5-bosqich** — moliya/P&L, ombor reviziyasi, xodimlar boshqaruvi.
3. **6-bosqich** — nasiya daftari va Telegram bot (share + bot API).
4. **Platformalar** — Tauri 2 desktop (PWA/offline core ustida), Expo mobil kassa.
5. **Backend ajratish** — sales yadrosi `apps/backend` (NestJS) ga ko'chiriladi,
   WebSocket realtime va BullMQ qo'shiladi.
