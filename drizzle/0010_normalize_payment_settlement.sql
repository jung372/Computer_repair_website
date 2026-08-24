UPDATE `request_operations`
SET `payment_method` = CASE `payment_method`
  WHEN '현금 결제' THEN '현금결제'
  WHEN '현금영수증 결제' THEN '현금결제'
  WHEN '카드 결제' THEN '카드결제'
  ELSE `payment_method`
END;
--> statement-breakpoint
UPDATE `request_operations`
SET `vat_amount` = CAST(ROUND(`total_amount` / 11.0) AS INTEGER),
    `material_vat_amount` = CAST(ROUND(`material_cost` / 10.0) AS INTEGER)
WHERE `payment_method` IN (
  '현금결제',
  '카드결제',
  '현금+카드',
  '현금+계좌',
  '계좌+카드'
);
--> statement-breakpoint
UPDATE `request_operations`
SET `technician_income` = MAX(
      0,
      `total_amount` - `vat_amount` - `material_cost` - `material_vat_amount`
    ),
    `office_deposit` = 0
WHERE `payment_method` IN (
  '현금결제',
  '카드결제',
  '현금+카드',
  '현금+계좌',
  '계좌+카드'
);
