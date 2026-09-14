ALTER TABLE `service_requests` ADD `source_site` text NOT NULL DEFAULT 'legacy';
--> statement-breakpoint
ALTER TABLE `service_requests` ADD `source_channel` text NOT NULL DEFAULT 'UNKNOWN';
--> statement-breakpoint
ALTER TABLE `service_requests` ADD `origin_host` text;
--> statement-breakpoint
UPDATE `service_requests`
SET `source_channel` = 'VOX'
WHERE EXISTS (
  SELECT 1 FROM `integration_intakes`
  WHERE `integration_intakes`.`request_id` = `service_requests`.`id`
    AND `integration_intakes`.`provider` = 'VOX'
);
--> statement-breakpoint
ALTER TABLE `customer_lookup_sessions` ADD `site_scope` text NOT NULL DEFAULT 'legacy';
--> statement-breakpoint
CREATE TABLE `web_submission_idempotency` (
  `site_scope` text NOT NULL,
  `idempotency_key` text NOT NULL,
  `payload_hash` text NOT NULL,
  `request_id` text NOT NULL,
  `created_at` text NOT NULL,
  PRIMARY KEY (`site_scope`, `idempotency_key`)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `web_submission_request_unique`
ON `web_submission_idempotency` (`request_id`);
--> statement-breakpoint
CREATE INDEX `service_requests_source_idx`
ON `service_requests` (`source_site`, `source_channel`, `created_at`);
--> statement-breakpoint
ALTER TABLE `notification_outbox` ADD `lease_id` text;
--> statement-breakpoint
ALTER TABLE `notification_outbox` ADD `lease_expires_at` text;
--> statement-breakpoint
CREATE INDEX `notification_outbox_lease_idx`
ON `notification_outbox` (`status`, `lease_expires_at`, `next_attempt_at`);
--> statement-breakpoint
CREATE TABLE `blog_sync_state` (
  `source` text PRIMARY KEY NOT NULL,
  `last_success_at` text,
  `last_failure_at` text,
  `last_error` text,
  `updated_at` text NOT NULL
);
