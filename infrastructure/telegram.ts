import {
  cancelNotification,
  getRequestById,
  markNotification,
  pendingNotifications,
  type OutboxRow,
} from "@/data/request-repository";
import {
  getStaffSlotChatId,
  getStaffTelegramRecipient,
  markStaffSlotVerified,
} from "@/data/staff-slot-repository";
import { DEVICE_LABELS, type ServiceRequestRecord } from "@/lib/domain";
import { getInitialNotificationStatus } from "@/lib/notification-config";
import { getRuntimeString } from "@/lib/runtime-config";

export async function processPendingNotifications(origin: string, limit = 3) {
  const pending = await pendingNotifications(limit);
  for (const outbox of pending) {
    const request = await getRequestById(outbox.request_id);
    if (!request) {
      await markNotification(outbox, "FAILED", "접수 정보를 찾을 수 없습니다.");
      continue;
    }
    await sendRequestNotification(outbox, request, origin);
  }
}

async function sendRequestNotification(
  outbox: OutboxRow,
  request: ServiceRequestRecord,
  origin: string,
) {
  const token = getRuntimeString("TELEGRAM_BOT_TOKEN");
  let chatId = "";
  if (outbox.event_type === "STAFF_ASSIGNED") {
    if (!token) {
      await markNotification(outbox, "CONFIG_REQUIRED", "텔레그램 Bot Token 설정이 필요합니다.");
      return;
    }
    if (!outbox.recipient_account_id) {
      await cancelNotification(outbox.id, "직원 수신 대상이 없습니다.");
      return;
    }
    chatId = await getStaffTelegramRecipient(outbox.recipient_account_id, outbox.request_id) ?? "";
    if (!chatId) {
      await cancelNotification(outbox.id, "현재 담당자 또는 직원 Telegram 설정이 변경되었습니다.");
      return;
    }
  } else {
    const configuredStatus = getInitialNotificationStatus();
    if (configuredStatus !== "PENDING") {
      await markNotification(
        outbox,
        configuredStatus,
        configuredStatus === "CONFIG_REQUIRED" ? "텔레그램 환경설정이 필요합니다." : undefined,
      );
      return;
    }
    chatId = getRuntimeString("TELEGRAM_CHAT_ID");
  }

  const baseUrl = getRuntimeString("PUBLIC_BASE_URL") || origin;
  const text = buildRequestNotificationText(request, baseUrl);
  try {
    const messageId = await sendTelegramMessage(token, chatId, text);
    await markNotification(outbox, "SENT", undefined, messageId);
  } catch (error) {
    const message = error instanceof Error ? error.message : "알림 전송 실패";
    await markNotification(outbox, "FAILED", message);
  }
}

export function buildRequestNotificationText(request: ServiceRequestRecord, baseUrl: string) {
  return [
    "🔧 신규 서비스 신청",
    `접수번호: ${request.publicId}`,
    `기기: ${DEVICE_LABELS[request.deviceType]}`,
    `지역: ${request.regionPublic}`,
    `신청자: ${request.name}`,
    `연락처: ${request.phone}`,
    `증상: ${request.symptom.slice(0, 80)}`,
    `관리자 확인: ${baseUrl}/admin/requests/${request.publicId}`,
  ].join("\n");
}

async function sendTelegramMessage(token: string, chatId: string, text: string) {
  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      protect_content:
        getRuntimeString("TELEGRAM_CONTENT_PROTECTION_ENABLED").toLowerCase() === "true",
      link_preview_options: { is_disabled: true },
    }),
    signal: AbortSignal.timeout(5_000),
  });
  if (!response.ok) throw new Error(`Telegram HTTP ${response.status}`);
  const payload: unknown = await response.json();
  if (
    typeof payload !== "object" || payload === null || !("result" in payload) ||
    typeof payload.result !== "object" || payload.result === null ||
    !("message_id" in payload.result)
  ) return undefined;
  const messageId = payload.result.message_id;
  return typeof messageId === "number" || typeof messageId === "string"
    ? String(messageId)
    : undefined;
}

export async function testStaffTelegramSlot(slotSerialNo: number, changedBy: string) {
  const token = getRuntimeString("TELEGRAM_BOT_TOKEN");
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN_NOT_CONFIGURED");
  const chatId = await getStaffSlotChatId(slotSerialNo);
  if (!chatId) throw new Error("STAFF_CHAT_ID_NOT_CONFIGURED");
  await sendTelegramMessage(
    token,
    chatId,
    `✅ 컴박사 직원 슬롯 S-${String(slotSerialNo).padStart(4, "0")} 알림 연결 테스트`,
  );
  await markStaffSlotVerified(slotSerialNo, changedBy);
}
