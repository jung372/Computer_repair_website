import assert from "node:assert/strict";
import test from "node:test";
import { VAT_DIVISOR, deriveSettlement, formatWon } from "../lib/settlement.ts";

test("splits a VAT-inclusive total into VAT and technician income", () => {
  assert.equal(VAT_DIVISOR, 11);
  assert.deepEqual(deriveSettlement(1_100_000, 100_000), {
    vatAmount: 100_000,
    technicianIncome: 900_000,
    officeDeposit: 0,
  });
});

test("leaves every amount at zero when nothing was collected", () => {
  assert.deepEqual(deriveSettlement(0, 0), {
    vatAmount: 0,
    technicianIncome: 0,
    officeDeposit: 0,
  });
});

test("rounds VAT to the nearest won", () => {
  // 100,000 / 11 = 9090.909... → 9,091
  const { vatAmount, technicianIncome } = deriveSettlement(100_000, 0);
  assert.equal(vatAmount, 9_091);
  assert.equal(technicianIncome, 90_909);
  assert.equal(vatAmount + technicianIncome, 100_000);
});

test("never returns a negative technician income when material cost is too high", () => {
  assert.deepEqual(deriveSettlement(110_000, 500_000), {
    vatAmount: 10_000,
    technicianIncome: 0,
    officeDeposit: 0,
  });
});

test("keeps the three derived amounts consistent with the total", () => {
  for (const [total, material] of [
    [0, 0],
    [11, 1],
    [55_000, 20_000],
    [1_234_567, 333_333],
  ]) {
    const { vatAmount, technicianIncome, officeDeposit } = deriveSettlement(total, material);
    assert.equal(
      vatAmount + material + technicianIncome + officeDeposit,
      total,
      `총수금액 ${total} / 자재비 ${material} 배분이 총액과 어긋납니다.`,
    );
  }
});

test("formats amounts with thousands separators", () => {
  assert.equal(formatWon(0), "0 원");
  assert.equal(formatWon(1_234_567), "1,234,567 원");
});
