import { env } from "cloudflare:workers";
import { getMarketingJob } from "@/data/marketing-job-repository";
import { authorizeMarketingBridge } from "@/lib/marketing/bridge-auth";

type PhotoBucket = { get(key: string): Promise<{ body: ReadableStream; size: number } | null> };

export async function GET(request: Request, context: { params: Promise<{ jobId: string; assetId: string }> }) {
  if (!(await authorizeMarketingBridge(request))) return new Response("Unauthorized", { status: 401 });
  const { jobId, assetId } = await context.params;
  const job = await getMarketingJob(jobId);
  const asset = job?.assets.find((item) => item.id === assetId);
  if (!asset) return new Response("Not found", { status: 404 });
  const bucket = (env as unknown as { MARKETING_PHOTOS: PhotoBucket }).MARKETING_PHOTOS;
  const object = await bucket?.get(asset.r2Key);
  if (!object || object.size !== asset.size) return new Response("Stored asset unavailable", { status: 503 });
  return new Response(object.body, {
    headers: {
      "Content-Type": asset.mimeType,
      "Content-Length": String(asset.size),
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "X-Asset-SHA256": asset.sha256,
    },
  });
}
