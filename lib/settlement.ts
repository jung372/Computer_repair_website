// 총수금액은 부가세를 포함한 금액이므로 1/11로 역산한다.
export const VAT_DIVISOR = 11;

export type DerivedSettlement = {
  vatAmount: number;
  technicianIncome: number;
  officeDeposit: number;
};

/**
 * 운영자는 총수금액과 자재비만 입력하고, 나머지 정산 금액은 여기서 파생된다.
 * 기사수익 배분율이 바뀌면 technicianIncome 한 줄만 고치면 된다.
 */
export function deriveSettlement(
  totalAmount: number,
  materialCost: number,
): DerivedSettlement {
  const vatAmount = Math.round(totalAmount / VAT_DIVISOR);
  const technicianIncome = Math.max(0, totalAmount - vatAmount - materialCost);
  const officeDeposit = Math.max(
    0,
    totalAmount - vatAmount - materialCost - technicianIncome,
  );
  return { vatAmount, technicianIncome, officeDeposit };
}

export function formatWon(value: number) {
  return `${value.toLocaleString("ko-KR")} 원`;
}
