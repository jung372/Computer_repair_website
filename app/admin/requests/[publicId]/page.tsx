import type { Metadata } from "next";
import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminRequestRecordForm } from "@/components/admin-request-record-form";
import { getAdminRequestRecord } from "@/data/admin-request-repository";
import { listStatusHistory } from "@/data/request-repository";
import { STATUS_LABELS } from "@/lib/domain";
import { requireAdmin } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "접수 상세 관리",
  robots: { index: false, follow: false },
};

export default async function AdminRequestPage({
  params,
}: {
  params: Promise<{ publicId: string }>;
}) {
  const { publicId } = await params;
  await requireAdmin(`/admin/requests/${publicId}`);
  const request = await getAdminRequestRecord(publicId);
  if (!request) notFound();
  const history = await listStatusHistory(request.id);

  return (
    <main id="main-content" className="admin-shell">
      <section className="admin-top admin-detail-top">
        <div className="container">
          <div className="breadcrumbs breadcrumbs-light">
            <Link href="/admin">접수내역</Link>
            <ChevronRight size={14} />
            <span>#{request.serialNumber}</span>
          </div>
          <div className="admin-record-title">
            <div>
              <span className="eyebrow eyebrow-light">Request #{request.serialNumber}</span>
              <h1>{request.name || "미상"} 고객 접수</h1>
              <p>{request.publicId} · 최종 수정 {formatDateTime(request.operationsUpdatedAt)}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="container admin-record-layout">
        <AdminRequestRecordForm request={request} />

        <aside className="admin-record-history">
          <div className="timeline-card">
            <h2>상태 변경 이력</h2>
            <ol className="status-timeline">
              {history.map((item, index) => (
                <li className={index === 0 ? "current" : ""} key={item.id}>
                  <span />
                  <div>
                    <strong>{STATUS_LABELS[item.status]}</strong>
                    <time>{formatDateTime(item.createdAt)}</time>
                    {item.publicNote && <p>{item.publicNote}</p>}
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </aside>
      </section>
    </main>
  );
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Seoul",
  }).format(new Date(value));
}
