"use client";

import { KeyRound, LockKeyhole } from "lucide-react";
import { useState, type FormEvent } from "react";

export function PrivateUnlock({ publicId }: { publicId: string }) {
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function unlock(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const response = await fetch(`/api/requests/${publicId}/unlock`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ password: form.get("password") }),
    });
    const result = (await response.json()) as { error?: string };
    if (!response.ok) {
      setError(result.error ?? "비밀번호를 확인해 주세요.");
      setSubmitting(false);
      return;
    }
    window.location.reload();
  }

  return (
    <div className="unlock-card">
      <span className="unlock-icon"><LockKeyhole size={30} aria-hidden="true" /></span>
      <span className="eyebrow">Private request</span>
      <h1>비공개 신청입니다</h1>
      <p>신청할 때 설정한 비밀번호를 입력하면 접수 내용과 진행 상태를 확인할 수 있습니다.</p>
      <form onSubmit={unlock}>
        <label htmlFor="unlock-password">비밀번호</label>
        <div className="unlock-input">
          <KeyRound size={18} aria-hidden="true" />
          <input
            id="unlock-password"
            name="password"
            type="password"
            minLength={4}
            maxLength={64}
            autoComplete="current-password"
            required
          />
        </div>
        {error && <p className="field-error" role="alert">{error}</p>}
        <button className="button button-primary" disabled={submitting}>
          {submitting ? "확인 중..." : "내 신청 확인하기"}
        </button>
      </form>
      <small>기존 신청은 최대 64자 비밀번호를 지원하며, 5회 실패 시 15분간 제한됩니다.</small>
    </div>
  );
}
