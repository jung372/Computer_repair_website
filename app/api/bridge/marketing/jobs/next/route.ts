import { getNextQueuedMarketingJob } from "@/data/marketing-job-repository";
import { authorizeMarketingBridge } from "@/lib/marketing/bridge-auth";

export async function GET(request: Request) {
  if (!(await authorizeMarketingBridge(request))) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const jobId = await getNextQueuedMarketingJob();
  if (!jobId) return new Response(null, {
    status: 204,
    headers: { "Cache-Control": "private, no-store", "Retry-After": "60" },
  });
  return Response.json({ jobId, schemaVersion: 1, event: "JOB_SUBMITTED" }, {
    headers: { "Cache-Control": "private, no-store" },
  });
}
