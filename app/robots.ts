import type { MetadataRoute } from "next";
import { CONTENT_ORIGIN } from "@/lib/blog/post-contract";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: ["/admin/", "/api/", "/requests/"] },
      { userAgent: "OAI-SearchBot", allow: "/" },
    ],
    sitemap: `${CONTENT_ORIGIN}/sitemap.xml`,
    host: CONTENT_ORIGIN,
  };
}
