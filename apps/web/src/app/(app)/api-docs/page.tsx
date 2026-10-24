import type { Metadata } from "next";
import { requirePageUser } from "@/lib/auth";
import { ApiExplorer } from "@/components/api-explorer";

export const metadata: Metadata = { title: "API interfeysi" };
export const dynamic = "force-dynamic";

export default async function ApiDocsPage() {
  const user = await requirePageUser();

  return (
    <ApiExplorer
      user={{
        name: user.name,
        roleCode: user.roleCode,
        roleName: user.roleName,
        permissions: user.permissions,
      }}
    />
  );
}
