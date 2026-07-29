CREATE TABLE `request_serials` (
  `serial_no` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `request_id` text NOT NULL UNIQUE,
  FOREIGN KEY (`request_id`) REFERENCES `service_requests`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT OR IGNORE INTO `request_serials` (`request_id`)
SELECT `id` FROM `service_requests` ORDER BY `created_at` ASC, `id` ASC;
--> statement-breakpoint
CREATE TABLE `request_operations` (
  `request_id` text PRIMARY KEY NOT NULL,
  `receipt_type` text DEFAULT '온라인접수' NOT NULL,
  `assignee` text DEFAULT '' NOT NULL,
  `assignee_phone` text DEFAULT '' NOT NULL,
  `customer_type` text DEFAULT '신규일반고객' NOT NULL,
  `landline` text DEFAULT '' NOT NULL,
  `invoice_date` text,
  `invoice_content` text DEFAULT '' NOT NULL,
  `title` text DEFAULT '수리요청' NOT NULL,
  `request_category` text DEFAULT '' NOT NULL,
  `received_date` text NOT NULL,
  `visit_date` text,
  `completed_date` text,
  `payment_method` text DEFAULT '' NOT NULL,
  `total_amount` integer DEFAULT 0 NOT NULL,
  `material_cost` integer DEFAULT 0 NOT NULL,
  `vat_amount` integer DEFAULT 0 NOT NULL,
  `technician_income` integer DEFAULT 0 NOT NULL,
  `office_deposit` integer DEFAULT 0 NOT NULL,
  `updated_at` text NOT NULL,
  FOREIGN KEY (`request_id`) REFERENCES `service_requests`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT OR IGNORE INTO `request_operations` (
  `request_id`, `receipt_type`, `customer_type`, `title`, `received_date`, `updated_at`
)
SELECT
  `id`, '온라인접수', '신규일반고객',
  CASE WHEN `symptom` = '' THEN '수리요청' ELSE `symptom` END,
  substr(`created_at`, 1, 10), `updated_at`
FROM `service_requests`;
--> statement-breakpoint
CREATE INDEX `request_operations_receipt_idx` ON `request_operations` (`receipt_type`);
--> statement-breakpoint
CREATE INDEX `request_operations_assignee_idx` ON `request_operations` (`assignee`);
--> statement-breakpoint
CREATE INDEX `request_operations_dates_idx` ON `request_operations` (`received_date`,`completed_date`);
