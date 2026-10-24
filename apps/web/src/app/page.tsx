import { redirect } from "next/navigation";
import { homePathForPermissions } from "@repo/shared";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function RootPage() {
  const session = await getSession();
  redirect(session ? homePathForPermissions(session.permissions) : "/login");
}
