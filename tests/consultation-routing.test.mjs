import assert from "node:assert/strict";
import test from "node:test";
import { resolveConsultationRouting } from "../lib/logic/consultation-routing.ts";

const base = {
  enabled: true,
  daytimePhone: "1660-0596",
  afterHoursPhone: "070-7917-5281",
  timeZone: "Asia/Seoul",
  businessHoursStart: "09:00",
  businessHoursEnd: "18:00",
};

test("keeps 1660 visible at every time while AI routing is disabled", () => {
  for (const now of [
    new Date("2026-08-26T00:00:00.000Z"),
    new Date("2026-08-26T09:00:00.000Z"),
    new Date("2026-08-30T03:00:00.000Z"),
  ]) {
    const result = resolveConsultationRouting({ ...base, enabled: false, now });
    assert.equal(result.phone, "1660-0596");
    assert.equal(result.mode, "GENERAL");
  }
});

test("uses the daytime number from 09:00 through 17:59 KST", () => {
  assert.equal(
    resolveConsultationRouting({ ...base, now: new Date("2026-08-26T00:00:00.000Z") }).phone,
    "1660-0596",
  );
  assert.equal(
    resolveConsultationRouting({ ...base, now: new Date("2026-08-26T08:59:00.000Z") }).phone,
    "1660-0596",
  );
});

test("uses AI intake after 18:00, on Sunday, and on configured holidays", () => {
  assert.equal(
    resolveConsultationRouting({ ...base, now: new Date("2026-08-26T09:00:00.000Z") }).phone,
    "070-7917-5281",
  );
  assert.equal(
    resolveConsultationRouting({ ...base, now: new Date("2026-08-30T03:00:00.000Z") }).phone,
    "070-7917-5281",
  );
  assert.equal(
    resolveConsultationRouting({
      ...base,
      now: new Date("2026-08-26T03:00:00.000Z"),
      holidays: "2026-08-26",
    }).phone,
    "070-7917-5281",
  );
});
