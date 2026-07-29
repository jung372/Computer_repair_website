import { CUSTOMER_LOOKUP_COOKIE } from "@/data/customer-lookup-repository";
import {
  authenticateCustomerLookup,
  CustomerLookupError,
} from "@/lib/logic/customer-lookup";
import {
  assertSameOrigin,
  hashClientAddress,
  hashLookupPhone,
} from "@/lib/security/request-guard";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    if (!request.headers.get("content-type")?.includes("application/json")) {
      return Response.json({ error: "지원하지 않는 요청 형식입니다." }, { status: 415 });
    }
    const payload = (await request.json()) as { phone?: unknown; password?: unknown };
    const phone = typeof payload.phone === "string" ? payload.phone : "";
    const session = await authenticateCustomerLookup(
      payload,
      await hashClientAddress(request),
      await hashLookupPhone(phone),
    );
    const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
    return Response.json(
      { ok: true },
      {
        headers: {
          "Set-Cookie": `${CUSTOMER_LOOKUP_COOKIE}=${session.token}; Path=/requests; Max-Age=600; HttpOnly${secure}; SameSite=Lax`,
          "Cache-Control": "private, no-store",
        },
      },
    );
  } catch (error) {
    if (error instanceof CustomerLookupError) {
      if (error.code === "BLOCKED") {
        return Response.json(
          { error: "입력 횟수를 초과했습니다. 15분 뒤 다시 시도해 주세요." },
          { status: 429 },
        );
      }
      return Response.json({ error: "입력 정보를 확인해 주세요." }, { status: 401 });
    }
    const code = error instanceof Error ? error.message : "";
    if (
      code === "REQUEST_LOOKUP_SECRET_NOT_CONFIGURED" ||
      code === "REQUEST_LOOKUP_SECRET_MISMATCH" ||
      code === "REQUEST_LOOKUP_SECRET_CHECK_MISSING" ||
      code === "RATE_LIMIT_SECRET_NOT_CONFIGURED"
    ) {
      return Response.json(
        { error: "현재 조회 기능을 점검하고 있습니다. 잠시 후 다시 시도해 주세요." },
        { status: 503 },
      );
    }
    return Response.json({ error: "조회 중 오류가 발생했습니다." }, { status: 500 });
  }
}
