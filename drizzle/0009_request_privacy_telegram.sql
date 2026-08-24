ALTER TABLE `service_requests`
ADD COLUMN `privacy_legal_basis` TEXT NOT NULL DEFAULT 'CONSENT';
--> statement-breakpoint
ALTER TABLE `service_requests`
ADD COLUMN `privacy_notice_version` TEXT NOT NULL DEFAULT '';
--> statement-breakpoint
ALTER TABLE `service_requests`
ADD COLUMN `privacy_notice_presented_at` TEXT NOT NULL DEFAULT '';
--> statement-breakpoint
ALTER TABLE `notification_outbox`
ADD COLUMN `telegram_chat_id_hash` TEXT;
--> statement-breakpoint
ALTER TABLE `notification_outbox`
ADD COLUMN `telegram_delete_after` TEXT;
--> statement-breakpoint
ALTER TABLE `notification_outbox`
ADD COLUMN `telegram_deleted_at` TEXT;
--> statement-breakpoint
ALTER TABLE `notification_outbox`
ADD COLUMN `telegram_delete_attempts` INTEGER NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE `notification_outbox`
ADD COLUMN `telegram_delete_error` TEXT;
--> statement-breakpoint
CREATE INDEX `notification_outbox_telegram_delete_idx`
ON `notification_outbox` (`event_type`, `telegram_delete_after`, `telegram_deleted_at`);
