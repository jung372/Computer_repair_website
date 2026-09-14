import { ensureDatabase, getD1 } from "@/data/database";
import type { NormalizedPublishedBlogPost } from "@/lib/blog/post-contract";
import type { EvidenceCard, PublishedSource } from "@/lib/blog/post-contract";

export type BlogPostRow = NormalizedPublishedBlogPost & {
  id: string;
  source: "event" | "rss";
  visibility: "PUBLISHED";
  syncedAt: string;
};

type RawBlogPost = {
  id: string; platform: "naver"; blog_id: string; post_id: string; post_url: string;
  title: string; excerpt: string; content_type: NormalizedPublishedBlogPost["contentType"];
  district: string; thumbnail_url: string; published_at: string; source_job_id: string;
  article: string; sources: string; evidence_cards: string; canonical_url: string;
  source: "event" | "rss"; visibility: "PUBLISHED"; synced_at: string;
};

function parseJsonArray<T>(value: string): T[] {
  try {
    const parsed = JSON.parse(value || "[]");
    return Array.isArray(parsed) ? parsed as T[] : [];
  } catch {
    return [];
  }
}

function mapPost(row: RawBlogPost): BlogPostRow {
  return {
    id: row.id, platform: row.platform, blogId: row.blog_id, postId: row.post_id,
    postUrl: row.post_url, title: row.title, excerpt: row.excerpt,
    contentType: row.content_type, district: row.district, thumbnailUrl: row.thumbnail_url,
    publishedAt: row.published_at, sourceJobId: row.source_job_id, source: row.source,
    article: row.article || "", sources: parseJsonArray<PublishedSource>(row.sources),
    evidenceCards: parseJsonArray<EvidenceCard>(row.evidence_cards),
    canonicalUrl: row.canonical_url || `https://combaksa-repair.com/insights/${row.post_id}`,
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
    thumbnail_url, published_at, source_job_id, article, sources, evidence_cards,
    canonical_url, source, visibility, synced_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PUBLISHED', ?)
  ON CONFLICT(post_url) DO UPDATE SET
    title = excluded.title,
    excerpt = CASE WHEN excluded.excerpt = '' THEN blog_posts.excerpt ELSE excluded.excerpt END,
    content_type = CASE WHEN blog_posts.source = 'event' AND excluded.source = 'rss' THEN blog_posts.content_type ELSE excluded.content_type END,
    district = CASE WHEN blog_posts.source = 'event' AND excluded.source = 'rss' THEN blog_posts.district ELSE excluded.district END,
    thumbnail_url = CASE WHEN excluded.thumbnail_url = '' THEN blog_posts.thumbnail_url ELSE excluded.thumbnail_url END,
    published_at = excluded.published_at,
    source_job_id = CASE WHEN excluded.source_job_id = '' THEN blog_posts.source_job_id ELSE excluded.source_job_id END,
    article = CASE WHEN excluded.article = '' THEN blog_posts.article ELSE excluded.article END,
    sources = CASE WHEN excluded.sources = '[]' THEN blog_posts.sources ELSE excluded.sources END,
    evidence_cards = CASE WHEN excluded.evidence_cards = '[]' THEN blog_posts.evidence_cards ELSE excluded.evidence_cards END,
    canonical_url = CASE WHEN excluded.canonical_url = '' THEN blog_posts.canonical_url ELSE excluded.canonical_url END,
    source = CASE WHEN blog_posts.source = 'event' THEN 'event' ELSE excluded.source END,
    visibility = 'PUBLISHED',
    synced_at = excluded.synced_at`)
    .bind(id, post.platform, post.blogId, post.postId, post.postUrl, post.title, post.excerpt,
      post.contentType, post.district, post.thumbnailUrl, post.publishedAt, post.sourceJobId,
      post.article, JSON.stringify(post.sources), JSON.stringify(post.evidenceCards), post.canonicalUrl,
      source, now).run();
}

export async function listPublishedBlogPosts(limit = 3): Promise<BlogPostRow[]> {
  await ensureDatabase();
  const rows = await getD1().prepare(`SELECT * FROM blog_posts
    WHERE visibility = 'PUBLISHED' ORDER BY published_at DESC LIMIT ?`)
    .bind(Math.max(1, Math.min(200, Math.trunc(limit)))).all<RawBlogPost>();
  return rows.results.map(mapPost);
}

export async function listPublishedRepairCases(limit = 3): Promise<BlogPostRow[]> {
  await ensureDatabase();
  const rows = await getD1().prepare(`SELECT * FROM blog_posts
    WHERE visibility = 'PUBLISHED' AND content_type = 'repair_diary'
    ORDER BY published_at DESC LIMIT ?`)
    .bind(Math.max(1, Math.min(12, Math.trunc(limit)))).all<RawBlogPost>();
  return rows.results.map(mapPost);
}

export async function getPublishedBlogPost(postId: string): Promise<BlogPostRow | null> {
  await ensureDatabase();
  const row = await getD1().prepare(`SELECT * FROM blog_posts
    WHERE visibility = 'PUBLISHED' AND post_id = ? LIMIT 1`)
    .bind(String(postId)).first<RawBlogPost>();
  return row ? mapPost(row) : null;
}
