import { STATUS_LABELS, type RequestStatus } from "@/lib/domain";

export function StatusBadge({ status }: { status: RequestStatus }) {
  return (
    <span className={`status-badge status-${status.toLowerCase()}`}>
      {STATUS_LABELS[status]}
    </span>
  );
}
