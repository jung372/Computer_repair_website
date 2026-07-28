import { chatGPTSignInPath, getChatGPTUser, requireChatGPTUser } from "@/app/chatgpt-auth";
import { redirect } from "next/navigation";
import { getRuntimeString, isDevelopment } from "./runtime-config";

export type AdminUser = { email: string; displayName: string };

function allowedEmails() {
  return getRuntimeString("ADMIN_EMAILS")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export async function getAdminUser(): Promise<AdminUser | null> {
  const user = await getChatGPTUser();
  if (!user && isDevelopment()) {
    return { email: "local-admin@localhost", displayName: "로컬 관리자" };
  }
  if (!user) return null;
  const allowlist = allowedEmails();
  if (!allowlist.includes(user.email.toLowerCase())) return null;
  return { email: user.email, displayName: user.displayName };
}

export async function requireAdmin(returnTo: string): Promise<AdminUser> {
  if (isDevelopment()) {
    const user = await getAdminUser();
    if (user) return user;
  }
  const user = await requireChatGPTUser(returnTo);
  const allowlist = allowedEmails();
  if (!allowlist.includes(user.email.toLowerCase())) {
    redirect("/admin/denied");
  }
  return { email: user.email, displayName: user.displayName };
}

export function adminSignInPath() {
  return chatGPTSignInPath("/admin");
}
