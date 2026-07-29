import { createPrimaryAdmin, getPrimaryAdmin, recordAdminAudit } from "@/data/admin-repository";
import {
  clearAccessFailures,
  getAccessAttempt,
  recordAccessFailure,
} from "@/data/request-repository";
import { getRuntimeString } from "@/lib/runtime-config";
import { constantTimeEqualStrings } from "@/lib/security/constant-time";
import { hashPassword } from "@/lib/security/password";
import { assertSameOrigin, hashClientAddress } from "@/lib/security/request-guard";

export async function POST(request: Request) {
  let clientHash = "";
  try {
    assertSameOrigin(request);
    if (await getPrimaryAdmin()) return setupRedirect(request, "conflict");
    clientHash = await hashClientAddress(request);
    const key = `admin-setup:${clientHash}`;
    const attempt = await getAccessAttempt(key);
    if (attempt?.blocked_until && new Date(attempt.blocked_until).getTime() > Date.now()) {
      return setupRedirect(request, "blocked");
    }

    const expectedToken = getRuntimeString("ADMIN_SETUP_TOKEN");
    if (!expectedToken) return setupRedirect(request, "config");
    const form = await request.formData();
    const setupToken = String(form.get("setupToken") ?? "");
    const newPassword = String(form.get("newPassword") ?? "");
    const confirmPassword = String(form.get("confirmPassword") ?? "");
    const length = Array.from(newPassword).length;
    if (
      !setupToken ||
      !constantTimeEqualStrings(setupToken, expectedToken) ||
      length < 12 ||
      length > 64 ||
      newPassword !== confirmPassword
    ) {
      await recordAccessFailure(key);
      await recordAdminAudit("SETUP_FAILED", clientHash);
      return setupRedirect(request, "invalid");
    }

    await createPrimaryAdmin(await hashPassword(newPassword), clientHash);
    await clearAccessFailures(key);
    const url = new URL("/admin/login", request.url);
    url.searchParams.set("setup", "done");
    return Response.redirect(url, 303);
  } catch {
    if (await getPrimaryAdmin().catch(() => null)) return setupRedirect(request, "conflict");
    await recordAdminAudit("SETUP_FAILED", clientHash || null).catch(() => undefined);
    return setupRedirect(request, "invalid");
  }
}

function setupRedirect(request: Request, error: string) {
  const url = new URL("/admin/setup", request.url);
  url.searchParams.set("error", error);
  return Response.redirect(url, 303);
}
