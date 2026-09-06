import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { normalizePublishedPostInput } from "../lib/blog/post-contract.ts";
import {
  enrichNaverPostThumbnail,
  extractNaverThumbnail,
  isSafeNaverThumbnailUrl,
  parseNaverRss,
} from "../lib/blog/naver-rss.ts";

test("published post contract accepts only the configured Naver blog and removes region from non-repair posts", () => {
  const repair = normalizePublishedPostInput({
    schemaVersion: 1,
    platform: "naver",
    blogId: "combaksa_repair",
    postUrl: "https://blog.naver.com/combaksa_repair/224000000001",
    title: "광진구 SSD 업그레이드 수리일지",
    excerpt: "SSD를 교체하고 Windows 정상 작동을 확인했습니다.",
    contentType: "repair_diary",
    district: "광진구",
    publishedAt: "2026-09-02T00:00:00.000Z",
  }, "combaksa_repair");
  assert.equal(repair.postId, "224000000001");
  assert.equal(repair.district, "광진구");

  const guide = normalizePublishedPostInput({
    ...repair,
    postUrl: "https://blog.naver.com/combaksa_repair/224000000002",
    contentType: "symptom_guide",
    district: "광진구",
  }, "combaksa_repair");
  assert.equal(guide.district, "");

  assert.throws(() => normalizePublishedPostInput({
    ...repair,
    postUrl: "https://evil.example/combaksa_repair/224000000001",
  }, "combaksa_repair"), /네이버 블로그/);
  assert.throws(() => normalizePublishedPostInput({
    ...repair,
    postUrl: "https://blog.naver.com/another_blog/224000000001",
  }, "combaksa_repair"), /블로그 ID/);
});

test("RSS recovery parses public Naver entries into the same post contract", () => {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
  <rss><channel><item>
    <title><![CDATA[컴퓨터 전원 점검 순서]]></title>
    <link>https://blog.naver.com/combaksa_repair/224000000003</link>
    <description><![CDATA[전원이 켜지지 않을 때 확인할 내용을 정리했습니다.]]></description>
    <category><![CDATA[FAQ]]></category>
    <pubDate>Wed, 02 Sep 2026 09:00:00 +0900</pubDate>
  </item></channel></rss>`;
  const [post] = parseNaverRss(xml, "combaksa_repair");
  assert.equal(post.title, "컴퓨터 전원 점검 순서");
  assert.equal(post.contentType, "symptom_guide");
  assert.equal(post.postId, "224000000003");
});

test("extracts a safe Naver representative photo from PostView metadata", async () => {
  const thumbnail = "https://blogthumb.pstatic.net/example/repair.png?type=w2&size=900";
  const html = `<html><head><meta content="${thumbnail.replace("&", "&amp;")}" property="og:image"></head></html>`;
  assert.equal(extractNaverThumbnail(html), thumbnail);
  assert.equal(isSafeNaverThumbnailUrl(thumbnail), true);
  assert.equal(isSafeNaverThumbnailUrl("https://pstatic.net.evil.example/repair.png"), false);
  assert.equal(
    extractNaverThumbnail('<meta property="og:image" content="https://evil.example/repair.png">'),
    "",
  );

  const post = normalizePublishedPostInput({
    postUrl: "https://blog.naver.com/combaksa_repair/224000000004",
    title: "대표사진이 있는 수리일지",
    publishedAt: "2026-09-03T00:00:00.000Z",
  }, "combaksa_repair");
  let requestedUrl = "";
  const enriched = await enrichNaverPostThumbnail(post, async (url) => {
    requestedUrl = String(url);
    return new Response(html, { status: 200 });
  });
  assert.match(requestedUrl, /PostView\.naver\?blogId=combaksa_repair&logNo=224000000004/);
  assert.equal(enriched.thumbnailUrl, thumbnail);
});

test("homepage integration is durable, authenticated, crawlable, and scheduled for RSS recovery", async () => {
  const root = new URL("../", import.meta.url);
  const [schema, migration, route, home, section, styles, footer, worker, wrangler, nextConfig, rssSync] = await Promise.all([
    readFile(new URL("db/schema.ts", root), "utf8"),
    readFile(new URL("drizzle/0014_blog_posts.sql", root), "utf8"),
    readFile(new URL("app/api/bridge/blog/posts/route.ts", root), "utf8"),
    readFile(new URL("app/page.tsx", root), "utf8"),
    readFile(new URL("components/blog-notes-section.tsx", root), "utf8"),
    readFile(new URL("app/globals.css", root), "utf8"),
    readFile(new URL("components/site-footer.tsx", root), "utf8"),
    readFile(new URL("worker/index.ts", root), "utf8"),
    readFile(new URL("wrangler.jsonc", root), "utf8"),
    readFile(new URL("next.config.ts", root), "utf8"),
    readFile(new URL("lib/blog/rss-sync.ts", root), "utf8"),
  ]);
  assert.match(schema, /blogPosts/);
  assert.match(migration, /CREATE TABLE `blog_posts`/);
  assert.match(migration, /post_url.*UNIQUE/is);
  assert.match(route, /authorizeMarketingBridge/);
  assert.match(route, /upsertPublishedBlogPost/);
  assert.match(route, /enrichNaverPostThumbnail/);
  assert.match(home, /listPublishedBlogPosts\(3\)/);
  assert.match(home, /<BlogNotesSection/);
  assert.ok(home.indexOf("<BlogNotesSection") < home.indexOf('className="final-cta"'));
  assert.match(section, /컴박사가 직접 정리한 수리 노트/);
  assert.match(section, /src={`\/blog-thumbnail\/\${post\.postId}`}/);
  assert.match(section, /className="blog-note-photo"/);
  assert.match(section, /fill/);
  assert.match(section, /unoptimized/);
  assert.match(section, /loading="lazy"/);
  assert.match(section, /target="_blank"/);
  assert.match(section, /rel="noopener noreferrer"/);
  assert.match(styles, /\.blog-note-photo\s*\{[^}]*aspect-ratio: 16 \/ 9;/s);
  assert.match(styles, /\.blog-note-photo img\s*\{[^}]*object-fit: cover;/s);
  assert.match(styles, /@media \(max-width: 580px\)[\s\S]*\.blog-notes-grid\.blog-notes-count-2\s*\{\s*grid-template-columns: 1fr;/);
  assert.match(footer, /컴박사 블로그/);
  assert.match(worker, /syncNaverBlogRss/);
  assert.match(worker, /BLOG_THUMBNAIL_PATH = \/\^\\\/blog-thumbnail/);
  assert.match(worker, /SELECT thumbnail_url FROM blog_posts/);
  assert.match(worker, /\.bind\(postId\)/);
  assert.match(worker, /BLOG_THUMBNAIL_CONTENT_TYPES\.has\(contentType\)/);
  assert.match(worker, /env\.ASSETS\.fetch/);
  assert.match(worker, /img-src 'self' data:/);
  assert.doesNotMatch(nextConfig, /pstatic\.net/);
  assert.match(rssSync, /listPublishedBlogPosts\(6\)/);
  assert.match(rssSync, /enrichNaverPostThumbnail/);
  assert.match(wrangler, /"17 \* \* \* \*"/);
});
