import { NextResponse, type NextRequest } from "next/server";
import { ROUTE_PERMISSIONS, homePathForPermissions } from "@repo/shared";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/jwt";

/**
 * Edge middleware:
 *  - token yo'q -> /login
 *  - token bor, lekin sahifa uchun ruxsat yo'q -> /403
 *  - /login ga kirgan foydalanuvchi -> o'z bosh sahifasiga
 *
 * JWT faqat Edge'da tekshiriladi (Prisma chaqirilmaydi). Sessiyaning bekor
 * qilinganini API va server komponentlari `getSession()` orqali tekshiradi.
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const session = token ? await verifySessionToken(token) : null;

  if (pathname === "/login") {
    if (session) {
      return NextResponse.redirect(new URL(homePathForPermissions(session.permissions), request.url));
    }
    return NextResponse.next();
  }

  if (!session) {
    const loginUrl = new URL("/login", request.url);
    if (pathname !== "/") loginUrl.searchParams.set("next", pathname);
    const response = NextResponse.redirect(loginUrl);
    if (token) response.cookies.delete(SESSION_COOKIE);
    return response;
  }

  const matched = Object.entries(ROUTE_PERMISSIONS).find(
    ([prefix]) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );

  if (matched && !session.permissions.includes(matched[1])) {
    return NextResponse.redirect(new URL("/403", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
