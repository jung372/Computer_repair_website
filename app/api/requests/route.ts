import { waitUntil } from "cloudflare:workers";
import {
  CUSTOMER_LOOKUP_COOKIE,
  createCustomerLookupSession,
} from "@/data/customer-lookup-repository";
import { processPendingNotifications } from "@/infrastructure/telegram";
import { getRuntimeString } from "@/lib/runtime-config";
import {
  createServiceRequest,
  RequestValidationError,
} from "@/lib/logic/request-service";
import {
  getAccessAttempt,
  recordAccessFailure,
} from "@/data/request-repository";
import { assertSameOrigin, hashClientAddress } from "@/lib/security/request-guard";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    if (getRuntimeString("REQUEST_SUBMISSION_ENABLED").toLowerCase() === "false") {
      return Response.json(
        { error: "현재 접수 시스템을 점검하고 있습니다. 잠시 후 다시 시도해 주세요." },
        { status: 503 },
      );
    }
    const submissionKey = `request-submit:${await hashClientAddress(request)}`;
    const submissionAttempt = await getAccessAttempt(submissionKey);
    if (
      submissionAttempt?.blocked_until &&
      new Date(submissionAttempt.blocked_until).getTime() > Date.now()
    ) {
      return Response.json(
        { error: "접수 요청이 많습니다. 15분 뒤 다시 시도해 주세요." },
        { status: 429 },
      );
    }
    if (!request.headers.get("content-type")?.includes("application/json")) {
      return Response.json({ error: "지원하지 않는 요청 형식입니다." }, { status: 415 });
    }
    const payload = await request.json();
    const created = await createServiceRequest(payload);
    await recordAccessFailure(submissionKey);
    const session = await createCustomerLookupSession([created.id]).catch(() => null);
    // Telegram can take seconds to answer, so the customer gets their receipt
    // number immediately and the notification finishes after the response.
    waitUntil(processPendingNotifications(new URL(request.url).origin).catch(() => undefined));
    const headers = new Headers({ "Cache-Control": "private, no-store" });
    if (session) {
      const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
      headers.append(
        "Set-Cookie",
        `${CUSTOMER_LOOKUP_COOKIE}=${session.token}; Path=/requests; Max-Age=600; HttpOnly${secure}; SameSite=Lax`,
      );
    }
    return Response.json({ publicId: created.publicId }, { status: 201, headers });
  } catch (error) {
    if (error instanceof RequestValidationError) {
      return Response.json(
        { error: error.message, fields: error.fields },
        { status: 400 },
      );
    }
    if (error instanceof Error && error.message === "INVALID_ORIGIN") {
      return Response.json({ error: "요청 출처를 확인할 수 없습니다." }, { status: 403 });
    }
    const code = error instanceof Error ? error.message : "";
    if (
      code === "REQUEST_LOOKUP_SECRET_NOT_CONFIGURED" ||
      code === "REQUEST_LOOKUP_SECRET_MISMATCH" ||
      code === "REQUEST_LOOKUP_SECRET_CHECK_MISSING" ||
      code === "RATE_LIMIT_SECRET_NOT_CONFIGURED"
    ) {
      return Response.json(
        { error: "현재 접수 시스템을 점검하고 있습니다. 잠시 후 다시 시도해 주세요." },
        { status: 503 },
      );
    }
    return Response.json(
      { error: "신청을 저장하지 못했습니다. 잠시 후 다시 시도해 주세요." },
      { status: 500 },
    );
  }
}
