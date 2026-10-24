import { assertSameOrigin, handle, json } from "@/lib/api";
import { getSession, revokeSession, sessionCookieOptions } from "@/lib/auth";
import { SESSION_COOKIE } from "@/lib/jwt";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return handle(async () => {
    assertSameOrigin(request);

    const session = await getSession();
    if (session) {
      await revokeSession(session);
    }

    const response = json({ ok: true });
    response.cookies.set(SESSION_COOKIE, "", { ...sessionCookieOptions(), maxAge: 0 });
    return response;
  });
}
