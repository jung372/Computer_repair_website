import assert from "node:assert/strict";
import test from "node:test";
import {
  ADMIN_LOGIN_NAME,
  isValidStaffLoginName,
  isValidStaffPassword,
  normalizeLoginName,
} from "../lib/account-policy.ts";

test("keeps the owner login fixed and normalizes staff login names", () => {
  assert.equal(ADMIN_LOGIN_NAME, "admin");
  assert.equal(normalizeLoginName("  Staff.01  "), "staff.01");
  assert.equal(isValidStaffLoginName("staff_01"), true);
  assert.equal(isValidStaffLoginName("admin"), false);
  assert.equal(isValidStaffLoginName("직원01"), false);
});

test("accepts staff passwords containing only four or more digits", () => {
  assert.equal(isValidStaffPassword("1234"), true);
  assert.equal(isValidStaffPassword("1234567890123456"), true);
  assert.equal(isValidStaffPassword("123"), false);
  assert.equal(isValidStaffPassword("123a"), false);
});
