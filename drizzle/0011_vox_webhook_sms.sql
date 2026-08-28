CREATE TABLE `integration_intakes` (
	`id` text PRIMARY KEY NOT NULL,
	`provider` text NOT NULL,
	`external_id` text NOT NULL,
	`event_type` text NOT NULL,
	`request_id` text,
	`status` text NOT NULL,
	`reason_code` text,
	`payload_hash` text NOT NULL,
	`received_at` text NOT NULL,
	`processed_at` text NOT NULL,
	FOREIGN KEY (`request_id`) REFERENCES `service_requests`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT `integration_intakes_provider_external_event_unique` UNIQUE(`provider`,`external_id`,`event_type`)
);
--> statement-breakpoint
CREATE INDEX `integration_intakes_received_idx`
ON `integration_intakes` (`received_at`);
--> statement-breakpoint
CREATE INDEX `integration_intakes_result_idx`
ON `integration_intakes` (`provider`, `status`, `reason_code`);
--> statement-breakpoint
CREATE TABLE `sms_outbox` (
	`id` text PRIMARY KEY NOT NULL,
	`request_id` text NOT NULL,
	`event_type` text DEFAULT 'REQUEST_CREATED' NOT NULL,
	`status` text DEFAULT 'PENDING' NOT NULL,
	`access_code_ciphertext` text,
	`access_code_iv` text,
	`attempts` integer DEFAULT 0 NOT NULL,
	`next_attempt_at` text NOT NULL,
	`provider_message_id` text,
	`last_error_code` text,
	`sent_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`request_id`) REFERENCES `service_requests`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT `sms_outbox_request_id_unique` UNIQUE(`request_id`)
);
--> statement-breakpoint
CREATE INDEX `sms_outbox_pending_idx`
ON `sms_outbox` (`status`, `next_attempt_at`);
