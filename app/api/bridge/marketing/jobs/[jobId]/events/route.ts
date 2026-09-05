import { getMarketingJob, recordBridgeMarketingJobStatus } from "@/data/marketing-job-repository";
import { authorizeMarketingBridge } from "@/lib/marketing/bridge-auth";

const ALLOWED = new Set([
  "LOCAL_ACCEPTED", "QUEUED_LOCAL", "GENERATING", "AWAITING_REVIEW", "APPROVED",
  "PUBLISHING", "PUBLISHED", "OPERATOR_ACTION_REQUIRED", "OPERATOR_RESOLVED", "FAILED",
  "CANCELLED", "COMPLETED", "PUBLISH_UNKNOWN", "SCHEDULED_CONFIRMED",
]);

export async function POST(request: Request, context: { params: Promise<{ jobId: string }> }) {
  if (!(await authorizeMarketingBridge(request))) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { jobId } = await context.params;
  const job = await getMarketingJob(jobId);
  if (!job) return Response.json({ error: "Not found" }, { status: 404 });
  const payload = await request.json() as Record<string, unknown>;
  const status = String(payload.status || "").trim().toUpperCase();
  if (!ALLOWED.has(status)) return Response.json({ error: "Invalid status" }, { status: 400 });
  const message = String(payload.message || status).trim().slice(0, 1000);
  const localJobId = /^job_[a-zA-Z0-9-]+$/.test(String(payload.localJobId || ""))
    ? String(payload.localJobId)
    : undefined;
  if (!localJobId || (job.localJobId && job.localJobId !== localJobId)) {
    return Response.json({ error: "Local job mismatch" }, { status: 409 });
  }
  const rawVersion = String(payload.sourceUpdatedAt || "");
  if (rawVersion && !Number.isFinite(Date.parse(rawVersion))) {
    return Response.json({ error: "Invalid source timestamp" }, { status: 400 });
  }
  await recordBridgeMarketingJobStatus(jobId, status, message, {
    localJobId,
    sourceUpdatedAt: rawVersion ? new Date(rawVersion).toISOString() : "",
    failureCode: status === "FAILED" ? String(payload.failureCode || "LOCAL_PROCESSING_FAILED").slice(0, 100) : undefined,
  });
  return Response.json({ ok: true });
}
