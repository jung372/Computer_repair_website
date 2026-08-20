import { waitUntil } from "cloudflare:workers";
import { getAdminUser } from "@/lib/admin-auth";
import { assignAdminRequest, getAdminRequestRecord } from "@/data/admin-request-repository";
import {
  changeRequestStatus,
  removeRequestPersonalData,
  retryRequestNotification,
} from "@/lib/logic/admin-service";
import { processPendingNotifications } from "@/infrastructure/telegram";
import { assertSameOrigin } from "@/lib/security/request-guard";
import {
  AdminRecordValidationError,
  saveAdminRequestRecord,
} from "@/lib/logic/admin-record-service";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ publicId: string }> },
) {
  try {
    assertSameOrigin(request);
    const admin = await getAdminUser();
    if (!admin) return Response.json({ error: "운영자 권한이 필요합니다." }, { status: 403 });
    const { publicId } = await params;
    const payload = (await request.json()) as {
      action?: string;
      status?: unknown;
      publicNote?: unknown;
      internalNote?: unknown;
      assigneeAccountId?: unknown;
    };

    const visibleRequest = await getAdminRequestRecord(
      publicId,
      admin.role === "STAFF" ? admin.id : undefined,
    );
    if (!visibleRequest) {
      return Response.json({ error: "이 신청 내역에 접근할 권한이 없습니다." }, { status: 403 });
    }

    if (payload.action === "save-record") {
      await saveAdminRequestRecord(publicId, payload, admin);
      return Response.json({ message: "접수 내역을 저장했습니다." });
    }
    if (payload.action === "assign") {
      if (admin.role !== "OWNER") {
        return Response.json({ error: "운영자만 담당자를 배정할 수 있습니다." }, { status: 403 });
      }
      const staffId = typeof payload.assigneeAccountId === "string"
        ? payload.assigneeAccountId.trim() || null
        : null;
      const assignment = await assignAdminRequest(publicId, staffId, admin.id);
      waitUntil(processPendingNotifications(new URL(request.url).origin).catch(() => undefined));
      return Response.json({ message: "담당자 배정을 저장했습니다.", assignment });
    }
    if (payload.action === "update") {
      await changeRequestStatus(publicId, payload, admin.loginName);
      return Response.json({ message: "처리 상태를 저장했습니다." });
    }
    if (payload.action === "retry-notification") {
      if (admin.role !== "OWNER") {
        return Response.json({ error: "운영자만 알림을 재전송할 수 있습니다." }, { status: 403 });
      }
      const found = await retryRequestNotification(publicId);
      if (!found) return Response.json({ error: "신청을 찾을 수 없습니다." }, { status: 404 });
      await processPendingNotifications(new URL(request.url).origin);
      return Response.json({ message: "텔레그램 알림을 다시 처리했습니다." });
    }
    if (payload.action === "anonymize") {
      if (admin.role !== "OWNER") {
        return Response.json({ error: "운영자만 개인정보를 삭제할 수 있습니다." }, { status: 403 });
      }
      const removed = await removeRequestPersonalData(publicId, admin.loginName);
      if (!removed) return Response.json({ error: "신청을 찾을 수 없습니다." }, { status: 404 });
      return Response.json({ message: "개인정보를 삭제했습니다." });
    }
    return Response.json({ error: "지원하지 않는 작업입니다." }, { status: 400 });
  } catch (error) {
    if (error instanceof AdminRecordValidationError) {
      return Response.json(
        { error: error.message, fields: error.fields },
        { status: 400 },
      );
    }
    const code = error instanceof Error ? error.message : "UNKNOWN";
    const messages: Record<string, string> = {
      INVALID_ORIGIN: "요청 출처가 올바르지 않습니다.",
      NOT_FOUND: "신청을 찾을 수 없습니다.",
      INVALID_STATUS: "올바른 상태를 선택해 주세요.",
      INVALID_TRANSITION: "현재 상태에서 변경할 수 없는 단계입니다.",
      INVALID_ASSIGNEE: "활성 상태인 직원을 선택해 주세요.",
      REOPEN_REASON_REQUIRED: "완료된 접수를 다시 열 때 고객 공개 사유가 필요합니다.",
    };
    return Response.json(
      { error: messages[code] ?? "작업을 처리하지 못했습니다." },
      { status: code === "INVALID_ORIGIN" ? 403 : 400 },
    );
  }
}
