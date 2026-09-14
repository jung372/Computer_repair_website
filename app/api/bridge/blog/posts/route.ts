import { upsertPublishedBlogPost } from "@/data/blog-post-repository";
import { normalizePublishedPostInput } from "@/lib/blog/post-contract";
import { authorizeMarketingBridge } from "@/lib/marketing/bridge-auth";
import { getRuntimeString } from "@/lib/runtime-config";
import { notifyIndexNow } from "@/lib/blog/indexnow";

export async function POST(request: Request) {
  if (!(await authorizeMarketingBridge(request))) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const configuredBlogId = getRuntimeString("NEXT_PUBLIC_NAVER_BLOG_ID") || "combaksa_repair";
    const post = normalizePublishedPostInput(await request.json(), configuredBlogId);
    await upsertPublishedBlogPost(post, "event");
    const indexNowNotified = await notifyIndexNow(post.canonicalUrl);
    return Response.json({ ok: true, postId: post.postId, canonicalUrl: post.canonicalUrl, indexNowNotified });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Invalid post" }, { status: 400 });
  }
}
