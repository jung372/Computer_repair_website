"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { AssignmentOption } from "@/data/staff-slot-repository";

export function InlineAssignmentForm({
  publicId,
  currentAssigneeAccountId,
  options,
}: {
  publicId: string;
  currentAssigneeAccountId: string | null;
  options: AssignmentOption[];
}) {
  const router = useRouter();
  const [current, setCurrent] = useState(currentAssigneeAccountId ?? "");
  const [selected, setSelected] = useState(currentAssigneeAccountId ?? "");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function save() {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(`/api/admin/requests/${publicId}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "assign",
          assigneeAccountId: selected,
          expectedAssigneeAccountId: current,
        }),
      });
      const result = (await response.json()) as {
        error?: string;
        message?: string;
        assignment?: { assigneeAccountId: string | null };
      };
      if (!response.ok) {
        setMessage(result.error ?? "담당자를 저장하지 못했습니다.");
        if (response.status === 409) router.refresh();
        return;
      }
      const saved = result.assignment?.assigneeAccountId ?? "";
      setCurrent(saved);
      setSelected(saved);
      setMessage(result.message ?? "저장했습니다.");
      router.refresh();
    } catch {
      setMessage("연결이 원활하지 않습니다. 다시 시도해 주세요.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="inline-assignment">
      <div>
        <select
          aria-label="담당자 선택"
          value={selected}
          onChange={(event) => {
            setSelected(event.target.value);
            setMessage("");
          }}
          disabled={busy}
        >
          <option value="">미배정</option>
          {options.map((option) => (
            <option value={option.accountId} key={option.accountId}>{option.label}</option>
          ))}
        </select>
        <button
          type="button"
          onClick={save}
          disabled={busy || selected === current}
        >
          {busy ? "저장 중" : "확인"}
        </button>
      </div>
      {message && <small role="status">{message}</small>}
    </div>
  );
}
