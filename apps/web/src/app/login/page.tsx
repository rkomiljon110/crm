import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { homePathForPermissions } from "@repo/shared";
import { getSession } from "@/lib/auth";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Tizimga kirish" };
export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const session = await getSession();
  if (session) redirect(homePathForPermissions(session.permissions));
  return <LoginForm />;
}
