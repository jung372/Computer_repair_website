import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireOwner } from "@/lib/admin-auth";

export const metadata: Metadata = { title: "수리일지 생성", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function NewMarketingJobPage() {
  await requireOwner("/admin/marketing/new");
  redirect("/admin/marketing");
}
