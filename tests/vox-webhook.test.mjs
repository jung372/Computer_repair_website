import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { analyzeVoxWebhookPayload } from "../lib/integrations/vox/webhook.ts";
import { verifyVoxWebhookSignature } from "../lib/security/vox-webhook.ts";

const expected = {
  agentId: "56416052-f373-45b8-ae59-81ddfa304d4b",
  inboundNumber: "07079175281",
};

function payload(overrides = {}) {
  return {
    event: "call_analyzed",
    webhook_version: "v2",
    call: {
      call_id: "call-123",
      agent: { agent_id: expected.agentId, agent_version: "production" },
      call_type: "inbound",
      from_number: "+82 10-1234-5678",
      to_number: "070-7917-5281",
      start_at: 1_787_700_000_000,
      call_analysis: {
        custom_analysis_data: [
          { name: "privacy_notice_delivered", value: true },
          { name: "ai_identity_disclosed", value: true },
          { name: "service_request_confirmed", value: true },
          { name: "address_confirmed", value: true },
          { name: "address1", value: "서울특별시 광진구 자양로 1" },
          { name: "address2", value: "101호" },
          { name: "symptom", value: "전원을 켜도 화면이 나오지 않음" },
          { name: "manufacturer_model", value: "LG 15U50" },
        ],
      },
      ...overrides,
    },
  };
}

test("normalizes a valid analyzed inbound call", () => {
  const result = analyzeVoxWebhookPayload(payload(), expected);
  assert.equal(result.kind, "create");
  assert.equal(result.callerPhone, "01012345678");
  assert.equal(result.address2, "101호");
});

test("supports object-shaped post-call extraction values", () => {
  const source = payload();
  source.call.call_analysis.custom_analysis_data = {
    privacy_notice_delivered: { value: true },
    ai_identity_disclosed: true,
    service_request_confirmed: true,
    address_confirmed: true,
    address1: "서울특별시 광진구 자양로 1",
    symptom: "부팅되지 않음",
  };
  assert.equal(analyzeVoxWebhookPayload(source, expected).kind, "create");
});

test("does not accept string booleans or a missing final AI disclosure", () => {
  const source = payload();
  source.call.call_analysis.custom_analysis_data[1].value = "true";
  const result = analyzeVoxWebhookPayload(source, expected);
  assert.deepEqual(
    { kind: result.kind, reason: result.reason },
    { kind: "skipped", reason: "SKIPPED_AI_IDENTITY_NOT_DISCLOSED" },
  );
});

test("rejects ambiguous duplicate protected fields", () => {
  const source = payload();
  source.call.call_analysis.custom_analysis_data.push({
    name: "service_request_confirmed",
    value: true,
  });
  const result = analyzeVoxWebhookPayload(source, expected);
  assert.equal(result.kind, "skipped");
  assert.equal(result.reason, "SKIPPED_AMBIGUOUS_ANALYSIS");
});

test("ignores other agents and receiving numbers", () => {
  const otherAgent = payload();
  otherAgent.call.agent.agent_id = "other-agent";
  assert.equal(analyzeVoxWebhookPayload(otherAgent, expected).kind, "ignored");
  assert.equal(
    analyzeVoxWebhookPayload(payload({ to_number: "07000000000" }), expected).kind,
    "ignored",
  );
});

test("verifies the timestamped raw-body HMAC and rejects replay", async () => {
  const secret = "test-secret";
  const rawBody = JSON.stringify(payload());
  const timestamp = "1800000000";
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const bytes = new Uint8Array(await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(`${timestamp}.${rawBody}`),
  ));
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  const valid = await verifyVoxWebhookSignature({
    rawBody,
    secret,
    timestampHeader: timestamp,
    signatureHeader: `sha256=${hex}`,
    nowMs: Number(timestamp) * 1000,
  });
  assert.equal(valid.ok, true);
  const replay = await verifyVoxWebhookSignature({
    rawBody,
    secret,
    timestampHeader: timestamp,
    signatureHeader: `sha256=${hex}`,
    nowMs: (Number(timestamp) + 301) * 1000,
  });
  assert.deepEqual(replay, { ok: false, reason: "EXPIRED" });
});

test("keeps the Vox webhook enabled, observable, and pinned to v2", async () => {
  const root = new URL("../", import.meta.url);
  const [wrangler, route, schema, migration, siteConfig, agent, adminPage, adminNav] = await Promise.all([
    readFile(new URL("wrangler.jsonc", root), "utf8"),
    readFile(new URL("app/api/integrations/vox/webhook/route.ts", root), "utf8"),
    readFile(new URL("db/schema.ts", root), "utf8"),
    readFile(new URL("drizzle/0012_vox_integration_intakes.sql", root), "utf8"),
    readFile(new URL("lib/site-config.ts", root), "utf8"),
    readFile(new URL("agents/combaksa-consultation/agent.json", root), "utf8"),
    readFile(new URL("app/admin/integrations/vox/page.tsx", root), "utf8"),
    readFile(new URL("components/admin-account-nav.tsx", root), "utf8"),
  ]);
  assert.match(wrangler, /"AI_PHONE_ROUTING_ENABLED": "false"/);
  assert.match(wrangler, /"VOX_WEBHOOK_ENABLED": "true"/);
  assert.match(wrangler, /"NEXT_PUBLIC_BUSINESS_PHONE": "1660-0596"/);
  assert.match(route, /verifyVoxWebhookSignature/);
  assert.match(route, /VOX_WEBHOOK_ENABLED/);
  assert.match(route, /signature_rejected/);
  assert.match(schema, /integrationIntakes/);
  assert.match(migration, /UNIQUE INDEX `integration_intakes_provider_event_unique`/);
  assert.match(siteConfig, /야간·공휴일은 접수 상담만 가능합니다/);
  assert.equal(JSON.parse(agent).agent.data.webhookSettings.webhookVersion, "v2");
  assert.match(adminPage, /전화 접수 연동 상태/);
  assert.match(adminPage, /requireOwner/);
  assert.match(adminNav, /\/admin\/integrations\/vox/);
});
