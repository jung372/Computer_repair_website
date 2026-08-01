import {
  createStaffAccount,
  resetStaffPassword,
  setStaffActive,
} from "@/data/admin-repository";
import {
  isValidStaffLoginName,
  isValidStaffPassword,
  normalizeLoginName,
} from "@/lib/account-policy";
import { getAdminUser } from "@/lib/admin-auth";
import { hashPassword } from "@/lib/security/password";
import { formatPhone, normalizePhone } from "@/lib/phone";
import { assertSameOrigin, hashClientAddress } from "@/lib/security/request-guard";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const owner = await getAdminUser();
    if (!owner || owner.role !== "OWNER") {
      return Response.json({ error: "운영자 권한이 필요합니다." }, { status: 403 });
    }
    const form = await request.formData();
    const action = String(form.get("action") ?? "");
    const clientHash = await hashClientAddress(request);

    if (action === "create") {
      const loginName = normalizeLoginName(form.get("loginName"));
      const displayName = clean(form.get("displayName"), 30);
      const rawPhone = String(form.get("phone") ?? "").trim();
      const phoneDigits = normalizePhone(rawPhone);
      const password = String(form.get("password") ?? "");
      if (!isValidStaffLoginName(loginName) || !displayName || !isValidStaffPassword(password)) {
        return staffRedirect(request, undefined, "invalid");
      }
      if (rawPhone && ![10, 11].includes(phoneDigits.length)) {
        return staffRedirect(request, undefined, "invalid-phone");
      }
      await createStaffAccount({
        loginName,
        displayName,
        phone: phoneDigits ? formatPhone(phoneDigits) : "",
        passwordHash: await hashPassword(password),
        createdBy: owner.id,
        clientHash,
      });
      return staffRedirect(request, "created");
    }

    const staffId = clean(form.get("staffId"), 80);
    if (!staffId) return staffRedirect(request, undefined, "invalid");
    if (action === "reset-password") {
      const password = String(form.get("password") ?? "");
      if (!isValidStaffPassword(password)) return staffRedirect(request, undefined, "invalid");
      const changed = await resetStaffPassword(
        staffId,
        await hashPassword(password),
        owner.id,
        clientHash,
      );
      return changed
        ? staffRedirect(request, "password")
        : staffRedirect(request, undefined, "missing");
    }
    if (action === "toggle") {
      const active = String(form.get("active")) === "true";
      const changed = await setStaffActive(staffId, active, owner.id, clientHash);
      return changed
        ? staffRedirect(request, active ? "activated" : "deactivated")
        : staffRedirect(request, undefined, "missing");
    }
    return staffRedirect(request, undefined, "invalid");
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "INVALID_ORIGIN") {
      return Response.json({ error: "요청 출처가 올바르지 않습니다." }, { status: 403 });
    }
    return staffRedirect(
      request,
      undefined,
      message.includes("UNIQUE") ? "duplicate" : "service",
    );
  }
}

function clean(value: FormDataEntryValue | null, maximum: number) {
  return typeof value === "string" ? value.trim().slice(0, maximum) : "";
}

function staffRedirect(request: Request, status?: string, error?: string) {
  const url = new URL("/admin/staff", request.url);
  if (status) url.searchParams.set("status", status);
  if (error) url.searchParams.set("error", error);
  return Response.redirect(url, 303);
}
