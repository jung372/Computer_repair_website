ALTER TABLE `blog_posts` ADD `article` text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE `blog_posts` ADD `sources` text DEFAULT '[]' NOT NULL;
--> statement-breakpoint
ALTER TABLE `blog_posts` ADD `evidence_cards` text DEFAULT '[]' NOT NULL;
--> statement-breakpoint
ALTER TABLE `blog_posts` ADD `canonical_url` text DEFAULT '' NOT NULL;
