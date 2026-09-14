const SERVICE_HOST = "combaksa.pe.kr";
const CONTENT_HOST = "combaksa-repair.com";

const CANONICAL_HOSTS = new Set([SERVICE_HOST, CONTENT_HOST]);
const ALIAS_TARGETS = new Map([
  ["www.combaksa.pe.kr", SERVICE_HOST],
  ["www.combaksa-repair.com", CONTENT_HOST],
  ["combaksa-computer-repair.jung372.workers.dev", SERVICE_HOST],
]);

/**
 * Keeps the service site and content archive on their own public domains.
 * Only HTTP and explicit aliases are redirected to the matching HTTPS host.
 */
export function getCanonicalRedirectUrl(url: URL): URL | null {
  const hostname = url.hostname.toLowerCase();
  const targetHost = CANONICAL_HOSTS.has(hostname) ? hostname : ALIAS_TARGETS.get(hostname);

  if (!targetHost) return null;
  if (hostname === targetHost && url.protocol === "https:") return null;

  const canonicalUrl = new URL(url);
  canonicalUrl.protocol = "https:";
  canonicalUrl.hostname = targetHost;
  canonicalUrl.port = "";
  return canonicalUrl;
}
