ALTER TABLE `request_operations` ADD COLUMN `material_vat_amount` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
UPDATE `request_operations`
SET `payment_method` = CASE `payment_method`
  WHEN '현금결제' THEN '현금 결제'
  WHEN '카드결제' THEN '카드 결제'
  ELSE `payment_method`
END,
`material_vat_amount` = CAST(ROUND(`material_cost` / 10.0) AS INTEGER);
--> statement-breakpoint
UPDATE `request_operations`
SET `vat_amount` = CASE `payment_method`
  WHEN '현금 결제' THEN 0
  WHEN '현금영수증 결제' THEN CAST(ROUND(`total_amount` / 11.0) AS INTEGER)
  WHEN '카드 결제' THEN CAST(ROUND(`total_amount` / 11.0) AS INTEGER)
  ELSE `vat_amount`
END;
--> statement-breakpoint
UPDATE `request_operations`
SET `technician_income` = MAX(
  0,
  `total_amount` - `vat_amount` - `material_cost` - `material_vat_amount`
)
WHERE `payment_method` IN ('현금 결제', '현금영수증 결제', '카드 결제');
