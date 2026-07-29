import { CUSTOMER_LOOKUP_COOKIE, deleteCustomerLookupSession } from "@/data/customer-lookup-repository";
import { isDevelopment } from "@/lib/runtime-config";
import { assertSameOrigin } from "@/lib/security/request-guard";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const cookieHeader = request.headers.get("cookie") ?? "";
    const token = cookieHeader
      .split(";")
      .map((part) => part.trim().split("="))
      .find(([name]) => name === CUSTOMER_LOOKUP_COOKIE)?.[1];
    await deleteCustomerLookupSession(token);
    const response = new Response(null, {
      status: 303,
      headers: { Location: new URL("/requests", request.url).toString() },
    });
    const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
    response.headers.append(
      "Set-Cookie",
      `${CUSTOMER_LOOKUP_COOKIE}=; Path=/requests; Max-Age=0; HttpOnly${secure}; SameSite=Lax`,
    );
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  } catch (error) {
    return Response.json(
      {
        error: "조회 세션을 종료하지 못했습니다.",
        ...(isDevelopment() && error instanceof Error ? { detail: error.message } : {}),
      },
      { status: 403 },
    );
  }
}
