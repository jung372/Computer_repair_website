import { processPendingNotifications } from "@/infrastructure/telegram";
import {
  createServiceRequest,
  RequestValidationError,
} from "@/lib/logic/request-service";
import { assertSameOrigin } from "@/lib/security/request-guard";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    if (!request.headers.get("content-type")?.includes("application/json")) {
      return Response.json({ error: "지원하지 않는 요청 형식입니다." }, { status: 415 });
    }
    const payload = await request.json();
    const created = await createServiceRequest(payload);
    await processPendingNotifications(new URL(request.url).origin);
    return Response.json({ publicId: created.publicId }, { status: 201 });
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
    return Response.json(
      { error: "신청을 저장하지 못했습니다. 잠시 후 다시 시도해 주세요." },
      { status: 500 },
    );
  }
}
