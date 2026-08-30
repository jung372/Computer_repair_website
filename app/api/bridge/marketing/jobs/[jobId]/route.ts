import { getMarketingJob } from "@/data/marketing-job-repository";
import { authorizeMarketingBridge } from "@/lib/marketing/bridge-auth";

export async function GET(request: Request, context: { params: Promise<{ jobId: string }> }) {
  if (!(await authorizeMarketingBridge(request))) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { jobId } = await context.params;
  if (!/^marketing_job_[a-f0-9-]{36}$/i.test(jobId)) {
    return Response.json({ error: "Invalid job id" }, { status: 400 });
  }
  const job = await getMarketingJob(jobId);
  if (!job) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json({
    jobId: job.id,
    schemaVersion: job.schemaVersion,
    idempotencyKey: job.id,
    kind: "repair_diary",
    status: job.status,
    form: {
      symptom: job.symptom,
      causeUnknown: job.causeUnknown,
      diagnosedCause: job.diagnosedCause,
      actionsTaken: job.actionsTaken,
      verificationResult: job.verificationResult,
      deviceInfo: job.deviceInfo,
      workDuration: job.workDuration,
      repairNotes: job.repairNotes,
      district: job.district,
      photoConsent: job.photoConsent,
      privacyReviewed: job.privacyReviewed,
      photoEvidenceNote: job.photoEvidenceNote,
      visibility: "draft",
    },
    assets: job.assets.map((asset) => ({
      id: asset.id,
      sequence: asset.sequence,
      originalName: asset.originalName,
      mimeType: asset.mimeType,
      size: asset.size,
      sha256: asset.sha256,
      downloadUrl: `/api/bridge/marketing/jobs/${job.id}/assets/${asset.id}`,
    })),
  }, { headers: { "Cache-Control": "private, no-store" } });
}
