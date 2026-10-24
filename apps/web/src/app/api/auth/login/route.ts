import { NextResponse } from "next/server";
import { homePathForPermissions, loginSchema } from "@repo/shared";
import { assertSameOrigin, handle, json, parseBody } from "@/lib/api";
import { SESSION_COOKIE } from "@/lib/jwt";
import { authenticateUser, sessionCookieOptions } from "@/lib/auth";
import { cleanupRateLimitBuckets, rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return handle(async () => {
    assertSameOrigin(request);

    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      request.headers.get("x-real-ip") ??
      "unknown";

    const input = await parseBody(request, loginSchema);

    cleanupRateLimitBuckets();
    const windowMs = 5 * 60 * 1000;
    const accountLimit = rateLimit(`login:${ip}:${input.phone}`, 10, windowMs);
    const ipLimit = rateLimit(`login-ip:${ip}`, 40, windowMs);
    if (!accountLimit.success || !ipLimit.success) {
      const retryAfter = Math.max(accountLimit.retryAfterSeconds, ipLimit.retryAfterSeconds);
      return NextResponse.json(
        { error: `Juda ko'p urinish. ${retryAfter} soniyadan so'ng qayta urinib ko'ring.` },
        { status: 429, headers: { "Retry-After": String(retryAfter), "Cache-Control": "no-store" } },
      );
    }

    const { user, token } = await authenticateUser(input);

    const response = json({
      user: {
        id: user.id,
        name: user.name,
        roleCode: user.roleCode,
        roleName: user.roleName,
        tenantName: user.tenantName,
        storeName: user.storeName,
      },
      redirectTo: homePathForPermissions(user.permissions),
    });

    response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
    return response;
  });
}
