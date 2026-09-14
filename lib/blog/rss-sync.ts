import { upsertPublishedBlogPost } from "@/data/blog-post-repository";
import { parseNaverRss } from "@/lib/blog/naver-rss";
import { getRuntimeString } from "@/lib/runtime-config";

export async function syncNaverBlogRss(fetchFn: typeof fetch = fetch) {
  const blogId = getRuntimeString("NEXT_PUBLIC_NAVER_BLOG_ID") || "combaksa_repair";
  const response = await fetchFn(`https://rss.blog.naver.com/${encodeURIComponent(blogId)}.xml`, {
    headers: { "User-Agent": "CombaksaWebsite/1.0 (+https://combaksa.pe.kr)" },
  });
  if (!response.ok) throw new Error(`Naver RSS request failed (${response.status}).`);
  const posts = parseNaverRss(await response.text(), blogId);
  for (const post of posts) await upsertPublishedBlogPost(post, "rss");
  return { count: posts.length, blogId };
}
