export const VOX_SKIP_REASONS = [
  "SKIPPED_NOTICE_NOT_DELIVERED",
  "SKIPPED_AI_IDENTITY_NOT_DISCLOSED",
  "SKIPPED_NOT_CONFIRMED",
  "SKIPPED_ADDRESS_NOT_CONFIRMED",
  "SKIPPED_INVALID_CALLER",
  "SKIPPED_INVALID_START_AT",
  "SKIPPED_MISSING_REQUIRED",
  "SKIPPED_INVALID_ANALYSIS",
  "SKIPPED_AMBIGUOUS_ANALYSIS",
] as const;

export type VoxSkipReason = (typeof VOX_SKIP_REASONS)[number];

type VoxCallMetadata = {
  callId: string;
  agentId: string;
  agentVersion: string;
};

export type VoxPayloadDecision =
  | { kind: "bad_request"; reason: "INVALID_PAYLOAD" | "UNSUPPORTED_VERSION" }
  | { kind: "ignored"; reason: "UNRELATED_EVENT" | "UNRELATED_AGENT" | "UNRELATED_NUMBER" | "NOT_INBOUND" }
  | ({ kind: "skipped"; reason: VoxSkipReason } & Partial<VoxCallMetadata>)
  | ({
      kind: "create";
      callerPhone: string;
      startedAt: number;
      address1: string;
      address2: string;
      symptom: string;
      manufacturerModel: string;
    } & VoxCallMetadata);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function cleanString(value: unknown, maximum: number) {
  if (value === null || value === undefined) return { valid: true, value: "" };
  if (typeof value !== "string") return { valid: false, value: "" };
  const cleaned = value.trim();
  if (cleaned.length > maximum) return { valid: false, value: "" };
  return { valid: true, value: cleaned };
}

function normalizePhone(value: unknown) {
  if (typeof value !== "string") return "";
  return value
    .replace(/[０-９]/g, (digit) => String.fromCharCode(digit.charCodeAt(0) - 0xfee0))
    .replace(/^\s*(?:\+|00)\s*82[\s.\-()]*0?/, "0")
    .replace(/\D/g, "");
}

function normalizeAnalysis(value: unknown) {
  const analysis = new Map<string, unknown>();
  const duplicates = new Set<string>();
  if (Array.isArray(value)) {
    for (const entry of value) {
      if (!isRecord(entry) || typeof entry.name !== "string" || !("value" in entry)) {
        return { valid: false, analysis, duplicates };
      }
      const name = entry.name.trim();
      if (!name) return { valid: false, analysis, duplicates };
      if (analysis.has(name)) duplicates.add(name);
      analysis.set(name, entry.value);
    }
    return { valid: true, analysis, duplicates };
  }
  if (isRecord(value)) {
    for (const [name, entry] of Object.entries(value)) {
      analysis.set(name, isRecord(entry) && "value" in entry ? entry.value : entry);
    }
    return { valid: true, analysis, duplicates };
  }
  return { valid: false, analysis, duplicates };
}

export function analyzeVoxWebhookPayload(
  payload: unknown,
  expected: { agentId: string; inboundNumber: string },
): VoxPayloadDecision {
  if (!isRecord(payload)) return { kind: "bad_request", reason: "INVALID_PAYLOAD" };
  if (payload.webhook_version !== "v2") {
    return { kind: "bad_request", reason: "UNSUPPORTED_VERSION" };
  }
  if (!isRecord(payload.call)) return { kind: "bad_request", reason: "INVALID_PAYLOAD" };

  const call = payload.call;
  const agent = isRecord(call.agent) ? call.agent : {};
  const agentId = typeof agent.agent_id === "string" ? agent.agent_id.trim() : "";
  const agentVersion = typeof agent.agent_version === "string"
    ? agent.agent_version.trim().slice(0, 100)
    : "";

  if (agentId !== expected.agentId) return { kind: "ignored", reason: "UNRELATED_AGENT" };
  if (call.call_type !== "inbound") return { kind: "ignored", reason: "NOT_INBOUND" };
  if (normalizePhone(call.to_number) !== normalizePhone(expected.inboundNumber)) {
    return { kind: "ignored", reason: "UNRELATED_NUMBER" };
  }
  if (payload.event !== "call_analyzed") {
    return { kind: "ignored", reason: "UNRELATED_EVENT" };
  }

  const callId = typeof call.call_id === "string" ? call.call_id.trim() : "";
  const metadata = callId && callId.length <= 200 ? { callId, agentId, agentVersion } : undefined;
  if (!metadata) return { kind: "skipped", reason: "SKIPPED_INVALID_ANALYSIS" };

  const callerPhone = normalizePhone(call.from_number);
  if (callerPhone.length < 10 || callerPhone.length > 11) {
    return { kind: "skipped", reason: "SKIPPED_INVALID_CALLER", ...metadata };
  }
  if (typeof call.start_at !== "number" || !Number.isFinite(call.start_at) || call.start_at <= 0) {
    return { kind: "skipped", reason: "SKIPPED_INVALID_START_AT", ...metadata };
  }

  const callAnalysis = isRecord(call.call_analysis) ? call.call_analysis : {};
  const normalized = normalizeAnalysis(callAnalysis.custom_analysis_data);
  if (!normalized.valid) {
    return { kind: "skipped", reason: "SKIPPED_INVALID_ANALYSIS", ...metadata };
  }
  const protectedFields = [
    "privacy_notice_delivered",
    "ai_identity_disclosed",
    "service_request_confirmed",
    "address_confirmed",
    "address1",
    "symptom",
  ];
  if (protectedFields.some((name) => normalized.duplicates.has(name))) {
    return { kind: "skipped", reason: "SKIPPED_AMBIGUOUS_ANALYSIS", ...metadata };
  }
  if (normalized.analysis.get("privacy_notice_delivered") !== true) {
    return { kind: "skipped", reason: "SKIPPED_NOTICE_NOT_DELIVERED", ...metadata };
  }
  if (normalized.analysis.get("ai_identity_disclosed") !== true) {
    return { kind: "skipped", reason: "SKIPPED_AI_IDENTITY_NOT_DISCLOSED", ...metadata };
  }
  if (normalized.analysis.get("service_request_confirmed") !== true) {
    return { kind: "skipped", reason: "SKIPPED_NOT_CONFIRMED", ...metadata };
  }
  if (normalized.analysis.get("address_confirmed") !== true) {
    return { kind: "skipped", reason: "SKIPPED_ADDRESS_NOT_CONFIRMED", ...metadata };
  }

  const address1 = cleanString(normalized.analysis.get("address1"), 160);
  const address2 = cleanString(normalized.analysis.get("address2"), 160);
  const symptom = cleanString(normalized.analysis.get("symptom"), 120);
  const manufacturerModel = cleanString(normalized.analysis.get("manufacturer_model"), 100);
  if (!address1.valid || !address2.valid || !symptom.valid || !manufacturerModel.valid) {
    return { kind: "skipped", reason: "SKIPPED_INVALID_ANALYSIS", ...metadata };
  }
  if (!address1.value || !symptom.value) {
    return { kind: "skipped", reason: "SKIPPED_MISSING_REQUIRED", ...metadata };
  }

  return {
    kind: "create",
    ...metadata,
    callerPhone,
    startedAt: call.start_at,
    address1: address1.value,
    address2: address2.value,
    symptom: symptom.value,
    manufacturerModel: manufacturerModel.value,
  };
}
