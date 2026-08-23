import assert from "node:assert/strict";
import test from "node:test";
import {
  buildAdminDashboardFilterHref,
  getAdminDashboardFilter,
  isAdminDashboardFilterActive,
  UNRESOLVED_REQUEST_STATUSES,
} from "../lib/domain.ts";

const ownerId = "owner-account-id";

test("maps owner dashboard cards to canonical request filters", () => {
  assert.equal(
    buildAdminDashboardFilterHref("unassigned", "OWNER", ownerId),
    "/admin?dashboard=unassigned&assignee=__UNASSIGNED__",
  );
  assert.equal(
    buildAdminDashboardFilterHref("my-received", "OWNER", ownerId),
    `/admin?dashboard=my-received&assignee=${ownerId}&status=RECEIVED`,
  );

  const unresolved = new URL(
    buildAdminDashboardFilterHref("total-unresolved", "OWNER", ownerId),
    "https://combaksa.pe.kr",
  );
  assert.deepEqual(
    unresolved.searchParams.getAll("status"),
    [...UNRESOLVED_REQUEST_STATUSES],
  );
  assert.equal(unresolved.searchParams.has("q"), false);
  assert.equal(unresolved.searchParams.has("page"), false);
});

test("limits staff dashboard cards to the signed-in account scope", () => {
  assert.equal(getAdminDashboardFilter("unassigned", "STAFF", "staff-id"), null);
  assert.deepEqual(getAdminDashboardFilter("my-received", "STAFF", "staff-id"), {
    assignee: "",
    statuses: ["RECEIVED"],
  });
  assert.equal(
    buildAdminDashboardFilterHref("my-received", "STAFF", "staff-id"),
    "/admin?dashboard=my-received&status=RECEIVED",
  );
});

test("marks a card active only while its core filters remain intact", () => {
  assert.equal(
    isAdminDashboardFilterActive(
      "my-unresolved",
      "my-unresolved",
      { assignee: ownerId, statuses: [...UNRESOLVED_REQUEST_STATUSES] },
      "OWNER",
      ownerId,
    ),
    true,
  );
  assert.equal(
    isAdminDashboardFilterActive(
      "my-unresolved",
      "my-unresolved",
      { assignee: ownerId, statuses: ["RECEIVED", "CONSULTING"] },
      "OWNER",
      ownerId,
    ),
    false,
  );
});
