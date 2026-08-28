CREATE TABLE `__new_integration_intakes` (
  `id` text PRIMARY KEY NOT NULL,
  `provider` text NOT NULL,
  `external_id` text NOT NULL,
  `event_type` text NOT NULL,
  `request_id` text,
  `status` text NOT NULL,
  `reason_code` text,
  `payload_hash` text,
  `agent_id` text,
  `agent_version` text,
  `received_at` text NOT NULL,
  `processed_at` text,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL,
  FOREIGN KEY (`request_id`) REFERENCES `service_requests`(`id`)
);
--> statement-breakpoint
INSERT INTO `__new_integration_intakes` (
  `id`, `provider`, `external_id`, `event_type`, `request_id`, `status`,
  `reason_code`, `payload_hash`, `agent_id`, `agent_version`, `received_at`,
  `processed_at`, `created_at`, `updated_at`
)
SELECT
  `id`, `provider`, `external_id`, `event_type`, `request_id`, `status`,
  `reason_code`, `payload_hash`, NULL, NULL, `received_at`, `processed_at`,
  `received_at`, COALESCE(`processed_at`, `received_at`)
FROM `integration_intakes`;
--> statement-breakpoint
DROP TABLE `integration_intakes`;
--> statement-breakpoint
ALTER TABLE `__new_integration_intakes` RENAME TO `integration_intakes`;
--> statement-breakpoint
CREATE UNIQUE INDEX `integration_intakes_provider_event_unique`
ON `integration_intakes` (`provider`, `external_id`, `event_type`);
--> statement-breakpoint
CREATE INDEX `integration_intakes_status_received_idx`
ON `integration_intakes` (`status`, `received_at`);
