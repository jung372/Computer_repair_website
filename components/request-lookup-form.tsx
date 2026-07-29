"use client";

import { KeyRound, Phone, SearchCheck, ShieldCheck } from "lucide-react";
import { useState, type FormEvent } from "react";
import { formatPhoneInput, formatPhoneOnBlur } from "@/lib/phone";

export function RequestLookupForm() {
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [phone, setPhone] = useState("");

  async function lookup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setMessage("");
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/requests/lookup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          phone: form.get("phone"),
          password: form.get("password"),
        }),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) {
        setMessage(result.error ?? "입력 정보를 확인해 주세요.");
        return;
      }
      window.location.assign("/requests?unlocked=1");
    } catch {
      setMessage("연결이 원활하지 않습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="request-lookup-form" onSubmit={lookup} noValidate>
      <div className="lookup-form-heading">
        <span className="lookup-icon"><SearchCheck size={27} aria-hidden="true" /></span>
        <div>
          <span className="eyebrow">Private lookup</span>
          <h2>내 신청 불러오기</h2>
          <p>신청할 때 사용한 휴대전화 번호와 신청 비밀번호를 입력하세요.</p>
        </div>
      </div>
      <label htmlFor="lookup-phone">휴대전화 번호</label>
      <div className="unlock-input">
        <Phone size={18} aria-hidden="true" />
        <input
          id="lookup-phone"
          name="phone"
          type="tel"
          inputMode="numeric"
          autoComplete="tel"
          placeholder="010-1234-5678"
          value={phone}
          onChange={(event) => setPhone(formatPhoneInput(event.target.value))}
          onBlur={(event) => setPhone(formatPhoneOnBlur(event.target.value))}
          required
        />
      </div>
      <label htmlFor="lookup-password">신청 비밀번호</label>
      <div className="unlock-input">
        <KeyRound size={18} aria-hidden="true" />
        <input
          id="lookup-password"
          name="password"
          type="password"
          minLength={4}
          maxLength={64}
          autoComplete="current-password"
          required
        />
      </div>
      {message && <p className="field-error" role="alert">{message}</p>}
      <button className="button button-primary button-large" disabled={submitting}>
        {submitting ? "안전하게 확인하는 중..." : "내 신청 조회"}
      </button>
      <div className="lookup-privacy-note">
        <ShieldCheck size={17} aria-hidden="true" />
        <span>입력 정보는 본인 신청 확인에만 사용하며 비밀번호 원문은 저장하지 않습니다.</span>
      </div>
    </form>
  );
}
