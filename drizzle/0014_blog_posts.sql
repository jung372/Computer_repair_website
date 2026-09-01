CREATE TABLE `blog_posts` (
  `id` text PRIMARY KEY NOT NULL,
  `platform` text DEFAULT 'naver' NOT NULL,
  `blog_id` text NOT NULL,
  `post_id` text NOT NULL,
  `post_url` text NOT NULL UNIQUE,
  `title` text NOT NULL,
  `excerpt` text DEFAULT '' NOT NULL,
  `content_type` text DEFAULT 'recommended' NOT NULL,
  `district` text DEFAULT '' NOT NULL,
  `thumbnail_url` text DEFAULT '' NOT NULL,
  `published_at` text NOT NULL,
  `source_job_id` text DEFAULT '' NOT NULL,
  `source` text NOT NULL,
  `visibility` text DEFAULT 'PUBLISHED' NOT NULL,
  `synced_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `blog_posts_platform_post_unique` ON `blog_posts` (`platform`, `blog_id`, `post_id`);
--> statement-breakpoint
CREATE INDEX `blog_posts_visibility_published_idx` ON `blog_posts` (`visibility`, `published_at`);
