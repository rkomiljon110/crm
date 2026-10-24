# Savdo ERP — API qo'llanmasi

Holat: **3-bosqich** — savdo, smena va offline sync API production darajasida ishlaydi.
Interaktiv interfeys: **`/api-docs`** · Mashina o'qiydigan shartnoma: **`/api/openapi`**
(OpenAPI 3.1).

---

## 1. Asosiy qoidalar

| Parametr | Qiymat |
| --- | --- |
| Base URL | `http://localhost:3000` (dev) yoki deployment domeni |
| Format | JSON, UTF-8 |
| Autentifikatsiya | HttpOnly cookie `savdo_session` (HS256 JWT + DB sessiyasi) |
| CSRF | `POST` so'rovlarda `Origin` header'i `Host` bilan mos bo'lishi shart |
| Pul | Javobda `number` (so'm, 2 xona), DBda `Decimal(14,2)` |
| Miqdor | `number`, 3 xonagacha (kg/metr) |
| Tenant | Faqat sessiyadan olinadi; `tenantId`ni klient yubormaydi |
| Rate limit | Login: 10 urinish / 5 daqiqa (akkaunt), 40 / 5 daqiqa (IP) |

> Cookie ishlatilgani uchun brauzer va server bir domenda bo'lishi kerak.
> Desktop/mobil klient cookie saqlashni qo'llab-quvvatlashi shart.

---

## 2. Demo hisoblar

Biznes kodi: `baraka` · parol: `demo1234`

| Rol | Telefon | Asosiy ruxsatlar |
| --- | --- | --- |
| Super admin | `+998901234567` | Barchasi |
| Filial boshqaruvchisi | `+998901112233` | Savdo, ombor, moliya (ko'rish), smena |
| Kassir | `+998902223344` | POS, savdo, smena, mijoz qarzi |
| Omborchi | `+998903334455` | Tovar, ombor, transfer |
| Buxgalter | `+998904445566` | Moliya, P&L, audit |

Seed kassir uchun ochiq smena yaratadi; admin uchun smena yo'q.

---

## 3. Birinchi so'rov: login

```bash
BASE=http://localhost:3000
COOKIE=/tmp/savdo.cookies

curl -s -c "$COOKIE" \
  -H 'content-type: application/json' \
  -H "origin: $BASE" \
  -d '{"tenantSlug":"baraka","phone":"+998902223344","password":"demo1234"}' \
  "$BASE/api/auth/login"
```

Javob:

```json
{
  "user": {
    "id": "usr_...",
    "name": "Dilshod Tursunov",
    "roleCode": "CASHIER",
    "roleName": "Kassir",
    "tenantName": "Baraka Savdo",
    "storeName": "Markaziy do'kon"
  },
  "redirectTo": "/pos"
}
```

`Set-Cookie` orqali `savdo_session` o'rnatiladi. Keyingi so'rovlarda `-b "$COOKIE"`.

```bash
curl -s -b "$COOKIE" "$BASE/api/auth/me"
curl -s -b "$COOKIE" -X POST -H "origin: $BASE" "$BASE/api/auth/logout"
```

---

## 4. POS bootstrap va qidiruv

```bash
curl -s -b "$COOKIE" "$BASE/api/v1/pos/bootstrap" | jq
curl -s -b "$COOKIE" "$BASE/api/v1/pos/bootstrap?q=4780001000011" | jq
curl -s -b "$COOKIE" "$BASE/api/v1/pos/bootstrap?q=shakar" | jq
```

Javobning asosiy maydonlari:

```json
{
  "shift": { "id": "shift_...", "status": "OPEN", "storeId": "store_...", "expectedCash": 500000 },
  "stores": [{ "id": "store_...", "code": "SHOP-1", "name": "Markaziy do'kon" }],
  "warehouses": [{ "id": "wh_...", "code": "SHOP-1", "name": "Markaziy do'kon ombori", "storeId": "store_..." }],
  "selectedWarehouseId": "wh_...",
  "products": [
    {
      "variantId": "var_...",
      "productId": "prod_...",
      "name": "Oq shakar (1 kg)",
      "variantName": "Standart",
      "barcode": "4780001000011",
      "barcodes": ["4780001000011"],
      "price": 12500,
      "stock": 35,
      "unit": "kg",
      "allowDecimal": true
    }
  ],
  "customers": [
    { "id": "cus_...", "name": "Aziz Karimov", "phone": "+998935551122", "debtBalance": 0, "maxDebtLimit": 2000000, "isBlocked": false }
  ],
  "paymentMethods": ["CASH", "CARD", "TRANSFER", "CLICK", "PAYME", "UZUM", "OTHER", "DEBT"]
}
```

`q` shtrix-kod, SKU, variant nomi yoki tovar nomi bo'yicha ishlaydi. Tannarx
(`costPrice`/`unitCost`) ataylab qaytarilmaydi. Omborlar foydalanuvchi filialiga
cheklangan; boshqa filial omborlari faqat `settings.manage` egasiga ko'rinadi.

---

## 5. Onlayn chek

```bash
curl -s -b "$COOKIE" \
  -H 'content-type: application/json' \
  -H "origin: $BASE" \
  -H "Idempotency-Key: $(uuidgen)" \
  -d '{
    "warehouseId": "wh_...",
    "customerId": null,
    "items": [
      { "variantId": "var_...", "quantity": 1, "unitPrice": 12500, "discountAmount": 0 }
    ],
    "discountAmount": 0,
    "taxAmount": 0,
    "payments": [{ "method": "CASH", "amount": 12500 }],
    "note": "POS demo"
  }' \
  "$BASE/api/v1/orders"
```

Muvaffaqiyatli javob `201`:

```json
{
  "order": {
    "id": "ord_...",
    "number": "SHOP-1-261024-00001",
    "status": "COMPLETED",
    "shiftId": "shift_...",
    "subtotal": 12500,
    "totalAmount": 12500,
    "paidAmount": 12500,
    "debtAmount": 0,
    "paymentStatus": "PAID",
    "items": [{ "productName": "Oq shakar (1 kg)", "quantity": 1, "unitPrice": 12500 }],
    "payments": [{ "method": "CASH", "amount": 12500, "status": "COMPLETED" }]
  },
  "duplicate": false
}
```

- `Idempotency-Key` ixtiyoriy, 8–100 belgi. Bir xil kalit bilan qayta yuborilsa
  `200` va mavjud chek, `duplicate: true` qaytadi; qoldiq qayta kamaymaydi.
- `DEBT` to'lovi — chekning nasiya qismi. U `PaymentTransaction` yaratmaydi;
  `DebtRecord` va `Customer.debtBalance` yoziladi.
- Ochiq smena bo'lmasa `400 SHIFT_REQUIRED`.
- Qoldiq yetmasa `409 INSUFFICIENT_STOCK`, butun tranzaksiya rollback bo'ladi.
- `RETURN` hozircha `400 RETURN_UNSUPPORTED` (4-bosqichda refund oqimi).

### To'lov usullari

`CASH`, `CARD`, `TRANSFER`, `CLICK`, `PAYME`, `UZUM`, `OTHER`, `DEBT`.

Aralash to'lov — bir nechta element:

```json
"payments": [
  { "method": "CASH", "amount": 5000 },
  { "method": "CARD", "amount": 7500 }
]
```

`payments` summasi (DEBT bilan birga) `totalAmount`ga teng bo'lishi shart; aks
holda `422 PAYMENT_MISMATCH`.

---

## 6. Offline sync

```bash
curl -s -b "$COOKIE" \
  -H 'content-type: application/json' \
  -H "origin: $BASE" \
  -d '{
    "deviceId": "shop1-pos-01",
    "orders": [
      {
        "clientOrderId": "0f8fad5b-d9cb-469f-a165-70867728950e",
        "clientCreatedAt": "2026-10-24T14:02:11+05:00",
        "warehouseId": "wh_...",
        "items": [{ "variantId": "var_...", "quantity": 1, "unitPrice": 12500 }],
        "discountAmount": 0,
        "taxAmount": 0,
        "payments": [{ "method": "CASH", "amount": 12500 }]
      }
    ]
  }' \
  "$BASE/api/v1/sync/orders"
```

Javob har doim `200` (batch qabul qilindi), har bir chek uchun natija:

```json
{
  "deviceId": "shop1-pos-01",
  "serverTime": "2026-10-24T09:00:00.000Z",
  "summary": { "total": 2, "processed": 1, "skippedDuplicate": 1, "failed": 0 },
  "results": [
    { "clientOrderId": "...", "status": "processed", "orderId": "ord_...", "orderNumber": "SHOP-1-261024-00002", "totalAmount": 12500 },
    { "clientOrderId": "...", "status": "skipped_duplicate", "orderId": "ord_...", "orderNumber": "SHOP-1-261024-00002" }
  ]
}
```

- Har bir chek alohida tranzaksiyada: bittasi xato bersa qolganlari davom etadi.
- `clientOrderId` UUID v4 — idempotentlik kaliti (DBda `Order.offlineId`).
- `failed` natijada `code` va `error` bo'ladi.
- Batch 1–100 chek.
- Oflayn chek ham **ochiq smenani** talab qiladi. Z-yopishdan oldin navbatni
  bo'shatish kerak; aks holda `failed / SHIFT_REQUIRED`.

---

## 7. Smena va X/Z hisobot

```bash
# Ochish
curl -s -b "$COOKIE" -H 'content-type: application/json' -H "origin: $BASE" \
  -d '{"storeId":"store_...","openingCash":500000,"note":"Ertalabki smena"}' \
  "$BASE/api/v1/shifts/open"

# Joriy smena + X-hisobot
curl -s -b "$COOKIE" "$BASE/api/v1/shifts/current"

# Yopish (Z-hisobot)
curl -s -b "$COOKIE" -H 'content-type: application/json' -H "origin: $BASE" \
  -d '{"shiftId":"shift_...","closingCash":845000,"note":"Kechki yopish"}' \
  "$BASE/api/v1/shifts/close"
```

Yopish javobida:

```json
{
  "shift": {
    "id": "shift_...",
    "status": "CLOSED",
    "openingCash": 500000,
    "closingCash": 845000,
    "expectedCash": 850000,
    "difference": -5000,
    "salesCount": 12,
    "totals": {
      "cash": 350000,
      "card": 180000,
      "transfer": 0,
      "other": 120000,
      "debt": 200000,
      "sales": 850000,
      "paid": 650000
    }
  }
}
```

`expectedCash = openingCash + totals.cash`; `difference = closingCash - expectedCash`.
Smena yopilgach yangi chek `400 SHIFT_REQUIRED`.

---

## 8. Xatolar

Format:

```json
{
  "error": "Inson o'qiydigan xabar",
  "code": "MACHINE_CODE",
  "details": { "variantId": "var_...", "requested": 2, "available": 1 }
}
```

| HTTP | `code` | Ma'nosi |
| --- | --- | --- |
| 400 | `SHIFT_REQUIRED` | Ochiq smena yo'q |
| 400 | `RETURN_UNSUPPORTED` | Qaytarish hali yo'q |
| 401 | — | Sessiya yo'q / bekor qilingan |
| 403 | `DISCOUNT_FORBIDDEN` | `pos.discount` yo'q |
| 403 | `CUSTOMER_BLOCKED` | Mijoz nasiyaga bloklangan |
| 403 | `SHIFT_FORBIDDEN` | Boshqa kassir smenasi |
| 404 | `VARIANT_NOT_FOUND` | Tovar topilmadi |
| 404 | `WAREHOUSE_NOT_FOUND` | Ombor topilmadi |
| 409 | `INSUFFICIENT_STOCK` | Qoldiq yetmadi (rollback) |
| 409 | `CREDIT_LIMIT_EXCEEDED` | Nasiya limiti oshdi |
| 409 | `SHIFT_ALREADY_OPEN` | Ochiq smena bor |
| 409 | `SHIFT_ALREADY_CLOSED` | Smena yopilgan |
| 422 | `PAYMENT_MISMATCH` | To'lov summasi mos emas |
| 422 | `DUPLICATE_ITEM` | Bitta tovar ikki marta |
| 422 | `INVALID_DISCOUNT` | Chegirma summadan katta |
| 422 | `STORE_MISMATCH` | Filial smenaga mos emas |
| 422 | `WAREHOUSE_MISMATCH` | Ombor smenaga mos emas |
| 422 | `INVALID_CLIENT_DATE` | Chek sanasi noto'g'ri |
| 429 | — | Login rate limit |

---

## 9. Interaktiv interfeys

`/api-docs` sahifasi:

- OpenAPI 3.1 katalogidan endpointlar ro'yxati;
- JSON tanasi va query string muharriri;
- **Demo ma'lumotlarini yuklash** — real smena, ombor, tovar va mijoz IDlarini
  `/api/v1/pos/bootstrap` orqali olib, tayyor so'rov tanasini to'ldiradi;
- javob statusi, davomiylik va JSON;
- joriy sessiya cookie'si avtomatik yuboriladi.

Brauzerda ochish: `http://localhost:3000/api-docs`.

---

## 10. Tekshiruv

```bash
npm run db:seed
npm run dev
npm run verify:sales   # 43 check: tranzaksiya, race, idempotentlik, smena
npm run verify:demo    # 64 check: 5 rol, 8 to'lov usuli, X/Z, OpenAPI
npm run db:verify-rls  # 26 jadval tenant izolyatsiyasi
```

`verify:demo` barcha demo rollari, 7 to'lov usuli + split + nasiya, 401/403/404/
409/422, CSRF, katalog qidiruvi va `/api-docs`ni tekshiradi.
