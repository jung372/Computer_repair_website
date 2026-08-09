const CANONICAL_HOST = "combaksa.pe.kr";

const ALIAS_HOSTS = new Set([
  "www.combaksa.pe.kr",
  "combaksa-computer-repair.jung372.workers.dev",
]);

/**
 * Returns the public canonical URL when a request arrived over HTTP or through
 * a public alias. Preview and local development hosts intentionally stay put.
 */
export function getCanonicalRedirectUrl(url: URL): URL | null {
  const hostname = url.hostname.toLowerCase();
  const isCanonicalHost = hostname === CANONICAL_HOST;

  if (!isCanonicalHost && !ALIAS_HOSTS.has(hostname)) return null;
  if (isCanonicalHost && url.protocol === "https:") return null;

  const canonicalUrl = new URL(url);
  canonicalUrl.protocol = "https:";
  canonicalUrl.hostname = CANONICAL_HOST;
  canonicalUrl.port = "";
  return canonicalUrl;
}
