export const BLOG_CONTENT_TYPES = [
  "repair_diary",
  "symptom_guide",
  "hardware_news",
  "recommended",
] as const;

export type BlogContentType = (typeof BLOG_CONTENT_TYPES)[number];

export type PublishedBlogPostInput = {
  schemaVersion?: number;
  platform?: string;
  blogId?: string;
  postUrl?: string;
  title?: string;
  excerpt?: string;
  contentType?: string;
  district?: string;
  thumbnailUrl?: string;
  publishedAt?: string;
  sourceJobId?: string;
};

export type NormalizedPublishedBlogPost = {
  platform: "naver";
  blogId: string;
  postId: string;
  postUrl: string;
  title: string;
  excerpt: string;
  contentType: BlogContentType;
  district: string;
  thumbnailUrl: string;
  publishedAt: string;
  sourceJobId: string;
};

function cleanText(value: unknown, maxLength: number) {
  return String(value || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}
function naverPostIdentity(rawUrl: string) {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error("게시물 URL이 올바르지 않습니다.");
  }
  if (url.protocol !== "https:" || url.hostname.toLowerCase() !== "blog.naver.com") {
    throw new Error("네이버 블로그 HTTPS 게시물만 등록할 수 있습니다.");
  }
  const pathMatch = url.pathname.match(/^\/([^/]+)\/(\d{6,})\/?$/);
  if (pathMatch) return { blogId: decodeURIComponent(pathMatch[1]), postId: pathMatch[2] };
  if (/^\/PostView\.naver$/i.test(url.pathname)) {
    const blogId = url.searchParams.get("blogId") || "";
    const postId = url.searchParams.get("logNo") || "";
    if (blogId && /^\d{6,}$/.test(postId)) return { blogId, postId };
  }
  throw new Error("네이버 블로그 게시물 주소 형식을 확인해 주세요.");
}

export function normalizePublishedPostInput(
  input: PublishedBlogPostInput,
  configuredBlogId: string,
): NormalizedPublishedBlogPost {
  if (Number(input.schemaVersion || 1) !== 1) throw new Error("지원하지 않는 게시물 스키마입니다.");
  if (String(input.platform || "naver").toLowerCase() !== "naver") throw new Error("네이버 게시물만 등록할 수 있습니다.");
  const allowedBlogId = cleanText(configuredBlogId, 120);
  const identity = naverPostIdentity(String(input.postUrl || ""));
  const payloadBlogId = cleanText(input.blogId || identity.blogId, 120);
  if (!allowedBlogId || identity.blogId !== allowedBlogId || payloadBlogId !== allowedBlogId) {
    throw new Error("설정된 컴박사 블로그 ID와 게시물 주소가 일치하지 않습니다.");
  }
  const title = cleanText(input.title, 180);
  if (!title) throw new Error("게시물 제목이 필요합니다.");
  const contentType = BLOG_CONTENT_TYPES.includes(input.contentType as BlogContentType)
    ? input.contentType as BlogContentType
    : "recommended";
  const date = new Date(String(input.publishedAt || ""));
  if (Number.isNaN(date.getTime())) throw new Error("게시물 발행 시각이 올바르지 않습니다.");
  const district = contentType === "repair_diary" ? cleanText(input.district, 40) : "";
  return {
    platform: "naver",
    blogId: allowedBlogId,
    postId: identity.postId,
    postUrl: `https://blog.naver.com/${encodeURIComponent(allowedBlogId)}/${identity.postId}`,
    title,
    excerpt: cleanText(input.excerpt, 260),
    contentType,
    district,
    thumbnailUrl: cleanText(input.thumbnailUrl, 1000),
    publishedAt: date.toISOString(),
    sourceJobId: cleanText(input.sourceJobId, 160),
  };
}

export function blogContentTypeFromCategory(category: string): BlogContentType {
  const value = cleanText(category, 100);
  if (/수리\s*일지/i.test(value)) return "repair_diary";
  if (/FAQ|증상|조치|점검/i.test(value)) return "symptom_guide";
  if (/하드웨어|출시|부품/i.test(value)) return "hardware_news";
  return "recommended";
}
