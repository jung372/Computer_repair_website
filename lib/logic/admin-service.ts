import {
  anonymizeRequest,
  findRequestByPublicId,
  resetNotification,
  updateRequestStatus,
} from "@/data/request-repository";
import { REQUEST_STATUSES, STATUS_TRANSITIONS, type RequestStatus } from "@/lib/domain";

export async function changeRequestStatus(
  publicId: string,
  input: { status?: unknown; publicNote?: unknown; internalNote?: unknown },
  adminEmail: string,
) {
  const request = await findRequestByPublicId(publicId);
  if (!request) throw new Error("NOT_FOUND");
  const status = typeof input.status === "string" ? input.status : "";
  if (!REQUEST_STATUSES.includes(status as RequestStatus)) throw new Error("INVALID_STATUS");
  if (!STATUS_TRANSITIONS[request.status].includes(status as RequestStatus)) {
    throw new Error("INVALID_TRANSITION");
  }
  const publicNote =
    typeof input.publicNote === "string" ? input.publicNote.trim().slice(0, 500) : "";
  const internalNote =
    typeof input.internalNote === "string" ? input.internalNote.trim().slice(0, 2_000) : "";
  if (request.status === "COMPLETED" && status === "REPAIRING" && !publicNote) {
    throw new Error("REOPEN_REASON_REQUIRED");
  }
  await updateRequestStatus(
    request,
    status as RequestStatus,
    publicNote,
    internalNote,
    adminEmail,
  );
}

export function retryRequestNotification(publicId: string) {
  return resetNotification(publicId);
}

export function removeRequestPersonalData(publicId: string, adminEmail: string) {
  return anonymizeRequest(publicId, adminEmail);
}
