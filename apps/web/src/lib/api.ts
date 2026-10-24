import { NextResponse } from "next/server";
import { Prisma } from "@repo/database";
import { ZodError, type ZodTypeAny } from "zod";
import { ApiError } from "@/lib/errors";

export function json<T>(data: T, status = 200): NextResponse {
  return NextResponse.json(data, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function parseBody<S extends ZodTypeAny>(
  request: Request,
  schema: S,
): Promise<ReturnType<S["parse"]>> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    throw new ApiError(400, "So'rov tanasi noto'g'ri JSON.");
  }
  // ReturnType<S["parse"]> — Zod "output" tipi: default qiymatlar allaqachon
  // to'ldirilgan, shuning uchun route'larda optional maydon qolmaydi.
  return schema.parse(raw) as ReturnType<S["parse"]>;
}

/** Same-origin tekshiruvi — CSRF himoyasi (mutatsion so'rovlar uchun) */
export function assertSameOrigin(request: Request): void {
  const origin = request.headers.get("origin");
  if (!origin) return; // CLI/mobil klientlar Origin yubormasligi mumkin

  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (!host) throw new ApiError(400, "Host aniqlanmadi.");

  try {
    if (new URL(origin).host !== host) {
      throw new ApiError(403, "So'rov boshqa domendan yuborilgan.");
    }
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(403, "Origin noto'g'ri.");
  }
}

export async function handle(fn: () => Promise<NextResponse>): Promise<NextResponse> {
  try {
    return await fn();
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json(
        { error: error.message, code: error.code, details: error.details },
        { status: error.status, headers: { "Cache-Control": "no-store" } },
      );
    }

    if (error instanceof ZodError) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of error.issues) {
        const key = issue.path.join(".") || "form";
        if (!fieldErrors[key]) fieldErrors[key] = issue.message;
      }
      return NextResponse.json(
        {
          error: Object.values(fieldErrors)[0] ?? "Kiritilgan ma'lumotlar noto'g'ri.",
          details: fieldErrors,
        },
        { status: 422, headers: { "Cache-Control": "no-store" } },
      );
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") {
        return NextResponse.json(
          { error: "Bu qiymat allaqachon mavjud (dublikat)." },
          { status: 409, headers: { "Cache-Control": "no-store" } },
        );
      }
      if (error.code === "P2025") {
        return NextResponse.json(
          { error: "Yozuv topilmadi." },
          { status: 404, headers: { "Cache-Control": "no-store" } },
        );
      }
    }

    console.error("[api] kutilmagan xato:", error);
    return NextResponse.json(
      { error: "Server xatosi. Birozdan so'ng qayta urinib ko'ring." },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
