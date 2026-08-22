import assert from "node:assert/strict";
import test from "node:test";
import { REQUEST_STATUSES, UNRESOLVED_REQUEST_STATUSES } from "../lib/domain.ts";

test("keeps active work inside the unresolved workload count", () => {
  assert.deepEqual([...UNRESOLVED_REQUEST_STATUSES], [
    "RECEIVED",
    "CONSULTING",
    "SCHEDULED",
    "REPAIRING",
    "COMPANY_UNPAID",
    "ON_HOLD",
  ]);
});

test("does not count terminal work as unresolved", () => {
  const terminal = REQUEST_STATUSES.filter(
    (status) => !UNRESOLVED_REQUEST_STATUSES.includes(status),
  );
  assert.deepEqual(terminal, [
    "SHIPPED",
    "ONSITE_COMPLETED",
    "PREVISIT_CANCELED",
    "ONSITE_CANCELED",
    "INSHOP_CANCELED",
    "TECH_PERSONAL_CALL",
    "COMPANY_PERSONAL_CALL",
    "COMPLETED",
    "CANCELED",
  ]);
});
