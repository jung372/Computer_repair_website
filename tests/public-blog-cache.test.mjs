import assert from "node:assert/strict";
import test from "node:test";

import { PublicListCache } from "../lib/blog/public-list-cache.ts";

test("public blog lists reuse fresh data and fall back to stale data during D1 failures", async () => {
  let now = 0;
  let loads = 0;
  const cache = new PublicListCache({ freshMs: 600, staleMs: 2_400, now: () => now });
  const load = async () => { loads += 1; return ["post-1"]; };

  assert.deepEqual(await cache.get("latest:3", load), ["post-1"]);
  now = 500;
  assert.deepEqual(await cache.get("latest:3", load), ["post-1"]);
  assert.equal(loads, 1);

  now = 700;
  assert.deepEqual(await cache.get("latest:3", async () => { throw new Error("D1 limit"); }), ["post-1"]);

  cache.clear();
  await assert.rejects(() => cache.get("latest:3", async () => { throw new Error("D1 limit"); }), /D1 limit/);
});
