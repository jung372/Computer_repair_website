import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  MATERIAL_VAT_DIVISOR,
  VAT_DIVISOR,
  deriveSettlement,
  formatWon,
} from "../lib/settlement.ts";

test("calculates both VAT amounts and technician income for card payments", () => {
  assert.equal(VAT_DIVISOR, 11);
  assert.equal(MATERIAL_VAT_DIVISOR, 10);
  assert.deepEqual(deriveSettlement("카드결제", 1_100_000, 100_000), {
    totalVatAmount: 100_000,
    materialVatAmount: 10_000,
    technicianIncome: 890_000,
    officeDeposit: 0,
  });
});

test("leaves every amount at zero when nothing was collected", () => {
  assert.deepEqual(deriveSettlement("", 0, 0), {
    totalVatAmount: 0,
    materialVatAmount: 0,
    technicianIncome: 0,
    officeDeposit: 0,
  });
});

test("includes VAT in cash payments", () => {
  assert.deepEqual(deriveSettlement("현금결제", 1_100_000, 100_000), {
    totalVatAmount: 100_000,
    materialVatAmount: 10_000,
    technicianIncome: 890_000,
    officeDeposit: 0,
  });
});

test("uses the same VAT formula for every supported payment method", () => {
  for (const method of ["현금결제", "카드결제", "현금+카드", "현금+계좌", "계좌+카드"]) {
    assert.deepEqual(deriveSettlement(method, 1_100_000, 100_000), {
      totalVatAmount: 100_000,
      materialVatAmount: 10_000,
      technicianIncome: 890_000,
      officeDeposit: 0,
    });
  }
});

test("rounds both VAT amounts to the nearest won", () => {
  // 100,000 / 11 = 9090.909... → 9,091
  const settlement = deriveSettlement("카드결제", 100_000, 100_005);
  assert.equal(settlement.totalVatAmount, 9_091);
  assert.equal(settlement.materialVatAmount, 10_001);
});

test("never returns a negative technician income when material cost is too high", () => {
  assert.deepEqual(deriveSettlement("카드결제", 110_000, 500_000), {
    totalVatAmount: 10_000,
    materialVatAmount: 50_000,
    technicianIncome: 0,
    officeDeposit: 0,
  });
});

test("keeps the derived amounts consistent with the total", () => {
  for (const [total, material] of [
    [0, 0],
    [11, 1],
    [55_000, 20_000],
    [1_234_567, 333_333],
  ]) {
    const {
      totalVatAmount,
      materialVatAmount,
      technicianIncome,
      officeDeposit,
    } = deriveSettlement("카드결제", total, material);
    assert.equal(
      totalVatAmount + material + materialVatAmount + technicianIncome + officeDeposit,
      total,
      `총수금액 ${total} / 자재비 ${material} 배분이 총액과 어긋납니다.`,
    );
  }
});

test("formats amounts with thousands separators", () => {
  assert.equal(formatWon(0), "0 원");
  assert.equal(formatWon(1_234_567), "1,234,567 원");
});

test("normalizes historical payment methods and recalculates stored settlements", async () => {
  const migration = await readFile(
    new URL("../drizzle/0010_normalize_payment_settlement.sql", import.meta.url),
    "utf8",
  );
  assert.match(migration, /WHEN '현금영수증 결제' THEN '현금결제'/);
  assert.match(migration, /WHEN '현금 결제' THEN '현금결제'/);
  assert.match(migration, /WHEN '카드 결제' THEN '카드결제'/);
  assert.match(migration, /ROUND\(`total_amount` \/ 11\.0\)/);
  assert.match(migration, /`technician_income` = MAX/);
});
