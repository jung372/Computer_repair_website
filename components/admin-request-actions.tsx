"use client";

import { BellRing, Save, ShieldAlert } from "lucide-react";
import { useState, type FormEvent } from "react";
import { STATUS_LABELS, STATUS_TRANSITIONS, type RequestStatus } from "@/lib/domain";

export function AdminRequestActions({
  publicId,
  currentStatus,
  internalNote,
}: {
  publicId: string;
  currentStatus: RequestStatus;
  internalNote: string;
}) {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function send(payload: Record<string, unknown>) {
    setBusy(true);
    setMessage("");
    const response = await fetch(`/api/admin/requests/${publicId}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    const result = (await response.json()) as { error?: string; message?: string };
    setBusy(false);
    if (!response.ok) {
      setMessage(result.error ?? "처리하지 못했습니다.");
      return false;
    }
    setMessage(result.message ?? "저장했습니다.");
    return true;
  }

  async function update(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const ok = await send({
      action: "update",
      status: form.get("status"),
      publicNote: form.get("publicNote"),
      internalNote: form.get("internalNote"),
    });
    if (ok) window.location.reload();
  }

  async function anonymize() {
    if (!window.confirm("신청자의 개인정보와 접수 내용을 복구할 수 없게 삭제할까요?")) return;
    const ok = await send({ action: "anonymize" });
    if (ok) window.location.assign("/admin");
  }

  return (
    <div className="admin-actions">
      <form onSubmit={update}>
        <h2>처리 상태 변경</h2>
        <label htmlFor="admin-status">상태</label>
        <select id="admin-status" name="status" defaultValue={currentStatus}>
          {STATUS_TRANSITIONS[currentStatus].map((status) => (
            <option value={status} key={status}>{STATUS_LABELS[status]}</option>
          ))}
        </select>
        <label htmlFor="public-note">고객 공개 메모</label>
        <textarea
          id="public-note"
          name="publicNote"
          rows={3}
          maxLength={500}
          placeholder="예: 상담 완료 후 7월 30일 방문 예정입니다."
        />
        <label htmlFor="internal-note">운영자 내부 메모</label>
        <textarea
          id="internal-note"
          name="internalNote"
          rows={5}
          maxLength={2000}
          defaultValue={internalNote}
          placeholder="고객에게 보이지 않는 메모"
        />
        <button className="button button-primary" disabled={busy}>
          <Save size={18} aria-hidden="true" /> 저장
        </button>
      </form>
      <div className="admin-secondary-actions">
        <button
          className="button button-secondary"
          type="button"
          disabled={busy}
          onClick={() => send({ action: "retry-notification" })}
        >
          <BellRing size={18} aria-hidden="true" /> 텔레그램 알림 재전송
        </button>
        <button
          className="button button-danger"
          type="button"
          disabled={busy}
          onClick={anonymize}
        >
          <ShieldAlert size={18} aria-hidden="true" /> 개인정보 삭제
        </button>
      </div>
      {message && <p className="admin-action-message" role="status">{message}</p>}
    </div>
  );
}
