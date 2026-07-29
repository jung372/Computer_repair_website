import { ADMIN_SESSION_COOKIE } from "@/lib/admin-auth";
import { assertSameOrigin } from "@/lib/security/request-guard";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
  } catch {
    return Response.json({ error: "요청 출처가 올바르지 않습니다." }, { status: 403 });
  }

  const response = Response.redirect(new URL("/admin/login", request.url), 303);
  response.headers.append(
    "Set-Cookie",
    `${ADMIN_SESSION_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`,
  );
  return response;
}
