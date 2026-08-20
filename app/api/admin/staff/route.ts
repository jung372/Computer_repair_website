import { testStaffTelegramSlot } from "@/infrastructure/telegram";
import { getAdminUser } from "@/lib/admin-auth";
import {
  addStaffToSlot,
  changeSlotStaffPassword,
  deleteUnusedStaffFromSlot,
  editStaffInSlot,
  offboardStaffFromSlot,
  updateStaffSlotSettings,
} from "@/lib/logic/staff-slot-service";
import { assertSameOrigin } from "@/lib/security/request-guard";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const owner = await getAdminUser();
    if (!owner || owner.role !== "OWNER") {
      return Response.json({ error: "운영자 권한이 필요합니다." }, { status: 403 });
    }
    const form = await request.formData();
    const action = String(form.get("action") ?? "");
    const input = Object.fromEntries(form.entries());

    if (action === "save-slot") {
      await updateStaffSlotSettings(owner.id, input);
      return staffRedirect(request, "slot-saved");
    }
    if (action === "test-telegram") {
      await testStaffTelegramSlot(Number(input.slotSerialNo), owner.id);
      return staffRedirect(request, "telegram-tested");
    }
    if (action === "create") {
      await addStaffToSlot(owner.id, input);
      return staffRedirect(request, "created");
    }
    if (action === "edit") {
      await editStaffInSlot(owner.id, input);
      return staffRedirect(request, "updated");
    }
    if (action === "reset-password") {
      await changeSlotStaffPassword(owner.id, input);
      return staffRedirect(request, "password");
    }
    if (action === "offboard") {
      await offboardStaffFromSlot(owner.id, input);
      return staffRedirect(request, "offboarded");
    }
    if (action === "delete") {
      await deleteUnusedStaffFromSlot(owner.id, input);
      return staffRedirect(request, "deleted");
    }
    return staffRedirect(request, undefined, "invalid");
  } catch (error) {
    const code = error instanceof Error ? error.message : "SERVICE_ERROR";
    if (code === "INVALID_ORIGIN") {
      return Response.json({ error: "요청 출처가 올바르지 않습니다." }, { status: 403 });
    }
    return staffRedirect(request, undefined, errorCode(code));
  }
}

function errorCode(code: string) {
  const known = new Set([
    "INVALID_SLOT",
    "INVALID_STAFF_INPUT",
    "INVALID_PHONE",
    "INVALID_CHAT_ID",
    "INVALID_SLOT_LABEL",
    "OWNER_PASSWORD_INVALID",
    "SLOT_OCCUPIED",
    "LOGIN_NAME_EXISTS",
    "STAFF_UPDATE_CONFLICT",
    "STAFF_NOT_FOUND",
    "STAFF_DELETE_NOT_ALLOWED",
    "STAFF_CHAT_ID_NOT_CONFIGURED",
    "TELEGRAM_BOT_TOKEN_NOT_CONFIGURED",
    "STAFF_CHAT_ID_ENCRYPTION_KEY_NOT_CONFIGURED",
  ]);
  return known.has(code) ? code : "SERVICE_ERROR";
}

function staffRedirect(request: Request, status?: string, error?: string) {
  const url = new URL("/admin/staff", request.url);
  if (status) url.searchParams.set("status", status);
  if (error) url.searchParams.set("error", error);
  return Response.redirect(url, 303);
}
