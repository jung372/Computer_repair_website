import assert from "node:assert/strict";
import test from "node:test";

import { getCanonicalRedirectUrl } from "../lib/canonical-url.ts";

test("keeps the service and content domains separate while normalizing their aliases", () => {
  const cases = [
    [
      "https://www.combaksa.pe.kr/requests/new?device=laptop#details",
      "https://combaksa.pe.kr/requests/new?device=laptop#details",
    ],
    [
      "https://combaksa-computer-repair.jung372.workers.dev/services/desktop",
      "https://combaksa.pe.kr/services/desktop",
    ],
    ["http://combaksa.pe.kr/privacy", "https://combaksa.pe.kr/privacy"],
    ["http://combaksa-repair.com/insights", "https://combaksa-repair.com/insights"],
    ["https://www.combaksa-repair.com/insights", "https://combaksa-repair.com/insights"],
  ];

  for (const [source, expected] of cases) {
    assert.equal(getCanonicalRedirectUrl(new URL(source))?.toString(), expected);
  }
});

test("leaves canonical HTTPS, preview and local hosts unchanged", () => {
  for (const source of [
    "https://combaksa.pe.kr/requests",
    "https://combaksa-repair.com/requests",
    "https://combaksa-repair.com/insights/224000000001",
    "https://preview-combaksa-computer-repair.jung372.workers.dev/",
    "http://localhost:3000/",
  ]) {
    assert.equal(getCanonicalRedirectUrl(new URL(source)), null);
  }
});
