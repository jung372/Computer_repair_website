import type { Metadata } from "next";
import { CheckCircle2, ChevronRight, Clock3, MapPin, MonitorCog, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { PrivateUnlock } from "@/components/private-unlock";
import { StatusBadge } from "@/components/status-badge";
import {
  CUSTOMER_LOOKUP_COOKIE,
  customerLookupSessionCanAccess,
} from "@/data/customer-lookup-repository";
import { DEVICE_LABELS, STATUS_LABELS } from "@/lib/domain";
import { getRequestDetail, maskName, maskPhone } from "@/lib/logic/request-service";
import { accessCookieName, verifyAccessToken } from "@/lib/security/signed-access";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "신청 상세",
  robots: { index: false, follow: false },
};

export default async function RequestDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ publicId: string }>;
  searchParams: Promise<{ submitted?: string }>;
}) {
  const [{ publicId }, query] = await Promise.all([params, searchParams]);
  const detail = await getRequestDetail(publicId);
  if (!detail) notFound();
  const { request, history } = detail;
  const cookieStore = await cookies();
  const legacyToken = cookieStore.get(accessCookieName(publicId))?.value;
  const lookupToken = cookieStore.get(CUSTOMER_LOOKUP_COOKIE)?.value;
  const unlocked =
    (await customerLookupSessionCanAccess(lookupToken, request.id)) ||
    (await verifyAccessToken(publicId, legacyToken));

  if (!unlocked) {
    return (
      <main id="main-content" className="unlock-page">
        {request.accessPasswordHash ? (
          <PrivateUnlock publicId={publicId} />
        ) : (
          <div className="unlock-card">
            <span className="unlock-icon"><ShieldCheck size={30} aria-hidden="true" /></span>
            <span className="eyebrow">Protected request</span>
            <h1>신청 정보가 보호되고 있습니다</h1>
            <p>기존 공개 접수의 상세 내용은 더 이상 공개하지 않습니다. 확인이 필요하면 대표번호로 문의해 주세요.</p>
          </div>
        )}
        <Link className="text-link" href="/requests">내 신청 조회로 돌아가기</Link>
      </main>
    );
  }

  return (
    <main id="main-content">
      <section className="detail-hero">
        <div className="container">
          <div className="breadcrumbs">
            <Link href="/">홈</Link><ChevronRight size={14} /><Link href="/requests">내 신청 조회</Link>
          </div>
          {query.submitted === "1" && (
            <div className="success-banner">
              <CheckCircle2 size={22} />
              <div><strong>서비스 신청이 완료되었습니다.</strong><span>접수번호를 저장해 주세요.</span></div>
            </div>
          )}
          <div className="detail-hero-title">
            <div>
              <span className="eyebrow">Request detail</span>
              <h1>{request.symptom}</h1>
              <p>{request.publicId} · {maskName(request.name)} · {request.regionPublic}</p>
            </div>
            <StatusBadge status={request.status} />
          </div>
        </div>
      </section>
      <section className="section detail-section">
        <div className="container detail-grid">
          <article className="detail-card">
            <h2>신청 내용</h2>
            <dl className="detail-data">
              <div><dt><MonitorCog size={17} /> 기기</dt><dd>{DEVICE_LABELS[request.deviceType]}</dd></div>
              <div><dt><ShieldCheck size={17} /> 정보 보호</dt><dd>본인 확인 완료</dd></div>
              <div><dt><MapPin size={17} /> 지역</dt><dd>{request.regionPublic}</dd></div>
              <div><dt><Clock3 size={17} /> 희망 일정</dt><dd>{request.preferredAt || "운영자와 협의"}</dd></div>
              {request.manufacturerModel && <div><dt>모델명</dt><dd>{request.manufacturerModel}</dd></div>}
              <div><dt>연락처</dt><dd>{maskPhone(request.phone)}</dd></div>
            </dl>
            <div className="request-description">
              <strong>상세 증상</strong>
              <p>{request.description}</p>
            </div>
          </article>
          <aside className="timeline-card">
            <h2>처리 이력</h2>
            <ol className="status-timeline">
              {history.map((item, index) => (
                <li className={index === 0 ? "current" : ""} key={item.id}>
                  <span />
                  <div>
                    <strong>{STATUS_LABELS[item.status]}</strong>
                    <time dateTime={item.createdAt}>
                      {new Intl.DateTimeFormat("ko-KR", {
                        month: "long",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      }).format(new Date(item.createdAt))}
                    </time>
                    {item.publicNote && <p>{item.publicNote}</p>}
                  </div>
                </li>
              ))}
            </ol>
          </aside>
        </div>
      </section>
    </main>
  );
}
