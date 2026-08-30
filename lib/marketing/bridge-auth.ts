import { getRuntimeString } from "@/lib/runtime-config";
import { constantTimeEqualStrings } from "@/lib/security/constant-time";

export async function authorizeMarketingBridge(request: Request) {
  const secret = getRuntimeString("MARKETING_BRIDGE_SECRET");
  if (!secret) return false;
  const header = request.headers.get("authorization") || "";
  const provided = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  return Boolean(provided) && constantTimeEqualStrings(provided, secret);
}
