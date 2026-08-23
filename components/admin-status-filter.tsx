"use client";

import { useState } from "react";
import {
  ADMIN_OPERATIONAL_STATUSES,
  REQUEST_STATUSES,
  STATUS_LABELS,
  type RequestStatus,
} from "@/lib/domain";

export function AdminStatusFilter({ selected }: { selected: string[] }) {
  const initial = selected.filter((value) =>
    ADMIN_OPERATIONAL_STATUSES.includes(value as (typeof ADMIN_OPERATIONAL_STATUSES)[number]),
  ) as RequestStatus[];
  const hiddenStatuses = [...new Set(selected)].filter((value): value is RequestStatus =>
    REQUEST_STATUSES.includes(value as RequestStatus)
      && !ADMIN_OPERATIONAL_STATUSES.includes(
        value as (typeof ADMIN_OPERATIONAL_STATUSES)[number],
      ),
  );
  const [statuses, setStatuses] = useState<RequestStatus[]>(initial);
  const allSelected = statuses.length === ADMIN_OPERATIONAL_STATUSES.length;

  function toggleAll() {
    setStatuses(allSelected ? [] : [...ADMIN_OPERATIONAL_STATUSES]);
  }

  function toggle(status: RequestStatus) {
    setStatuses((current) =>
      current.includes(status)
        ? current.filter((value) => value !== status)
        : [...current, status],
    );
  }

  return (
    <fieldset className="admin-status-filter">
      <legend>처리상태</legend>
      <div>
        {hiddenStatuses.map((status) => (
          <input key={status} type="hidden" name="status" value={status} />
        ))}
        <label className="admin-status-all">
          <input type="checkbox" checked={allSelected} onChange={toggleAll} />
          <span>모두선택</span>
        </label>
        {ADMIN_OPERATIONAL_STATUSES.map((status) => (
          <label key={status}>
            <input
              type="checkbox"
              name="status"
              value={status}
              checked={statuses.includes(status)}
              onChange={() => toggle(status)}
            />
            <span>{STATUS_LABELS[status]}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
