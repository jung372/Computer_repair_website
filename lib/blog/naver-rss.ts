import {
  blogContentTypeFromCategory,
  normalizePublishedPostInput,
  type NormalizedPublishedBlogPost,
} from "./post-contract.ts";

function decodeXml(value: string) {
  return value
    .replace(/^<!\[CDATA\[([\s\S]*)\]\]>$/i, "$1")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&amp;/gi, "&");
}

function tag(item: string, name: string) {
  const match = item.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${name}>`, "i"));
  return decodeXml(match?.[1]?.trim() || "");
}

function excerptFromDescription(value: string) {
  return value
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 220);
}

export function parseNaverRss(xml: string, blogId: string): NormalizedPublishedBlogPost[] {
  const items = String(xml || "").match(/<item(?:\s[^>]*)?>[\s\S]*?<\/item>/gi) || [];
  return items.flatMap((item) => {
    try {
      const published = new Date(tag(item, "pubDate"));
      return [normalizePublishedPostInput({
        schemaVersion: 1,
        platform: "naver",
        blogId,
        postUrl: tag(item, "link"),
        title: tag(item, "title"),
        excerpt: excerptFromDescription(tag(item, "description")),
        contentType: blogContentTypeFromCategory(tag(item, "category")),
        publishedAt: published.toISOString(),
      }, blogId)];
    } catch {
      return [];
    }
  });
}
