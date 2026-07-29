ALTER TABLE `service_requests` ADD COLUMN `lookup_key` text;
--> statement-breakpoint
CREATE INDEX `service_requests_lookup_phone_idx`
  ON `service_requests` (`lookup_key`, `phone`);
--> statement-breakpoint
CREATE TABLE `customer_lookup_sessions` (
  `id` text PRIMARY KEY NOT NULL,
  `token_hash` text NOT NULL,
  `expires_at` text NOT NULL,
  `created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `customer_lookup_sessions_token_hash_unique`
  ON `customer_lookup_sessions` (`token_hash`);
--> statement-breakpoint
CREATE TABLE `customer_lookup_session_requests` (
  `session_id` text NOT NULL,
  `request_id` text NOT NULL,
  `created_at` text NOT NULL,
  PRIMARY KEY (`session_id`, `request_id`),
  FOREIGN KEY (`session_id`) REFERENCES `customer_lookup_sessions`(`id`)
    ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`request_id`) REFERENCES `service_requests`(`id`)
    ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `customer_lookup_request_idx`
  ON `customer_lookup_session_requests` (`request_id`);
--> statement-breakpoint
CREATE TABLE `security_settings` (
  `key` text PRIMARY KEY NOT NULL,
  `value` text NOT NULL,
  `updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `admins` (
  `id` text PRIMARY KEY NOT NULL,
  `login_name` text NOT NULL,
  `password_hash` text NOT NULL,
  `is_active` integer DEFAULT 1 NOT NULL,
  `session_version` integer DEFAULT 1 NOT NULL,
  `password_changed_at` text NOT NULL,
  `last_login_at` text,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `admins_login_name_unique` ON `admins` (`login_name`);
--> statement-breakpoint
CREATE TABLE `admin_audit_logs` (
  `id` text PRIMARY KEY NOT NULL,
  `admin_id` text,
  `event_type` text NOT NULL,
  `client_hash` text,
  `metadata` text,
  `created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `admin_audit_created_idx` ON `admin_audit_logs` (`created_at`);
