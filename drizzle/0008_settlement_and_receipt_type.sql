UPDATE `request_operations`
SET `receipt_type` = CASE
  WHEN `receipt_type` = '관리자접수' THEN '콜센터접수'
  WHEN `receipt_type` IN ('콜센터접수', '온라인접수', '오프라인접수', '기타접수')
    THEN `receipt_type`
  ELSE '기타접수'
END;
--> statement-breakpoint
CREATE INDEX `request_operations_settlement_assignee_idx`
ON `request_operations` (`completed_date`, `assignee_account_id`);
--> statement-breakpoint
CREATE INDEX `request_operations_settlement_filter_idx`
ON `request_operations` (`completed_date`, `payment_method`);
