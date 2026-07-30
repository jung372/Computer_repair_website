/** Cloudflare Worker entry point for the computer repair service. */
import handler from "vinext/server/app-router-entry";
import { runDailyBackup } from "../infrastructure/backup";
import { processPendingNotifications } from "../infrastructure/telegram";
import { getRuntimeString } from "../lib/runtime-config";

/** How many queued notifications one scheduled run may drain. */
const SCHEDULED_NOTIFICATION_BATCH = 10;

/** Must match the daily backup entry in wrangler.jsonc — 03:00 KST. */
const BACKUP_CRON = "0 18 * * *";

const worker = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    try {
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

    ctx.waitUntil(
      processPendingNotifications(
        getRuntimeString("PUBLIC_BASE_URL"),
        SCHEDULED_NOTIFICATION_BATCH,
      ).catch((error: unknown) => {
        console.error(JSON.stringify({
          message: "Scheduled notification flush failed",
          error: error instanceof Error ? error.message : String(error),
        }));
      }),
    );
  },
} satisfies ExportedHandler<Env>;

export default worker;
