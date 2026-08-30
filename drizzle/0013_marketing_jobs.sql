CREATE TABLE `marketing_jobs` (
  `id` text PRIMARY KEY NOT NULL,
  `schema_version` integer DEFAULT 1 NOT NULL,
  `status` text DEFAULT 'UPLOADING' NOT NULL,
  `symptom` text NOT NULL,
  `cause_unknown` integer DEFAULT 0 NOT NULL,
  `diagnosed_cause` text DEFAULT '' NOT NULL,
  `actions_taken` text NOT NULL,
  `verification_result` text NOT NULL,
  `device_info` text DEFAULT '' NOT NULL,
  `work_duration` text DEFAULT '' NOT NULL,
  `repair_notes` text DEFAULT '' NOT NULL,
  `district` text NOT NULL,
  `photo_consent` integer DEFAULT 0 NOT NULL,
  `privacy_reviewed` integer DEFAULT 0 NOT NULL,
  `photo_evidence_note` text DEFAULT '' NOT NULL,
  `requested_by` text NOT NULL,
  `idempotency_key` text NOT NULL,
  `local_job_id` text,
  `failure_code` text,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `marketing_jobs_idempotency_key_unique` ON `marketing_jobs` (`idempotency_key`);
--> statement-breakpoint
CREATE INDEX `marketing_jobs_status_created_idx` ON `marketing_jobs` (`status`, `created_at`);
--> statement-breakpoint
CREATE INDEX `marketing_jobs_requested_by_idx` ON `marketing_jobs` (`requested_by`, `created_at`);
--> statement-breakpoint
CREATE TABLE `marketing_job_assets` (
  `id` text PRIMARY KEY NOT NULL,
  `job_id` text NOT NULL,
  `sequence` integer NOT NULL,
  `r2_key` text NOT NULL,
  `original_name` text NOT NULL,
  `mime_type` text NOT NULL,
  `size` integer NOT NULL,
  `sha256` text NOT NULL,
  `created_at` text NOT NULL,
  FOREIGN KEY (`job_id`) REFERENCES `marketing_jobs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `marketing_job_assets_r2_key_unique` ON `marketing_job_assets` (`r2_key`);
--> statement-breakpoint
CREATE INDEX `marketing_job_assets_job_idx` ON `marketing_job_assets` (`job_id`, `sequence`);
--> statement-breakpoint
CREATE TABLE `marketing_job_events` (
  `id` text PRIMARY KEY NOT NULL,
  `job_id` text NOT NULL,
  `status` text NOT NULL,
  `actor` text NOT NULL,
  `message` text NOT NULL,
  `metadata` text,
  `created_at` text NOT NULL,
  FOREIGN KEY (`job_id`) REFERENCES `marketing_jobs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `marketing_job_events_job_idx` ON `marketing_job_events` (`job_id`, `created_at`);
