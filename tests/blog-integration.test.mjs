import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { normalizePublishedPostInput } from "../lib/blog/post-contract.ts";
import { parseNaverRss } from "../lib/blog/naver-rss.ts";

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

test("homepage integration is durable, authenticated, crawlable, and scheduled for RSS recovery", async () => {
  const root = new URL("../", import.meta.url);
  const [schema, migration, route, home, section, footer, worker, wrangler] = await Promise.all([
    readFile(new URL("db/schema.ts", root), "utf8"),
    readFile(new URL("drizzle/0014_blog_posts.sql", root), "utf8"),
    readFile(new URL("app/api/bridge/blog/posts/route.ts", root), "utf8"),
    readFile(new URL("app/page.tsx", root), "utf8"),
    readFile(new URL("components/blog-notes-section.tsx", root), "utf8"),
    readFile(new URL("components/site-footer.tsx", root), "utf8"),
    readFile(new URL("worker/index.ts", root), "utf8"),
    readFile(new URL("wrangler.jsonc", root), "utf8"),
  ]);
  assert.match(schema, /blogPosts/);
  assert.match(migration, /CREATE TABLE `blog_posts`/);
  assert.match(migration, /post_url.*UNIQUE/is);
  assert.match(route, /authorizeMarketingBridge/);
  assert.match(route, /upsertPublishedBlogPost/);
  assert.match(home, /listPublishedBlogPosts\(3\)/);
  assert.match(home, /<BlogNotesSection/);
  assert.ok(home.indexOf("<BlogNotesSection") < home.indexOf('className="final-cta"'));
  assert.match(section, /컴박사가 직접 정리한 수리 노트/);
  assert.match(section, /target="_blank"/);
  assert.match(section, /rel="noopener noreferrer"/);
  assert.match(footer, /컴박사 블로그/);
  assert.match(worker, /syncNaverBlogRss/);
  assert.match(wrangler, /"17 \* \* \* \*"/);
});
