import { prisma } from "@repo/database";
import { handle, json } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return handle(async () => {
    const startedAt = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    return json({
      status: "ok",
      database: "up",
      latencyMs: Date.now() - startedAt,
      time: new Date().toISOString(),
    });
  });
}
