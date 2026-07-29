import { ChevronRight, MonitorCog } from "lucide-react";
import Link from "next/link";
import { DEVICE_LABELS, type ServiceRequestRecord } from "@/lib/domain";
import { StatusBadge } from "@/components/status-badge";

export function CustomerRequestList({ requests }: { requests: ServiceRequestRecord[] }) {
  return (
    <div className="customer-request-list">
      {requests.map((request) => (
        <Link className="customer-request-card" href={`/requests/${request.publicId}`} key={request.id}>
          <div className="customer-request-card-top">
            <span><MonitorCog size={17} aria-hidden="true" /> {DEVICE_LABELS[request.deviceType]}</span>
            <StatusBadge status={request.status} />
          </div>
          <strong>{request.symptom}</strong>
          <small>
            {request.publicId} · {new Intl.DateTimeFormat("ko-KR", {
              year: "numeric",
              month: "2-digit",
              day: "2-digit",
            }).format(new Date(request.createdAt))}
          </small>
          <ChevronRight className="customer-request-arrow" size={20} aria-hidden="true" />
        </Link>
      ))}
    </div>
  );
}
