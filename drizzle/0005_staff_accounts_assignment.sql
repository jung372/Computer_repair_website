ALTER TABLE `admins` ADD COLUMN `display_name` text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE `admins` ADD COLUMN `phone` text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE `admins` ADD COLUMN `role` text DEFAULT 'STAFF' NOT NULL;
--> statement-breakpoint
ALTER TABLE `admins` ADD COLUMN `created_by` text;
--> statement-breakpoint
UPDATE `admins`
SET `login_name` = 'admin', `display_name` = '운영자', `role` = 'OWNER'
WHERE `id` = 'primary';
--> statement-breakpoint
ALTER TABLE `request_operations` ADD COLUMN `assignee_account_id` text;
--> statement-breakpoint
ALTER TABLE `request_operations` ADD COLUMN `assigned_by` text;
--> statement-breakpoint
ALTER TABLE `request_operations` ADD COLUMN `assigned_at` text;
--> statement-breakpoint
CREATE INDEX `request_operations_assignee_account_idx`
ON `request_operations` (`assignee_account_id`);
