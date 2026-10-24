import { cache } from "react";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { prisma, withTenantContext } from "@repo/database";
import { can, type PermissionKey } from "@repo/shared";
import { ApiError } from "@/lib/errors";
import { SESSION_COOKIE, SESSION_MAX_AGE, signSessionToken, verifySessionToken } from "@/lib/jwt";
import type { SessionUser } from "@/lib/types";

const INVALID_CREDENTIALS = "Biznes kodi, telefon raqam yoki parol noto'g'ri.";
// Mavjud bo'lmagan foydalanuvchi uchun ham bcrypt bajarilib, javob vaqti tenglashtiriladi
const DUMMY_HASH = "$2a$10$7EqJtq98hPqEX7fNZaFWoO5uY6h9nJbq3zM1lP0w4D8VYw3Xkq1Ae";

export function sessionCookieOptions() {
  const h = headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";
  const proto = (h.get("x-forwarded-proto") ?? "").split(",")[0]?.trim();
  const secure = process.env.NODE_ENV === "production" || proto === "https";
  // Preview paneli iframe ichida ochiladi; cross-site iframe'da SameSite=Lax
  // cookie yuborilmaydi va login /login ga qaytib turadi. Faqat HTTPS preview
  // hostida SameSite=None ishlatamiz — lokal va production o'zgarmaydi.
  const preview = secure && host.endsWith(".style.dev");

  return {
    httpOnly: true,
    secure,
    sameSite: preview ? ("none" as const) : ("lax" as const),
    path: "/",
    maxAge: SESSION_MAX_AGE,
  };
}

function requestMeta() {
  const h = headers();
  const forwarded = h.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() ?? h.get("x-real-ip") ?? null;
  const userAgent = h.get("user-agent")?.slice(0, 300) ?? null;
  return { ip, userAgent };
}

export interface LoginInput {
  tenantSlug: string;
  phone: string;
  password: string;
}

export async function authenticateUser(
  input: LoginInput,
): Promise<{ user: SessionUser; token: string; expiresAt: Date }> {
  const meta = requestMeta();
  const tenant = await prisma.tenant.findUnique({ where: { slug: input.tenantSlug } });

  if (!tenant || !tenant.isActive) {
    await bcrypt.compare(input.password, DUMMY_HASH);
    throw new ApiError(401, INVALID_CREDENTIALS);
  }

  const result = await withTenantContext(tenant.id, async (tx) => {
    const user = await tx.user.findFirst({
      where: { tenantId: tenant.id, phone: input.phone },
      include: {
        store: { select: { id: true, name: true } },
        role: {
          include: {
            permissions: { include: { permission: { select: { key: true } } } },
          },
        },
      },
    });

    const valid = await bcrypt.compare(input.password, user?.passwordHash ?? DUMMY_HASH);
    if (!user || !valid) throw new ApiError(401, INVALID_CREDENTIALS);
    if (!user.isActive) {
      throw new ApiError(403, "Hisobingiz bloklangan. Biznes egasiga murojaat qiling.");
    }

    const permissions = user.role.permissions.map((rp) => rp.permission.key);
    const expiresAt = new Date(Date.now() + SESSION_MAX_AGE * 1000);

    const session = await tx.session.create({
      data: {
        tenantId: tenant.id,
        userId: user.id,
        ip: meta.ip,
        userAgent: meta.userAgent,
        expiresAt,
      },
    });

    await tx.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    await tx.auditLog.create({
      data: {
        tenantId: tenant.id,
        userId: user.id,
        action: "LOGIN",
        entityType: "User",
        entityId: user.id,
        ip: meta.ip,
        userAgent: meta.userAgent,
      },
    });

    const sessionUser: SessionUser = {
      id: user.id,
      sessionId: session.id,
      tenantId: tenant.id,
      tenantSlug: tenant.slug,
      tenantName: tenant.name,
      name: user.name,
      phone: user.phone,
      roleCode: user.role.code,
      roleName: user.role.name,
      permissions,
      storeId: user.store?.id ?? null,
      storeName: user.store?.name ?? null,
    };

    return { sessionUser, expiresAt };
  });

  const token = await signSessionToken(result.sessionUser);
  return { user: result.sessionUser, token, expiresAt: result.expiresAt };
}

/**
 * JWT + DB sessiyasini tekshiradi (bekor qilingan sessiyalar ishlamaydi).
 * React `cache` bir request ichida bir necha marta chaqirilsa ham DBga bir marta boradi.
 */
export const getSession = cache(async (): Promise<SessionUser | null> => {
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const session = await verifySessionToken(token);
  if (!session) return null;

  const record = await withTenantContext(session.tenantId, (tx) =>
    tx.session.findUnique({
      where: { id: session.sessionId },
      select: { revokedAt: true, expiresAt: true, user: { select: { isActive: true } } },
    }),
  );

  if (!record || record.revokedAt || record.expiresAt.getTime() < Date.now() || !record.user.isActive) {
    return null;
  }

  return session;
});

export async function requireUser(): Promise<SessionUser> {
  const session = await getSession();
  if (!session) throw new ApiError(401, "Avtorizatsiya talab qilinadi. Qaytadan kiring.");
  return session;
}

export async function requirePermission(permission: PermissionKey): Promise<SessionUser> {
  const session = await requireUser();
  if (!can(session.permissions, permission)) {
    throw new ApiError(403, "Bu amal uchun ruxsatingiz yo'q.");
  }
  return session;
}

export async function requirePageUser(permission?: PermissionKey): Promise<SessionUser> {
  const session = await getSession();
  if (!session) redirect("/login");
  if (permission && !can(session.permissions, permission)) redirect("/403");
  return session;
}

export async function revokeSession(session: SessionUser): Promise<void> {
  await withTenantContext(session.tenantId, (tx) =>
    tx.session.updateMany({
      where: { id: session.sessionId, revokedAt: null },
      data: { revokedAt: new Date() },
    }),
  );
}

export async function revokeAllUserSessions(userId: string, tenantId: string): Promise<void> {
  await withTenantContext(tenantId, (tx) =>
    tx.session.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    }),
  );
}
