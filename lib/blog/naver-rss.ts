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

function htmlAttribute(tag: string, name: string) {
  const match = tag.match(new RegExp(`\\s${name}\\s*=\\s*(["'])(.*?)\\1`, "i"));
  return (match?.[2] || "")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

export function extractNaverThumbnail(html: string) {
  const metaTags = String(html || "").match(/<meta\b[^>]*>/gi) || [];
  for (const meta of metaTags) {
    const property = htmlAttribute(meta, "property") || htmlAttribute(meta, "name");
    if (property.toLowerCase() !== "og:image") continue;
    try {
      const url = new URL(htmlAttribute(meta, "content"));
      if (url.protocol === "https:" && url.hostname.endsWith(".pstatic.net")) {
        return url.toString();
      }
    } catch {
      return "";
    }
  }
  return "";
}

export async function enrichNaverPostThumbnail(
  post: NormalizedPublishedBlogPost,
  fetchFn: typeof fetch = fetch,
) {
  if (post.thumbnailUrl) return post;
  const postViewUrl = new URL("https://blog.naver.com/PostView.naver");
  postViewUrl.searchParams.set("blogId", post.blogId);
  postViewUrl.searchParams.set("logNo", post.postId);
  postViewUrl.searchParams.set("directAccess", "true");
  try {
    const response = await fetchFn(postViewUrl, {
      headers: { "User-Agent": "CombaksaWebsite/1.0 (+https://combaksa.pe.kr)" },
    });
    if (!response.ok) return post;
    const thumbnailUrl = extractNaverThumbnail(await response.text());
    return thumbnailUrl ? { ...post, thumbnailUrl } : post;
  } catch {
    return post;
  }
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
