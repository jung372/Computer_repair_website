/** Cloudflare Worker entry point for the computer repair service. */
import handler from "vinext/server/app-router-entry";
import { runDailyBackup } from "../infrastructure/backup";
import { syncNaverBlogRss } from "../lib/blog/rss-sync";
import {
  deleteExpiredTelegramNotifications,
  processPendingNotifications,
} from "../infrastructure/telegram";
import { isSafeNaverThumbnailUrl } from "../lib/blog/naver-rss";
import { getCanonicalRedirectUrl } from "../lib/canonical-url";
import { getRuntimeString } from "../lib/runtime-config";

/** How many queued notifications one scheduled run may drain. */
const SCHEDULED_NOTIFICATION_BATCH = 10;

/** Must match the daily backup entry in wrangler.jsonc — 03:00 KST. */
const BACKUP_CRON = "0 18 * * *";
const BLOG_RSS_CRON = "17 * * * *";
const BLOG_THUMBNAIL_PATH = /^\/blog-thumbnail\/(\d{6,})$/;
const BLOG_THUMBNAIL_CONTENT_TYPES = new Set([
  "image/gif",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

function blogThumbnailResponse(request: Request, response: Response, contentType?: string) {
  const headers = new Headers();
  headers.set("Cache-Control", "public, max-age=3600, stale-while-revalidate=86400");
  headers.set("Content-Type", contentType || response.headers.get("Content-Type") || "image/webp");
  headers.set("X-Content-Type-Options", "nosniff");
  const contentLength = response.headers.get("Content-Length");
  if (contentLength) headers.set("Content-Length", contentLength);
  return new Response(request.method === "HEAD" ? null : response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

async function serveBlogThumbnail(request: Request, env: Env, postId: string) {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return new Response("Method not allowed", { status: 405, headers: { Allow: "GET, HEAD" } });
  }

  const fallback = async () => {
    const fallbackUrl = new URL("/repair-note-fallback.webp", request.url);
    const response = await env.ASSETS.fetch(new Request(fallbackUrl, { method: request.method }));
    return blogThumbnailResponse(request, response, "image/webp");
  };

  try {
    const row = await env.DB.prepare(`SELECT thumbnail_url FROM blog_posts
      WHERE post_id = ? AND visibility = 'PUBLISHED' LIMIT 1`)
      .bind(postId)
      .first<{ thumbnail_url: string }>();
    if (!row?.thumbnail_url || !isSafeNaverThumbnailUrl(row.thumbnail_url)) return fallback();

    const response = await fetch(row.thumbnail_url, {
      method: request.method,
      headers: { "User-Agent": "CombaksaWebsite/1.0 (+https://combaksa.pe.kr)" },
    });
    const contentType = (response.headers.get("Content-Type") || "").split(";", 1)[0].toLowerCase();
    if (!response.ok || !BLOG_THUMBNAIL_CONTENT_TYPES.has(contentType)) return fallback();
    return blogThumbnailResponse(request, response, contentType);
  } catch {
    return fallback();
  }
}

const worker = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const canonicalUrl = getCanonicalRedirectUrl(url);
    if (canonicalUrl) return Response.redirect(canonicalUrl, 308);

    try {
      const blogThumbnailMatch = url.pathname.match(BLOG_THUMBNAIL_PATH);
      if (blogThumbnailMatch) return serveBlogThumbnail(request, env, blogThumbnailMatch[1]);

      const response = await handler.fetch(request, env, ctx);
      const headers = new Headers(response.headers);
      headers.set("X-Content-Type-Options", "nosniff");
      headers.set("X-Frame-Options", "DENY");
      headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
      headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
      if (
        url.pathname.startsWith("/admin") ||
        url.pathname.startsWith("/api/") ||
        url.pathname === "/requests" ||
        url.pathname.startsWith("/requests/lookup") ||
        /^\/requests\/R-/.test(url.pathname)
      ) {
        headers.set("Cache-Control", "private, no-store, max-age=0");
      }
      if (url.pathname === "/requests" || /^\/requests\/R-/.test(url.pathname)) {
        headers.set("X-Robots-Tag", "noindex, nofollow");
      }
      if (process.env.NODE_ENV === "production") {
        headers.set(
          "Content-Security-Policy",
          "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
        );
      }
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers,
      });
    } catch (error) {
      console.error(JSON.stringify({
        message: "Unhandled application error",
        path: url.pathname,
        error: error instanceof Error ? error.message : String(error),
      }));
      return new Response("Internal server error", { status: 500 });
    }
  },

  /**
   * Two schedules share this handler, so it dispatches on the cron expression.
   * The daily one copies D1 into R2; the frequent one drains notifications that
   * failed while Telegram was unreachable — without it the retry schedule in the
   * outbox only advances when the next request comes in or an operator presses
   * the resend button.
   */
  async scheduled(controller: ScheduledController, _env: Env, ctx: ExecutionContext): Promise<void> {
    if (controller.cron === BACKUP_CRON) {
      ctx.waitUntil(
        runDailyBackup()
          .then((result) => {
            console.log(JSON.stringify({
              message: "Daily D1 backup stored",
              key: result.key,
              bytes: result.bytes,
              totalRows: result.totalRows,
            }));
          })
          .catch((error: unknown) => {
            console.error(JSON.stringify({
              message: "Daily D1 backup failed",
              error: error instanceof Error ? error.message : String(error),
            }));
          }),
      );
      return;
    }

    if (controller.cron === BLOG_RSS_CRON) {
      ctx.waitUntil(
        syncNaverBlogRss()
          .then((result) => console.log(JSON.stringify({
            message: "Naver blog RSS recovery completed",
            blogId: result.blogId,
            count: result.count,
          })))
          .catch((error: unknown) => console.error(JSON.stringify({
            message: "Naver blog RSS recovery failed",
            error: error instanceof Error ? error.message : String(error),
          }))),
      );
      return;
    }

    ctx.waitUntil(
      Promise.all([
        processPendingNotifications(
          getRuntimeString("PUBLIC_BASE_URL"),
          SCHEDULED_NOTIFICATION_BATCH,
        ),
        deleteExpiredTelegramNotifications(SCHEDULED_NOTIFICATION_BATCH),
      ]).catch((error: unknown) => {
        console.error(JSON.stringify({
          message: "Scheduled notification flush failed",
          error: error instanceof Error ? error.message : String(error),
        }));
      }),
    );
  },
} satisfies ExportedHandler<Env>;

export default worker;
