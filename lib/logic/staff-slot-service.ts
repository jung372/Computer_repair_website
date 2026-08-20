import { getAdminAccountById } from "@/data/admin-repository";
import {
  createStaffInSlot,
  offboardSlotStaff,
  permanentlyDeleteUnusedStaff,
  resetSlotStaffPassword,
  saveStaffSlot,
  updateStaffInSlot,
} from "@/data/staff-slot-repository";
import {
  isValidStaffLoginName,
  isValidStaffPassword,
  normalizeLoginName,
} from "@/lib/account-policy";
import { formatPhone, normalizePhone } from "@/lib/phone";
import { hashPassword, verifyPassword } from "@/lib/security/password";

function text(value: FormDataEntryValue | null | unknown, maximum: number) {
  return typeof value === "string" ? value.trim().slice(0, maximum) : "";
}

function slotNumber(value: unknown) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 3) throw new Error("INVALID_SLOT");
  return parsed;
}

function staffName(value: unknown) {
  const name = text(value, 30);
  if (!name) throw new Error("INVALID_STAFF_INPUT");
  return name;
}

function staffPhone(value: unknown) {
  const raw = text(value, 30);
  const digits = normalizePhone(raw);
  if (raw && ![10, 11].includes(digits.length)) throw new Error("INVALID_PHONE");
  return digits ? formatPhone(digits) : "";
}

function staffLogin(value: unknown) {
  const loginName = normalizeLoginName(value);
  if (!isValidStaffLoginName(loginName)) throw new Error("INVALID_STAFF_INPUT");
  return loginName;
}

function staffPassword(value: unknown) {
  const password = typeof value === "string" ? value : "";
  if (!isValidStaffPassword(password)) throw new Error("INVALID_STAFF_INPUT");
  return password;
}

async function verifyOwnerPassword(ownerId: string, value: unknown) {
  const owner = await getAdminAccountById(ownerId);
  const password = typeof value === "string" ? value : "";
  if (!owner || owner.role !== "OWNER" || !(await verifyPassword(password, owner.passwordHash))) {
    throw new Error("OWNER_PASSWORD_INVALID");
  }
}

export async function updateStaffSlotSettings(
  ownerId: string,
  input: Record<string, unknown>,
) {
  const chatId = text(input.chatId, 32);
  const clearChatId = input.clearChatId === "on" || input.clearChatId === true;
  if (chatId || clearChatId) await verifyOwnerPassword(ownerId, input.currentPassword);
  if (chatId && !/^-?\d{5,20}$/.test(chatId)) throw new Error("INVALID_CHAT_ID");
  const label = text(input.label, 40);
  if (!label) throw new Error("INVALID_SLOT_LABEL");
  await saveStaffSlot({
    slotSerialNo: slotNumber(input.slotSerialNo),
    label,
    chatId: chatId || undefined,
    clearChatId,
    telegramEnabled: input.telegramEnabled === "on" || input.telegramEnabled === true,
    changedBy: ownerId,
  });
}

export async function addStaffToSlot(ownerId: string, input: Record<string, unknown>) {
  return createStaffInSlot({
    slotSerialNo: slotNumber(input.slotSerialNo),
    loginName: staffLogin(input.loginName),
    displayName: staffName(input.displayName),
    phone: staffPhone(input.phone),
    passwordHash: await hashPassword(staffPassword(input.password)),
    changedBy: ownerId,
  });
}

export async function editStaffInSlot(ownerId: string, input: Record<string, unknown>) {
  await verifyOwnerPassword(ownerId, input.currentPassword);
  const accountId = text(input.accountId, 80);
  if (!accountId) throw new Error("STAFF_NOT_FOUND");
  await updateStaffInSlot({
    accountId,
    loginName: staffLogin(input.loginName),
    displayName: staffName(input.displayName),
    phone: staffPhone(input.phone),
    changedBy: ownerId,
  });
}

export async function changeSlotStaffPassword(ownerId: string, input: Record<string, unknown>) {
  await verifyOwnerPassword(ownerId, input.currentPassword);
  const accountId = text(input.accountId, 80);
  if (!accountId) throw new Error("STAFF_NOT_FOUND");
  await resetSlotStaffPassword(
    accountId,
    await hashPassword(staffPassword(input.password)),
    ownerId,
  );
}

export async function offboardStaffFromSlot(ownerId: string, input: Record<string, unknown>) {
  await verifyOwnerPassword(ownerId, input.currentPassword);
  await offboardSlotStaff(text(input.accountId, 80), ownerId);
}

export async function deleteUnusedStaffFromSlot(ownerId: string, input: Record<string, unknown>) {
  await verifyOwnerPassword(ownerId, input.currentPassword);
  await permanentlyDeleteUnusedStaff(
    text(input.accountId, 80),
    text(input.confirmation, 30),
    ownerId,
  );
}
