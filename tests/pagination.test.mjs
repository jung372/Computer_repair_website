import assert from "node:assert/strict";
import test from "node:test";
import { getPagination } from "../lib/pagination.ts";

test("keeps 0 through 200 requests on the first page", () => {
  assert.deepEqual(getPagination("1", 0, 200), {
    page: 1,
    pageSize: 200,
    totalItems: 0,
    totalPages: 1,
    offset: 0,
  });
  assert.equal(getPagination("1", 200, 200).totalPages, 1);
});

test("opens older requests in stable 200-row pages", () => {
  assert.deepEqual(getPagination("2", 201, 200), {
    page: 2,
    pageSize: 200,
    totalItems: 201,
    totalPages: 2,
    offset: 200,
  });
  assert.equal(getPagination("2", 400, 200).offset, 200);
  assert.equal(getPagination("3", 401, 200).offset, 400);
});

test("clamps invalid and out-of-range page requests", () => {
  assert.equal(getPagination("invalid", 401, 200).page, 1);
  assert.equal(getPagination("0", 401, 200).page, 1);
  assert.equal(getPagination("99", 401, 200).page, 3);
});
