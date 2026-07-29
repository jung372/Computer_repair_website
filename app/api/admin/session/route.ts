import {
  ADMIN_SESSION_COOKIE,
  LEGACY_ADMIN_SESSION_COOKIE,
  authenticateAdminPassword,
  createAdminSessionToken,
  safeAdminReturnPath,
} from "@/lib/admin-auth";
import { getPrimaryAdmin, recordAdminAudit } from "@/data/admin-repository";
import {
  clearAccessFailures,
  getAccessAttempt,
  recordAccessFailure,
} from "@/data/request-repository";
import {
  assertSameOrigin,
  hashClientAddress,
} from "@/lib/security/request-guard";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const form = await request.formData();
    const password = String(form.get("password") ?? "");
    const returnTo = safeAdminReturnPath(String(form.get("returnTo") ?? "/admin"));
    const clientHash = await hashClientAddress(request);
    const key = `admin:${clientHash}`;
    const attempt = await getAccessAttempt(key);

    if (
      attempt?.blocked_until &&
      new Date(attempt.blocked_until).getTime() > Date.now()
    ) {
      return loginRedirect(request, returnTo, "blocked");
    }

    const admin = await authenticateAdminPassword(password, clientHash);
    if (!admin) {
      await recordAccessFailure(key);
      await recordAdminAudit("LOGIN_FAILED", clientHash, (await getPrimaryAdmin())?.id ?? null);
      return loginRedirect(request, returnTo, "invalid");
    }

    await clearAccessFailures(key);
    const response = new Response(null, {
      status: 303,
      headers: { Location: new URL(returnTo, request.url).toString() },
    });
    response.headers.append(
      "Set-Cookie",
      `${ADMIN_SESSION_COOKIE}=${await createAdminSessionToken(admin)}; Path=/; HttpOnly${secureFlag(request)}; SameSite=Strict; Max-Age=28800`,
    );
    response.headers.append(
      "Set-Cookie",
      `${LEGACY_ADMIN_SESSION_COOKIE}=; Path=/; HttpOnly${secureFlag(request)}; SameSite=Strict; Max-Age=0`,
    );
    return response;
  } catch (error) {
    console.error(JSON.stringify({
      message: "Admin login request failed",
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    }));
    return loginRedirect(request, "/admin", "invalid");
  }
}

function secureFlag(request: Request) {
  return new URL(request.url).protocol === "https:" ? "; Secure" : "";
}

function loginRedirect(request: Request, returnTo: string, error: string) {
  const url = new URL("/admin/login", request.url);
  url.searchParams.set("returnTo", returnTo);
  url.searchParams.set("error", error);
  return Response.redirect(url, 303);
}
