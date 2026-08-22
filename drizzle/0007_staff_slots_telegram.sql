CREATE TABLE `staff_slots` (
  `serial_no` integer PRIMARY KEY NOT NULL CHECK (`serial_no` BETWEEN 1 AND 3),
  `label` text NOT NULL,
  `telegram_chat_id_ciphertext` text,
  `telegram_chat_id_iv` text,
  `telegram_enabled` integer DEFAULT 0 NOT NULL,
  `telegram_verified_at` text,
  `updated_by` text,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL
);
--> statement-breakpoint
INSERT INTO `staff_slots` (`serial_no`, `label`, `created_at`, `updated_at`)
VALUES
  (1, '직원 슬롯 1', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  (2, '직원 슬롯 2', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  (3, '직원 슬롯 3', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
--> statement-breakpoint
ALTER TABLE `admins` ADD COLUMN `slot_serial_no` integer;
--> statement-breakpoint
ALTER TABLE `notification_outbox` ADD COLUMN `event_type` text DEFAULT 'NEW_REQUEST' NOT NULL;
--> statement-breakpoint
ALTER TABLE `notification_outbox` ADD COLUMN `recipient_account_id` text;
--> statement-breakpoint
ALTER TABLE `notification_outbox` ADD COLUMN `telegram_message_id` text;
--> statement-breakpoint
ALTER TABLE `notification_outbox` ADD COLUMN `canceled_at` text;
--> statement-breakpoint
CREATE TABLE `request_assignment_history` (
  `id` text PRIMARY KEY NOT NULL,
  `request_id` text NOT NULL,
  `previous_account_id` text,
  `assigned_account_id` text,
  `assignee_name_snapshot` text DEFAULT '' NOT NULL,
  `event_type` text NOT NULL,
  `reason` text,
  `changed_by` text NOT NULL,
  `created_at` text NOT NULL,
  FOREIGN KEY (`request_id`) REFERENCES `service_requests`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
UPDATE `request_operations`
SET `assignee` = '', `assignee_phone` = '', `assignee_account_id` = NULL,
    `assigned_by` = NULL, `assigned_at` = NULL,
    `updated_at` = strftime('%Y-%m-%dT%H:%M:%fZ', 'now');
--> statement-breakpoint
DELETE FROM `admins` WHERE `role` = 'STAFF';
--> statement-breakpoint
CREATE UNIQUE INDEX `admins_active_staff_slot_idx`
ON `admins` (`slot_serial_no`)
WHERE `role` = 'STAFF' AND `is_active` = 1 AND `slot_serial_no` IS NOT NULL;
--> statement-breakpoint
CREATE INDEX `notification_outbox_event_idx`
ON `notification_outbox` (`event_type`, `recipient_account_id`);
--> statement-breakpoint
CREATE INDEX `request_assignment_history_request_idx`
ON `request_assignment_history` (`request_id`);
