import { Eye, LockKeyhole } from "lucide-react";
import Link from "next/link";
import { DEVICE_LABELS, type PublicRequestSummary } from "@/lib/domain";
import { StatusBadge } from "./status-badge";

function dateLabel(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
}

export function RequestList({
  requests,
  compact = false,
}: {
  requests: PublicRequestSummary[];
  compact?: boolean;
}) {
  if (!requests.length) {
    return (
      <div className="empty-state">
        <strong>아직 표시할 신청이 없습니다.</strong>
        <p>첫 서비스 신청을 남겨 주세요.</p>
        <Link className="text-link" href="/requests/new">서비스 신청하기</Link>
      </div>
    );
  }

  return (
    <div className={`request-list ${compact ? "request-list-compact" : ""}`}>
      {requests.map((request) => (
        <Link
          className="request-row"
          href={`/requests/${request.publicId}`}
          key={request.publicId}
        >
          <div className="request-row-status">
            <StatusBadge status={request.status} />
          </div>
          <div className="request-row-main">
            <div className="request-row-title">
              {request.visibility === "PRIVATE" ? (
                <LockKeyhole size={15} aria-label="비공개" />
              ) : (
                <Eye size={15} aria-label="공개" />
              )}
              <strong>{request.symptom}</strong>
            </div>
            <span>
              {DEVICE_LABELS[request.deviceType]} · {request.maskedName} · {request.regionPublic}
            </span>
          </div>
          <div className="request-row-meta">
            <span>{request.publicId}</span>
            <time dateTime={request.createdAt}>{dateLabel(request.createdAt)}</time>
          </div>
        </Link>
      ))}
    </div>
  );
}
