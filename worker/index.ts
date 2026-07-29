/** Cloudflare Worker entry point for the computer repair service. */
import handler from "vinext/server/app-router-entry";

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
        /^\/requests\/R-/.test(url.pathname)
      ) {
        headers.set("Cache-Control", "private, no-store, max-age=0");
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
} satisfies ExportedHandler<Env>;

export default worker;
