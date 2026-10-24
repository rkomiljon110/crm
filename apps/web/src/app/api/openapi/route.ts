import { json } from "@/lib/api";
import { openApiDocument } from "@/lib/openapi";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/openapi — OpenAPI 3.1 shartnomasi (mashina o'qiydigan). */
export async function GET() {
  return json(openApiDocument);
}
