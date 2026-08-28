import { waitUntil } from "cloudflare:workers";
import { recordSkippedVoxIntake } from "@/data/integration-intake-repository";
import { processPendingNotifications } from "@/infrastructure/telegram";
import { analyzeVoxWebhookPayload } from "@/lib/integrations/vox/webhook";
import { createVoxServiceRequest } from "@/lib/logic/request-service";
import { getRuntimeString } from "@/lib/runtime-config";
import {
  sha256Text,
  verifyVoxWebhookSignature,
} from "@/lib/security/vox-webhook";

const MAX_WEBHOOK_BYTES = 256 * 1024;

function json(body: Record<string, unknown>, status = 200) {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
}

function logWebhook(
  level: "info" | "warn" | "error",
  event: string,
  details: Record<string, unknown> = {},
) {
  const entry = {
    source: "vox-webhook",
    event,
    ...details,
  };
  if (level === "error") console.error(entry);
  else if (level === "warn") console.warn(entry);
  else console.info(entry);
}

export async function POST(request: Request) {
  if (getRuntimeString("VOX_WEBHOOK_ENABLED").toLowerCase() !== "true") {
    logWebhook("warn", "disabled");
    return json({ received: true, status: "disabled" });
  }

  const secret = getRuntimeString("VOX_WEBHOOK_SECRET");
  const agentId = getRuntimeString("VOX_AGENT_ID");
  const inboundNumber = getRuntimeString("VOX_INBOUND_NUMBER");
  if (!secret || !agentId || !inboundNumber) {
    logWebhook("error", "configuration_missing", {
      secretConfigured: Boolean(secret),
      agentConfigured: Boolean(agentId),
      inboundNumberConfigured: Boolean(inboundNumber),
    });
    return json({ received: false, error: "integration_not_configured" }, 503);
  }
  if (!request.headers.get("content-type")?.toLowerCase().includes("application/json")) {
    logWebhook("warn", "unsupported_media_type");
    return json({ received: false, error: "unsupported_media_type" }, 415);
  }
  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(declaredLength) && declaredLength > MAX_WEBHOOK_BYTES) {
    logWebhook("warn", "payload_too_large", { declaredLength });
    return json({ received: false, error: "payload_too_large" }, 413);
  }

  try {
    const bodyBytes = new Uint8Array(await request.arrayBuffer());
    if (bodyBytes.byteLength > MAX_WEBHOOK_BYTES) {
      logWebhook("warn", "payload_too_large", { receivedLength: bodyBytes.byteLength });
      return json({ received: false, error: "payload_too_large" }, 413);
    }
    const rawBody = new TextDecoder().decode(bodyBytes);
    const signature = await verifyVoxWebhookSignature({
      rawBody,
      secret,
      timestampHeader: request.headers.get("x-webhook-timestamp"),
      signatureHeader: request.headers.get("x-webhook-signature"),
    });
    if (!signature.ok) {
      logWebhook("warn", "signature_rejected", { reason: signature.reason });
      return json({ received: false, error: "invalid_signature" }, 401);
    }

    let payload: unknown;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      logWebhook("warn", "invalid_json");
      return json({ received: false, error: "invalid_json" }, 400);
    }
    const decision = analyzeVoxWebhookPayload(payload, { agentId, inboundNumber });
    if (decision.kind === "bad_request") {
      logWebhook("warn", "invalid_payload", { reason: decision.reason });
      return json({ received: false, error: "invalid_payload" }, 400);
    }
    if (decision.kind === "ignored") {
      logWebhook("info", "ignored", { reason: decision.reason });
      return json({ received: true, status: "ignored" });
    }

    const payloadHash = await sha256Text(rawBody);
    const receivedAt = new Date().toISOString();
    if (decision.kind === "skipped") {
      if (decision.callId && decision.agentId !== undefined && decision.agentVersion !== undefined) {
        const intakeHash = await sha256Text(`vox-intake:${decision.callId}:call_analyzed`);
        await recordSkippedVoxIntake(
          {
            intakeId: `vox_intake_${intakeHash.slice(0, 32)}`,
            externalId: decision.callId,
            eventType: "call_analyzed",
            payloadHash,
            agentId: decision.agentId,
            agentVersion: decision.agentVersion,
            receivedAt,
          },
          decision.reason,
        );
      }
      logWebhook("info", "skipped", {
        reason: decision.reason,
        agentVersion: decision.agentVersion ?? null,
      });
      return json({ received: true, status: "skipped" });
    }

    const result = await createVoxServiceRequest(
      {
        phone: decision.callerPhone,
        address1: decision.address1,
        address2: decision.address2,
        symptom: decision.symptom,
        manufacturerModel: decision.manufacturerModel,
      },
      {
        callId: decision.callId,
        agentId: decision.agentId,
        agentVersion: decision.agentVersion,
        startedAt: decision.startedAt,
        payloadHash,
        receivedAt,
      },
    );
    if (result.created) {
      waitUntil(
        processPendingNotifications(new URL(request.url).origin).catch(() => undefined),
      );
    }
    logWebhook("info", result.created ? "created" : "duplicate", {
      agentVersion: decision.agentVersion,
    });
    return json({ received: true, status: result.created ? "created" : "duplicate" });
  } catch (error) {
    logWebhook("error", "processing_failed", {
      error: error instanceof Error ? error.message.slice(0, 160) : "UNKNOWN_ERROR",
    });
    return json({ received: false, error: "processing_failed" }, 500);
  }
}
