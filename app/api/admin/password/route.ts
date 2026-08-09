import { changeAccountPassword, getAdminAccountById, recordAdminAudit } from "@/data/admin-repository";
import {
  clearAccessFailures,
  getAccessAttempt,
  recordAccessFailure,
} from "@/data/request-repository";
import {
  ADMIN_SESSION_COOKIE,
  LEGACY_ADMIN_SESSION_COOKIE,
  getAdminUser,
} from "@/lib/admin-auth";
import { hashPassword, verifyPassword } from "@/lib/security/password";
import { isValidStaffPassword } from "@/lib/account-policy";
import { assertSameOrigin, hashClientAddress } from "@/lib/security/request-guard";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const user = await getAdminUser();
    if (!user) return Response.redirect(new URL("/admin/login", request.url), 303);
    const clientHash = await hashClientAddress(request);
    const key = `admin-password:${user.id}:${clientHash}`;
    const attempt = await getAccessAttempt(key);
    if (attempt?.blocked_until && new Date(attempt.blocked_until).getTime() > Date.now()) {
      return errorRedirect(request, "blocked");
    }
    const account = await getAdminAccountById(user.id);
    if (!account?.isActive) return Response.redirect(new URL("/admin/login", request.url), 303);
    const form = await request.formData();
    const currentPassword = String(form.get("currentPassword") ?? "");
    const newPassword = String(form.get("newPassword") ?? "");
    const confirmPassword = String(form.get("confirmPassword") ?? "");

    if (!(await verifyPassword(currentPassword, account.passwordHash))) {
      await recordAccessFailure(key);
      await recordAdminAudit("PASSWORD_CHANGE_FAILED", clientHash, account.id);
      return errorRedirect(request, "current");
    }
    if (await verifyPassword(newPassword, account.passwordHash)) {
      return errorRedirect(request, "same");
    }
    const length = Array.from(newPassword).length;
    const validForRole = account.role === "OWNER"
      ? length >= 12 && length <= 64
      : isValidStaffPassword(newPassword);
    if (!validForRole || newPassword !== confirmPassword) {
      return errorRedirect(request, "invalid");
    }

    await changeAccountPassword(account.id, await hashPassword(newPassword), clientHash);
    await clearAccessFailures(key);
    const url = new URL("/admin/login", request.url);
    url.searchParams.set("changed", "done");
    const response = new Response(null, {
      status: 303,
      headers: { Location: url.toString() },
    });
    const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
    for (const cookieName of [ADMIN_SESSION_COOKIE, LEGACY_ADMIN_SESSION_COOKIE]) {
      response.headers.append(
        "Set-Cookie",
        `${cookieName}=; Path=/; HttpOnly${secure}; SameSite=Strict; Max-Age=0`,
      );
    }
    return response;
  } catch {
    return errorRedirect(request, "invalid");
  }
}

function errorRedirect(request: Request, error: string) {
  const url = new URL("/admin/settings/security", request.url);
  url.searchParams.set("error", error);
  return Response.redirect(url, 303);
}
