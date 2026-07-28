import { findRequestByPublicId, getRequestById, markNotification, pendingNotifications } from "@/data/request-repository";
import { DEVICE_LABELS } from "@/lib/domain";
import { maskName, maskPhone } from "@/lib/logic/request-service";
import { getRuntimeString } from "@/lib/runtime-config";

export async function processPendingNotifications(origin: string, limit = 3) {
  const pending = await pendingNotifications(limit);
  for (const outbox of pending) {
    const request = await getRequestById(outbox.request_id);
    if (!request) {
      await markNotification(outbox, "FAILED", "접수 정보를 찾을 수 없습니다.");
      continue;
    }
    await sendRequestNotification(outbox, request.publicId, origin);
  }
}

async function sendRequestNotification(
  outbox: { id: string; request_id: string; attempts: number },
  publicId: string,
  origin: string,
) {
  const token = getRuntimeString("TELEGRAM_BOT_TOKEN");
  const chatId = getRuntimeString("TELEGRAM_CHAT_ID");
  if (!token || !chatId) {
    await markNotification(outbox, "CONFIG_REQUIRED", "텔레그램 환경설정이 필요합니다.");
    return;
  }

  const request = await findRequestByPublicId(publicId);
  if (!request) return;
  const baseUrl = getRuntimeString("PUBLIC_BASE_URL") || origin;
  const text = [
    "🔧 신규 서비스 신청",
    `접수번호: ${request.publicId}`,
    `기기: ${DEVICE_LABELS[request.deviceType]}`,
    `지역: ${request.regionPublic}`,
    `신청자: ${maskName(request.name)}`,
    `연락처: ${maskPhone(request.phone)}`,
    `증상: ${request.symptom.slice(0, 80)}`,
    `관리자 확인: ${baseUrl}/admin/requests/${request.publicId}`,
  ].join("\n");

  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        protect_content: true,
        link_preview_options: { is_disabled: true },
      }),
      signal: AbortSignal.timeout(5_000),
    });
    if (!response.ok) throw new Error(`Telegram HTTP ${response.status}`);
    await markNotification(outbox, "SENT");
  } catch (error) {
    const message = error instanceof Error ? error.message : "알림 전송 실패";
    await markNotification(outbox, "FAILED", message);
  }
}
