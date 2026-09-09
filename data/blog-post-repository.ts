import { ensureDatabase, getD1 } from "@/data/database";
import type { NormalizedPublishedBlogPost } from "@/lib/blog/post-contract";

export type BlogPostRow = NormalizedPublishedBlogPost & {
  id: string;
  source: "event" | "rss";
  visibility: "PUBLISHED" | "HIDDEN";
  syncedAt: string;
};

type RawBlogPost = {
  id: string; platform: "naver"; blog_id: string; post_id: string; post_url: string;
  title: string; excerpt: string; content_type: NormalizedPublishedBlogPost["contentType"];
  district: string; thumbnail_url: string; published_at: string; source_job_id: string;
  source: "event" | "rss"; visibility: "PUBLISHED" | "HIDDEN"; synced_at: string;
};

function mapPost(row: RawBlogPost): BlogPostRow {
  return {
    id: row.id, platform: row.platform, blogId: row.blog_id, postId: row.post_id,
    postUrl: row.post_url, title: row.title, excerpt: row.excerpt,
    contentType: row.content_type, district: row.district, thumbnailUrl: row.thumbnail_url,
    publishedAt: row.published_at, sourceJobId: row.source_job_id, source: row.source,
    visibility: row.visibility, syncedAt: row.synced_at,
  };
}
export async function upsertPublishedBlogPost(
  post: NormalizedPublishedBlogPost,
  source: "event" | "rss",
) {
  await ensureDatabase();
  const now = new Date().toISOString();
  const id = `blog_post_${post.blogId}_${post.postId}`;
  await getD1().prepare(`INSERT INTO blog_posts (
    id, platform, blog_id, post_id, post_url, title, excerpt, content_type, district,
    thumbnail_url, published_at, source_job_id, source, visibility, synced_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PUBLISHED', ?)
  ON CONFLICT(post_url) DO UPDATE SET
    title = excluded.title,
    excerpt = CASE WHEN excluded.excerpt = '' THEN blog_posts.excerpt ELSE excluded.excerpt END,
    content_type = CASE WHEN blog_posts.source = 'event' AND excluded.source = 'rss' THEN blog_posts.content_type ELSE excluded.content_type END,
    district = CASE WHEN blog_posts.source = 'event' AND excluded.source = 'rss' THEN blog_posts.district ELSE excluded.district END,
    thumbnail_url = CASE WHEN excluded.thumbnail_url = '' THEN blog_posts.thumbnail_url ELSE excluded.thumbnail_url END,
    published_at = excluded.published_at,
    source_job_id = CASE WHEN excluded.source_job_id = '' THEN blog_posts.source_job_id ELSE excluded.source_job_id END,
    source = CASE WHEN blog_posts.source = 'event' THEN 'event' ELSE excluded.source END,
    visibility = blog_posts.visibility,
    synced_at = excluded.synced_at`)
    .bind(id, post.platform, post.blogId, post.postId, post.postUrl, post.title, post.excerpt,
      post.contentType, post.district, post.thumbnailUrl, post.publishedAt, post.sourceJobId,
      source, now).run();
}

export async function listAllBlogPosts(limit = 100): Promise<BlogPostRow[]> {
  await ensureDatabase();
  const rows = await getD1().prepare(`SELECT * FROM blog_posts
    ORDER BY published_at DESC LIMIT ?`)
    .bind(Math.max(1, Math.min(200, Math.trunc(limit)))).all<RawBlogPost>();
  return rows.results.map(mapPost);
}

export async function setBlogPostVisibility(
  id: string,
  visibility: "PUBLISHED" | "HIDDEN",
) {
  await ensureDatabase();
  const result = await getD1().prepare(`
    UPDATE blog_posts SET visibility = ?, synced_at = ? WHERE id = ?
  `).bind(visibility, new Date().toISOString(), id).run();
  return result.meta.changes === 1;
}

export async function recordBlogSyncSuccess(source = "naver-rss") {
  await ensureDatabase();
  const now = new Date().toISOString();
  await getD1().prepare(`
    INSERT INTO blog_sync_state (source, last_success_at, last_failure_at, last_error, updated_at)
    VALUES (?, ?, NULL, NULL, ?)
    ON CONFLICT(source) DO UPDATE SET
      last_success_at = excluded.last_success_at,
      last_error = NULL,
      updated_at = excluded.updated_at
  `).bind(source, now, now).run();
}

export async function recordBlogSyncFailure(error: string, source = "naver-rss") {
  await ensureDatabase();
  const now = new Date().toISOString();
  await getD1().prepare(`
    INSERT INTO blog_sync_state (source, last_success_at, last_failure_at, last_error, updated_at)
    VALUES (?, NULL, ?, ?, ?)
    ON CONFLICT(source) DO UPDATE SET
      last_failure_at = excluded.last_failure_at,
      last_error = excluded.last_error,
      updated_at = excluded.updated_at
  `).bind(source, now, error.slice(0, 240), now).run();
}

export async function getBlogSyncState(source = "naver-rss") {
  await ensureDatabase();
  return getD1().prepare(`
    SELECT source, last_success_at AS lastSuccessAt, last_failure_at AS lastFailureAt,
           last_error AS lastError, updated_at AS updatedAt
    FROM blog_sync_state WHERE source = ?
  `).bind(source).first<{
    source: string;
    lastSuccessAt: string | null;
    lastFailureAt: string | null;
    lastError: string | null;
    updatedAt: string;
  }>();
}

export async function listPublishedBlogPosts(limit = 3): Promise<BlogPostRow[]> {
  await ensureDatabase();
  const rows = await getD1().prepare(`SELECT * FROM blog_posts
    WHERE visibility = 'PUBLISHED' ORDER BY published_at DESC LIMIT ?`)
    .bind(Math.max(1, Math.min(12, Math.trunc(limit)))).all<RawBlogPost>();
  return rows.results.map(mapPost);
}
