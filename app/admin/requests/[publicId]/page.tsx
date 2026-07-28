import type { Metadata } from "next";
import { BellRing, ChevronRight, Clock3, MapPin, Phone, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminRequestActions } from "@/components/admin-request-actions";
import { StatusBadge } from "@/components/status-badge";
import { findRequestByPublicId, listStatusHistory } from "@/data/request-repository";
import { DEVICE_LABELS, STATUS_LABELS } from "@/lib/domain";
import { requireAdmin } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "신청 관리",
  robots: { index: false, follow: false },
};

export default async function AdminRequestPage({
  params,
}: {
  params: Promise<{ publicId: string }>;
}) {
  const { publicId } = await params;
  await requireAdmin(`/admin/requests/${publicId}`);
  const request = await findRequestByPublicId(publicId);
  if (!request) notFound();
  const history = await listStatusHistory(request.id);

  return (
    <main id="main-content" className="admin-shell">
      <section className="admin-top admin-detail-top">
        <div className="container">
          <div className="breadcrumbs breadcrumbs-light">
            <Link href="/admin">운영자</Link><ChevronRight size={14} /><span>{request.publicId}</span>
          </div>
          <div className="detail-hero-title">
            <div><span className="eyebrow eyebrow-light">Request management</span><h1>{request.symptom}</h1></div>
            <StatusBadge status={request.status} />
          </div>
        </div>
      </section>
      <section className="container admin-detail-grid">
        <div className="admin-request-info">
          <article className="detail-card">
            <h2>신청자 정보</h2>
            <dl className="detail-data">
              <div><dt>접수번호</dt><dd>{request.publicId}</dd></div>
              <div><dt>이름</dt><dd>{request.name}</dd></div>
              <div><dt><Phone size={17} /> 연락처</dt><dd><a href={`tel:${request.phone}`}>{request.phone}</a></dd></div>
              <div><dt><MapPin size={17} /> 주소</dt><dd>[{request.postalCode}] {request.address1} {request.address2}</dd></div>
              <div><dt>기기</dt><dd>{DEVICE_LABELS[request.deviceType]} {request.manufacturerModel}</dd></div>
              <div><dt><Clock3 size={17} /> 희망 일정</dt><dd>{request.preferredAt || "협의 필요"}</dd></div>
              <div><dt><ShieldCheck size={17} /> 공개 범위</dt><dd>{request.visibility === "PRIVATE" ? "비공개" : "공개"}</dd></div>
            </dl>
            <div className="request-description"><strong>상세 접수 내용</strong><p>{request.description}</p></div>
          </article>
          <article className="timeline-card">
            <h2>상태 변경 이력</h2>
            <ol className="status-timeline">
              {history.map((item, index) => (
                <li className={index === 0 ? "current" : ""} key={item.id}>
                  <span />
                  <div>
                    <strong>{STATUS_LABELS[item.status]}</strong>
                    <time>{new Intl.DateTimeFormat("ko-KR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(item.createdAt))}</time>
                    {item.publicNote && <p>{item.publicNote}</p>}
                  </div>
                </li>
              ))}
            </ol>
          </article>
        </div>
        <aside>
          <div className="notification-summary">
            <BellRing size={20} />
            <span><small>텔레그램 알림</small><strong>{request.notificationStatus}</strong></span>
          </div>
          {request.notificationError && <p className="notification-error">{request.notificationError}</p>}
          <AdminRequestActions
            publicId={request.publicId}
            currentStatus={request.status}
            internalNote={request.internalNote}
          />
        </aside>
      </section>
    </main>
  );
}
