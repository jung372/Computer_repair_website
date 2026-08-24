import type { PaymentMethod } from "@/lib/domain";

// 모든 결제의 총수금액은 부가세를 포함하므로 1/11로 역산한다.
export const VAT_DIVISOR = 11;
export const MATERIAL_VAT_DIVISOR = 10;

export type DerivedSettlement = {
  totalVatAmount: number;
  materialVatAmount: number;
  technicianIncome: number;
  officeDeposit: number;
};

/**
 * 운영자는 결제방법, 총수금액과 자재비만 입력하고 나머지 정산 금액은 여기서 파생된다.
 * 기사수익 배분율이 바뀌면 technicianIncome 한 줄만 고치면 된다.
 */
export function deriveSettlement(
  paymentMethod: PaymentMethod | "",
  totalAmount: number,
  materialCost: number,
): DerivedSettlement {
  const totalVatAmount = paymentMethod ? Math.round(totalAmount / VAT_DIVISOR) : 0;
  const materialVatAmount = Math.round(materialCost / MATERIAL_VAT_DIVISOR);
  const technicianIncome = Math.max(
    0,
    totalAmount - totalVatAmount - materialCost - materialVatAmount,
  );
  const officeDeposit = Math.max(
    0,
    totalAmount - totalVatAmount - materialCost - materialVatAmount - technicianIncome,
  );
  return { totalVatAmount, materialVatAmount, technicianIncome, officeDeposit };
}

export function formatWon(value: number) {
  return `${value.toLocaleString("ko-KR")} 원`;
}
