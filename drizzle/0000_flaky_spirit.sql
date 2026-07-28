CREATE TABLE `access_attempts` (
	`key` text PRIMARY KEY NOT NULL,
	`failures` integer DEFAULT 0 NOT NULL,
	`blocked_until` text,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `notification_outbox` (
	`id` text PRIMARY KEY NOT NULL,
	`request_id` text NOT NULL,
	`channel` text DEFAULT 'TELEGRAM' NOT NULL,
	`status` text DEFAULT 'PENDING' NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`next_attempt_at` text NOT NULL,
	`last_error` text,
	`sent_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`request_id`) REFERENCES `service_requests`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `notification_outbox_status_idx` ON `notification_outbox` (`status`);--> statement-breakpoint
CREATE TABLE `request_status_history` (
	`id` text PRIMARY KEY NOT NULL,
	`request_id` text NOT NULL,
	`status` text NOT NULL,
	`public_note` text DEFAULT '' NOT NULL,
	`changed_by` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`request_id`) REFERENCES `service_requests`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `request_history_request_idx` ON `request_status_history` (`request_id`);--> statement-breakpoint
CREATE TABLE `service_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`public_id` text NOT NULL,
	`name` text NOT NULL,
	`phone` text NOT NULL,
	`postal_code` text NOT NULL,
	`address1` text NOT NULL,
	`address2` text NOT NULL,
	`region_public` text NOT NULL,
	`device_type` text NOT NULL,
	`manufacturer_model` text DEFAULT '' NOT NULL,
	`symptom` text NOT NULL,
	`description` text NOT NULL,
	`visibility` text NOT NULL,
	`access_password_hash` text,
	`status` text DEFAULT 'RECEIVED' NOT NULL,
	`preferred_at` text,
	`internal_note` text DEFAULT '' NOT NULL,
	`notification_status` text DEFAULT 'PENDING' NOT NULL,
	`notification_error` text,
	`privacy_consent_version` text NOT NULL,
	`privacy_consented_at` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `service_requests_public_id_unique` ON `service_requests` (`public_id`);--> statement-breakpoint
CREATE INDEX `service_requests_created_idx` ON `service_requests` (`created_at`);--> statement-breakpoint
CREATE INDEX `service_requests_status_idx` ON `service_requests` (`status`);