import {
  cancelNotification,
  getRequestById,
  markNotification,
  markTelegramDeleted,
  markTelegramDeleteFailed,
  pendingTelegramDeletions,
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
import { sha256 } from "@/lib/security/keyed-hash";

const TELEGRAM_PII_RETENTION_MS = 24 * 60 * 60 * 1000;

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
  const isOwnerNotification = outbox.event_type === "NEW_REQUEST";
  if (isOwnerNotification) {
    const fullMode = getRuntimeString("TELEGRAM_PII_MODE").toUpperCase() === "FULL";
    const protectedContent =
      getRuntimeString("TELEGRAM_CONTENT_PROTECTION_ENABLED").toLowerCase() === "true";
    if (!fullMode || !protectedContent) {
      await markNotification(
        outbox,
        "CONFIG_REQUIRED",
        "보호된 운영자 Telegram 알림 설정이 필요합니다.",
      );
      return;
    }
    if (!await isPrivateTelegramChat(token, chatId)) {
      await markNotification(
        outbox,
        "CONFIG_REQUIRED",
        "운영자 Telegram 수신 대상은 1:1 비공개 채팅이어야 합니다.",
      );
      return;
    }
  }

  const text = isOwnerNotification
    ? buildOwnerRequestNotificationText(request, baseUrl)
    : buildStaffAssignmentNotificationText(request, baseUrl);
  try {
    const messageId = await sendTelegramMessage(token, chatId, text, isOwnerNotification);
    const retention = isOwnerNotification && messageId
      ? {
          chatIdHash: await sha256(chatId),
          deleteAfter: new Date(Date.now() + TELEGRAM_PII_RETENTION_MS).toISOString(),
        }
      : undefined;
    await markNotification(outbox, "SENT", undefined, messageId, retention);
  } catch (error) {
    const message = error instanceof Error ? error.message : "알림 전송 실패";
    await markNotification(outbox, "FAILED", message);
  }
}

export function buildOwnerRequestNotificationText(request: ServiceRequestRecord, baseUrl: string) {
  return [
    "🔧 신규 서비스 신청",
    `접수번호: ${request.publicId}`,
    `기기: ${DEVICE_LABELS[request.deviceType]}`,
    `기본주소: ${request.address1}`,
    `휴대폰: ${request.phone}`,
    `기본 증상: ${request.symptom.slice(0, 120)}`,
    `관리자 확인: ${baseUrl}/admin/requests/${request.publicId}`,
  ].join("\n");
}

export function buildStaffAssignmentNotificationText(
  request: ServiceRequestRecord,
  baseUrl: string,
) {
  return [
    "🔧 서비스 접수 담당자 배정",
    `접수번호: ${request.publicId}`,
    `기기: ${DEVICE_LABELS[request.deviceType]}`,
    `직원 메뉴에서 확인: ${baseUrl}/admin/requests/${request.publicId}`,
  ].join("\n");
}

async function sendTelegramMessage(
  token: string,
  chatId: string,
  text: string,
  protectContent = false,
) {
  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      protect_content: protectContent,
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
  ) throw new Error("Telegram 응답에서 메시지 ID를 확인할 수 없습니다.");
  const messageId = payload.result.message_id;
  if (typeof messageId !== "number" && typeof messageId !== "string") {
    throw new Error("Telegram 응답의 메시지 ID 형식이 올바르지 않습니다.");
  }
  return String(messageId);
}

async function isPrivateTelegramChat(token: string, chatId: string) {
  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/getChat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ chat_id: chatId }),
      signal: AbortSignal.timeout(5_000),
    });
    if (!response.ok) return false;
    const payload: unknown = await response.json();
    return Boolean(
      typeof payload === "object" && payload !== null && "result" in payload &&
        typeof payload.result === "object" && payload.result !== null &&
        "type" in payload.result && payload.result.type === "private",
    );
  } catch {
    return false;
  }
}

export async function deleteExpiredTelegramNotifications(limit = 10) {
  const token = getRuntimeString("TELEGRAM_BOT_TOKEN");
  const chatId = getRuntimeString("TELEGRAM_CHAT_ID");
  if (!token || !chatId) return;
  const chatIdHash = await sha256(chatId);
  const pending = await pendingTelegramDeletions(limit);

  for (const outbox of pending) {
    if (outbox.telegram_chat_id_hash !== chatIdHash) {
      await markTelegramDeleteFailed(outbox.id, "현재 운영자 Chat ID와 전송 대상이 일치하지 않습니다.");
      continue;
    }
    try {
      const messageId = Number(outbox.telegram_message_id);
      if (!Number.isSafeInteger(messageId) || messageId <= 0) {
        throw new Error("저장된 Telegram 메시지 ID가 올바르지 않습니다.");
      }
      const response = await fetch(`https://api.telegram.org/bot${token}/deleteMessage`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          message_id: messageId,
        }),
        signal: AbortSignal.timeout(5_000),
      });
      if (!response.ok) throw new Error(`Telegram HTTP ${response.status}`);
      await markTelegramDeleted(outbox.id);
    } catch (error) {
      await markTelegramDeleteFailed(
        outbox.id,
        error instanceof Error ? error.message : "Telegram 알림 자동 삭제 실패",
      );
    }
  }
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
    true,
  );
  await markStaffSlotVerified(slotSerialNo, changedBy);
}
