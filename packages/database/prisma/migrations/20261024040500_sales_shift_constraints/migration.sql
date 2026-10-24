-- Bir foydalanuvchi bir filialda faqat bitta ochiq smenaga ega bo'lishi mumkin.
-- Prisma partial indexni ifodalay olmaydi, shuning uchun SQLda qo'lda yoziladi.
CREATE UNIQUE INDEX IF NOT EXISTS "CashShift_one_open_per_user_store"
  ON "CashShift" ("tenantId", "storeId", "userId")
  WHERE "status" = 'OPEN';

-- Chek raqami uchun global monoton sequence. Sequence tranzaksiyadan tashqarida
-- oshadi: muvaffaqiyatsiz tranzaksiyada raqam "yo'qoladi" (gap), lekin hech
-- qachon takrorlanmaydi va savdo tranzaksiyasini bloklamaydi.
CREATE SEQUENCE IF NOT EXISTS "Order_number_seq" START 1;
