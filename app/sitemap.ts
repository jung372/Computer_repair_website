import type { MetadataRoute } from "next";
import { listPublishedBlogPosts } from "@/data/blog-post-repository";
import { CONTENT_ORIGIN } from "@/lib/blog/post-contract";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const posts = await listPublishedBlogPosts(200);
  const staticPaths = ["", "/insights", "/services/desktop", "/services/laptop", "/services/monitor", "/services/apple", "/services/data-recovery"];
  return [
    ...staticPaths.map((pathname) => ({
      url: `${CONTENT_ORIGIN}${pathname || "/"}`,
      changeFrequency: pathname ? "monthly" as const : "weekly" as const,
      priority: pathname ? 0.7 : 1,
    })),
    ...posts.map((post) => ({
      url: `${CONTENT_ORIGIN}/insights/${post.postId}`,
      lastModified: new Date(post.syncedAt || post.publishedAt),
      changeFrequency: "monthly" as const,
      priority: post.contentType === "repair_diary" ? 0.9 : 0.8,
    })),
  ];
}
