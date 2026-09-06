import {
  listPublishedBlogPosts,
  upsertPublishedBlogPost,
} from "@/data/blog-post-repository";
import { enrichNaverPostThumbnail, parseNaverRss } from "@/lib/blog/naver-rss";
import { getRuntimeString } from "@/lib/runtime-config";

const NAVER_FETCH_HEADERS = {
  "User-Agent": "CombaksaWebsite/1.0 (+https://combaksa.pe.kr)",
};

export async function syncNaverBlogRss(fetchFn: typeof fetch = fetch) {
  const blogId = getRuntimeString("NEXT_PUBLIC_NAVER_BLOG_ID") || "combaksa_repair";
  const response = await fetchFn(`https://rss.blog.naver.com/${encodeURIComponent(blogId)}.xml`, {
    headers: NAVER_FETCH_HEADERS,
  });
  if (!response.ok) throw new Error(`Naver RSS request failed (${response.status}).`);
  const posts = parseNaverRss(await response.text(), blogId);
  for (const post of posts) await upsertPublishedBlogPost(post, "rss");

  const missingThumbnails = (await listPublishedBlogPosts(6))
    .filter((post) => !post.thumbnailUrl);
  const enrichedPosts = await Promise.all(
    missingThumbnails.map((post) => enrichNaverPostThumbnail(post, fetchFn)),
  );
  let thumbnailCount = 0;
  for (const post of enrichedPosts) {
    if (!post.thumbnailUrl) continue;
    await upsertPublishedBlogPost(post, "rss");
    thumbnailCount += 1;
  }
  return { count: posts.length, blogId, thumbnailCount };
}
