import { getRuntimeString } from "@/lib/runtime-config";
import { CONTENT_ORIGIN } from "@/lib/blog/post-contract";

export async function notifyIndexNow(canonicalUrl: string, fetchFn: typeof fetch = fetch) {
  const key = getRuntimeString("INDEXNOW_KEY");
  if (!key || !/^[a-f0-9]{32,128}$/i.test(key)) return false;
  try {
    const response = await fetchFn("https://api.indexnow.org/indexnow", {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({
        host: new URL(CONTENT_ORIGIN).hostname,
        key,
        keyLocation: `${CONTENT_ORIGIN}/indexnow-key.txt`,
        urlList: [canonicalUrl],
      }),
      signal: AbortSignal.timeout(4_000),
    });
    return response.ok;
  } catch {
    return false;
  }
}
