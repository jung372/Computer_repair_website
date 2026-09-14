import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { normalizePublishedPostInput } from "../lib/blog/post-contract.ts";
import { parseNaverRss } from "../lib/blog/naver-rss.ts";

test("published post contract accepts only the configured Naver blog and removes region from non-repair posts", () => {
  const repair = normalizePublishedPostInput({
    schemaVersion: 2,
    platform: "naver",
    blogId: "combaksa_repair",
    postUrl: "https://blog.naver.com/combaksa_repair/224000000001",
    title: "광진구 SSD 업그레이드 수리일지",
    excerpt: "SSD를 교체하고 Windows 정상 작동을 확인했습니다.",
    contentType: "repair_diary",
    district: "광진구",
    publishedAt: "2026-09-02T00:00:00.000Z",
    article: "[SECTION - 접수 증상]\n부팅이 멈춰 저장장치 상태를 점검했습니다.",
    sources: [{ sourceId: "microsoft-1", title: "Windows 복구 공식 문서", url: "https://support.microsoft.com/ko-kr/windows/recovery", publisher: "Microsoft", checkedAt: "2026-09-15T00:00:00.000Z" }],
    evidenceCards: [{ sourceId: "microsoft-1", claim: "Windows 복구 환경의 시작 복구 절차", supportingText: "시작 복구로 부팅 문제를 점검할 수 있습니다.", sourceType: "official_primary" }],
    originUrl: "https://combaksa-repair.com",
  }, "combaksa_repair");
  assert.equal(repair.postId, "224000000001");
  assert.equal(repair.district, "광진구");
  assert.match(repair.article, /저장장치 상태/);
  assert.equal(repair.sources.length, 1);
  assert.equal(repair.evidenceCards.length, 1);
  assert.equal(repair.canonicalUrl, "https://combaksa-repair.com/insights/224000000001");

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

test("homepage integration is durable, authenticated, crawlable, and scheduled for RSS recovery", async () => {
  const root = new URL("../", import.meta.url);
  const [schema, migration, evidenceMigration, route, articlePage, archivePage, home, repository, section, styles, footer, header, worker, wrangler, robots, sitemap] = await Promise.all([
    readFile(new URL("db/schema.ts", root), "utf8"),
    readFile(new URL("drizzle/0014_blog_posts.sql", root), "utf8"),
    readFile(new URL("drizzle/0015_blog_post_evidence.sql", root), "utf8"),
    readFile(new URL("app/api/bridge/blog/posts/route.ts", root), "utf8"),
    readFile(new URL("app/insights/[postId]/page.tsx", root), "utf8"),
    readFile(new URL("app/insights/page.tsx", root), "utf8"),
    readFile(new URL("app/page.tsx", root), "utf8"),
    readFile(new URL("data/blog-post-repository.ts", root), "utf8"),
    readFile(new URL("components/blog-notes-section.tsx", root), "utf8"),
    readFile(new URL("app/globals.css", root), "utf8"),
    readFile(new URL("components/site-footer.tsx", root), "utf8"),
    readFile(new URL("components/site-header.tsx", root), "utf8"),
    readFile(new URL("worker/index.ts", root), "utf8"),
    readFile(new URL("wrangler.jsonc", root), "utf8"),
    readFile(new URL("app/robots.ts", root), "utf8"),
    readFile(new URL("app/sitemap.ts", root), "utf8"),
  ]);
  assert.match(schema, /blogPosts/);
  assert.match(migration, /CREATE TABLE `blog_posts`/);
  assert.match(migration, /post_url.*UNIQUE/is);
  assert.match(route, /authorizeMarketingBridge/);
  assert.match(route, /upsertPublishedBlogPost/);
  assert.match(route, /notifyIndexNow/);
  assert.match(evidenceMigration, /article/);
  assert.match(evidenceMigration, /evidence_cards/);
  assert.match(articlePage, /BlogPosting/);
  assert.match(articlePage, /근거 카드/);
  assert.match(articlePage, /getPublishedBlogPost/);
  assert.match(archivePage, /listPublishedBlogPosts/);
  assert.match(archivePage, /insight-archive-grid/);
  assert.match(home, /listPublishedBlogPosts\(6\)/);
  assert.match(home, /<BlogNotesSection/);
  assert.ok(home.indexOf("<BlogNotesSection") < home.indexOf('className="final-cta"'));
  assert.match(repository, /content_type = 'repair_diary'/);
  assert.match(section, /id="repair-cases"/);
  assert.match(section, /수리 기록과 컴퓨터 정보를 한곳에서/);
  assert.match(section, /근거/);
  assert.match(section, /href={`\/insights\/\$\{post\.postId\}`}/);
  assert.match(section, /href="\/requests\/new"/);
  assert.match(section, /target="_blank"/);
  assert.match(section, /rel="noopener noreferrer"/);
  assert.match(styles, /@media \(max-width: 580px\)[\s\S]*\.blog-notes-grid\.blog-notes-count-2\s*\{\s*grid-template-columns: 1fr;/);
  assert.match(footer, /href="\/insights"[^>]*>수리·정보/);
  assert.match(header, /href: "\/insights"/);
  assert.match(footer, /컴박사 블로그/);
  assert.match(worker, /syncNaverBlogRss/);
  assert.match(wrangler, /"17 \* \* \* \*"/);
  assert.match(wrangler, /combaksa-repair\.com/);
  assert.match(wrangler, /"PUBLIC_BASE_URL": "https:\/\/combaksa\.pe\.kr"/);
  assert.match(robots, /OAI-SearchBot/);
  assert.match(robots, /sitemap\.xml/);
  assert.match(sitemap, /listPublishedBlogPosts/);
  assert.match(sitemap, /\/insights\//);
});
