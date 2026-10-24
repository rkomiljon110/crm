import { SignJWT, jwtVerify } from "jose";
import type { SessionUser } from "@/lib/types";

const ALG = "HS256";

function secretKey(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("AUTH_SECRET o'rnatilmagan yoki 32 belgidan qisqa. .env faylni tekshiring.");
  }
  return new TextEncoder().encode(secret);
}

export async function signSessionToken(user: SessionUser): Promise<string> {
  return new SignJWT({
    sessionId: user.sessionId,
    tenantId: user.tenantId,
    tenantSlug: user.tenantSlug,
    tenantName: user.tenantName,
    name: user.name,
    phone: user.phone,
    roleCode: user.roleCode,
    roleName: user.roleName,
    permissions: user.permissions,
    storeId: user.storeId,
    storeName: user.storeName,
  })
    .setProtectedHeader({ alg: ALG })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secretKey());
}

export async function verifySessionToken(token: string): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey(), { algorithms: [ALG] });
    const permissions = Array.isArray(payload.permissions)
      ? payload.permissions.filter((p): p is string => typeof p === "string")
      : [];

    if (
      !payload.sub ||
      typeof payload.sessionId !== "string" ||
      typeof payload.tenantId !== "string" ||
      typeof payload.tenantSlug !== "string" ||
      typeof payload.roleCode !== "string"
    ) {
      return null;
    }

    return {
      id: payload.sub,
      sessionId: payload.sessionId,
      tenantId: payload.tenantId,
      tenantSlug: payload.tenantSlug,
      tenantName: String(payload.tenantName ?? ""),
      name: String(payload.name ?? ""),
      phone: String(payload.phone ?? ""),
      roleCode: payload.roleCode,
      roleName: String(payload.roleName ?? ""),
      permissions,
      storeId: typeof payload.storeId === "string" ? payload.storeId : null,
      storeName: typeof payload.storeName === "string" ? payload.storeName : null,
    };
  } catch {
    return null;
  }
}

export const SESSION_COOKIE = "savdo_session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 7; // 7 kun (soniya)
