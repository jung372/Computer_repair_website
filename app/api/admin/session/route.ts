import {
  ADMIN_SESSION_COOKIE,
  createAdminSessionToken,
  safeAdminReturnPath,
  verifyAdminPassword,
} from "@/lib/admin-auth";
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
    const key = `admin:${await hashClientAddress(request)}`;
    const attempt = await getAccessAttempt(key);

    if (
      attempt?.blocked_until &&
      new Date(attempt.blocked_until).getTime() > Date.now()
    ) {
      return loginRedirect(request, returnTo, "blocked");
    }

    if (!(await verifyAdminPassword(password))) {
      await recordAccessFailure(key, Number(attempt?.failures ?? 0));
      return loginRedirect(request, returnTo, "invalid");
    }

    await clearAccessFailures(key);
    const response = Response.redirect(new URL(returnTo, request.url), 303);
    response.headers.append(
      "Set-Cookie",
      `${ADMIN_SESSION_COOKIE}=${await createAdminSessionToken()}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=28800`,
    );
    return response;
  } catch {
    return loginRedirect(request, "/admin", "invalid");
  }
}

function loginRedirect(request: Request, returnTo: string, error: string) {
  const url = new URL("/admin/login", request.url);
  url.searchParams.set("returnTo", returnTo);
  url.searchParams.set("error", error);
  return Response.redirect(url, 303);
}
