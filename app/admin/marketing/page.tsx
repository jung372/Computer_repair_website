import type { Metadata } from "next";
import { CircleAlert, Clock3, FileCheck2, Plus, Wrench } from "lucide-react";
import Link from "next/link";
import { AdminAccountNav } from "@/components/admin-account-nav";
import { listMarketingJobs } from "@/data/marketing-job-repository";
import { requireOwner } from "@/lib/admin-auth";

export const metadata: Metadata = { title: "콘텐츠 작업실", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const STATUS: Record<string, string> = {
  UPLOADING: "사진 처리 중", QUEUED: "클라우드 대기", LOCAL_ACCEPTED: "서버 수신", QUEUED_LOCAL: "AI 대기",
  GENERATING: "AI 작성 중", AWAITING_REVIEW: "검토 대기", APPROVED: "발행 승인", PUBLISHING: "발행 중",
  PUBLISHED: "발행 완료", OPERATOR_ACTION_REQUIRED: "운영자 확인", FAILED: "실패",
};

export default async function MarketingPage({ searchParams }: { searchParams: Promise<{ created?: string }> }) {
  const owner = await requireOwner("/admin/marketing");
  const [jobs, query] = await Promise.all([listMarketingJobs(50), searchParams]);
  const count = (status: string) => jobs.filter((job) => job.status === status).length;
  return (
    <main id="main-content" className="admin-shell marketing-shell">
      <section className="admin-top marketing-hero"><div className="container admin-top-inner"><div><span className="eyebrow eyebrow-light">Content workbench</span><h1>콘텐츠 작업실</h1><p>웹 접수부터 로컬 AI 검토·발행까지 한 흐름으로 추적합니다.</p></div><AdminAccountNav user={owner} /></div></section>
      <section className="container admin-content marketing-content">
        <div className="marketing-title-row"><div><span className="eyebrow">Repair diary queue</span><h2>수리일지 작업</h2></div><Link className="button primary" href="/admin/marketing/new"><Plus size={17} /> 새 수리일지</Link></div>
        {query.created && <p className="marketing-form-message">작업 {query.created}을 안전하게 등록했습니다. 서버 PC가 온라인이면 곧 가져갑니다.</p>}
        <section className="marketing-kpis" aria-label="작업 요약"><article><Clock3 /><span>처리 대기</span><strong>{count("QUEUED") + count("QUEUED_LOCAL")}</strong></article><article><Wrench /><span>AI 작업 중</span><strong>{count("GENERATING")}</strong></article><article><FileCheck2 /><span>검토 대기</span><strong>{count("AWAITING_REVIEW")}</strong></article><article className="warning"><CircleAlert /><span>확인 필요</span><strong>{count("FAILED") + count("OPERATOR_ACTION_REQUIRED")}</strong></article></section>
        <section className="marketing-job-panel"><header><div><h2>최근 작업</h2><p>Cloudflare에 보관된 상태와 로컬 작업 ID를 함께 표시합니다.</p></div><span>최근 50건</span></header>
          {jobs.length ? <div className="marketing-job-list">{jobs.map((job) => <article key={job.id} className={job.status === "FAILED" ? "failed" : ""}><div className="marketing-job-icon"><Wrench aria-hidden="true" /></div><div className="marketing-job-main"><header><span className={`marketing-status status-${job.status.toLowerCase()}`}>{STATUS[job.status] || job.status}</span><time>{formatDate(job.createdAt)}</time></header><h3>{job.district} · {job.symptom}</h3><p>{job.causeUnknown ? "원인 미확정" : job.diagnosedCause} · {job.actionsTaken}</p><small>{job.id}{job.localJobId ? ` → ${job.localJobId}` : ""}</small></div></article>)}</div> : <div className="integration-empty"><Wrench /><strong>아직 수리일지 작업이 없습니다.</strong><p>새 수리일지에서 현장 기록을 등록해 주세요.</p></div>}
        </section>
      </section>
    </main>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(value));
}
