"use client";

import { ChevronDown, Clock3, Send, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { DEVICE_LABELS, DEVICE_TYPES } from "@/lib/domain";
import { formatPhoneInput, formatPhoneOnBlur } from "@/lib/phone";

type RequestFormProps = {
  initialDevice?: string;
  initialSymptom?: string;
};

export function RequestForm({ initialDevice = "", initialSymptom = "" }: RequestFormProps) {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [phone, setPhone] = useState("");
  const [optionalOpen, setOptionalOpen] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setErrors({});

    const form = new FormData(event.currentTarget);
    const payload = Object.fromEntries(form.entries()) as Record<string, string>;
    try {
      const response = await fetch("/api/requests", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...payload,
        }),
      });
      const result = (await response.json()) as {
        publicId?: string;
        error?: string;
        fields?: Record<string, string>;
      };
      if (!response.ok || !result.publicId) {
        setErrors(result.fields ?? { form: result.error ?? "신청을 저장하지 못했습니다." });
        return;
      }
      window.location.assign(`/requests/${result.publicId}?submitted=1`);
    } catch {
      setErrors({ form: "연결이 원활하지 않습니다. 잠시 후 다시 시도해 주세요." });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="request-form" onSubmit={submit} noValidate>
      <div className="form-intro">
        <span className="eyebrow">Service request</span>
        <h1>서비스 신청</h1>
        <p className="form-intro-desktop-copy">확인 후 영업시간 내에 연락드리겠습니다. 별표(*) 항목은 필수입니다.</p>
        <p className="form-intro-mobile-copy"><Clock3 size={17} aria-hidden="true" /> 약 2분이면 신청 완료</p>
      </div>

      {errors.form && <div className="form-alert" role="alert">{errors.form}</div>}

      <section className="form-section request-required-section">
        <div className="form-section-heading">
          <span>01</span>
          <div><h2>필수 접수 정보</h2><p>연락받을 정보와 기기 증상을 입력해 주세요.</p></div>
        </div>
        <div className="form-grid">
          <Field label="이름" name="name" error={errors.name} mobileInline>
            <input
              id="name"
              name="name"
              autoComplete="name"
              maxLength={30}
              placeholder="미입력 시 미상으로 저장"
            />
          </Field>
          <Field label="연락처 *" name="phone" error={errors.phone} mobileInline>
            <input
              id="phone"
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
          </Field>
          <Field label="기본주소 *" name="address1" error={errors.address1} wide mobileInline>
            <input
              id="address1"
              name="address1"
              autoComplete="street-address"
              placeholder="예: 서울시 강남구"
              required
            />
          </Field>
          <Field label="대표 증상 *" name="symptom" error={errors.symptom} wide>
            <input
              id="symptom"
              name="symptom"
              defaultValue={initialSymptom}
              maxLength={120}
              placeholder="예: 전원은 켜지지만 화면이 나오지 않아요"
              required
            />
          </Field>
          <Field
            label="조회 비밀번호"
            name="password"
            error={errors.password}
            wide
            mobileInline
          >
            <input
              id="password"
              name="password"
              type="password"
              minLength={4}
              maxLength={20}
              autoComplete="new-password"
              placeholder="입력 시 신청내역 조회 가능"
            />
            <small>입력하는 경우 4~20자로 설정해 주세요.</small>
          </Field>
          <div aria-hidden="true" className="honeypot">
            <label htmlFor="website">웹사이트</label>
            <input id="website" name="website" tabIndex={-1} autoComplete="off" />
          </div>
        </div>
      </section>

      <section className="form-section optional-form-section">
        <button
          type="button"
          className="optional-section-toggle"
          aria-expanded={optionalOpen}
          aria-controls="optional-request-fields"
          onClick={() => setOptionalOpen((open) => !open)}
        >
          <span><strong>추가 정보 입력</strong><small>선택사항</small></span>
          <ChevronDown size={20} aria-hidden="true" />
        </button>
        <div
          id="optional-request-fields"
          className={`optional-form-content ${optionalOpen ? "is-open" : ""}`}
        >
          <div className="form-section-heading optional-desktop-heading">
            <span>02</span>
            <div><h2>추가 정보</h2><p>필요한 경우에만 입력해 주세요.</p></div>
          </div>
          <div className="form-grid">
            <Field label="기기 종류" name="deviceType" error={errors.deviceType}>
              <select id="deviceType" name="deviceType" defaultValue={initialDevice}>
                <option value="">선택하지 않음</option>
                {DEVICE_TYPES.map((type) => (
                  <option value={type} key={type}>{DEVICE_LABELS[type]}</option>
                ))}
              </select>
            </Field>
            <Field label="상세 주소" name="address2" error={errors.address2}>
              <input
                id="address2"
                name="address2"
                placeholder="건물명, 동·호수 (선택)"
              />
            </Field>
            <Field label="제조사·모델명" name="manufacturerModel">
              <input
                id="manufacturerModel"
                name="manufacturerModel"
                maxLength={100}
                placeholder="예: LG 15U50, MacBook Air M2"
              />
            </Field>
            <Field label="상세 접수 내용" name="description" error={errors.description} wide>
              <textarea
                id="description"
                name="description"
                rows={7}
                placeholder="언제부터, 어떤 상황에서 증상이 발생하는지 적어 주세요."
              />
              <small>추가로 전달할 내용이 있을 때만 적어 주세요.</small>
            </Field>
          </div>
        </div>
      </section>

      <div className="consent-check privacy-processing-notice request-privacy-summary">
        <ShieldCheck size={20} aria-hidden="true" />
        <span>
          <strong>개인정보 처리 안내</strong>
          <small>
            입력 정보는 접수에 사용합니다. <Link
              href="/privacy"
              target="_blank"
              rel="noreferrer"
              aria-label="개인정보 처리방침 새 창에서 열기"
            >처리방침</Link>
          </small>
        </span>
      </div>

      <div className="form-submit">
        <p>조회 비밀번호를 입력한 신청은 연락처와 비밀번호로 다시 확인할 수 있습니다.</p>
        <button className="button button-primary button-large" disabled={submitting}>
          <Send size={19} aria-hidden="true" />
          {submitting ? "안전하게 저장하는 중..." : "서비스 신청하기"}
        </button>
      </div>
    </form>
  );
}

function Field({
  label,
  name,
  error,
  wide,
  mobileInline,
  children,
}: {
  label: string;
  name: string;
  error?: string;
  wide?: boolean;
  mobileInline?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={`field ${wide ? "field-wide" : ""} ${mobileInline ? "field-mobile-inline" : ""}`}>
      <label htmlFor={name}>{label}</label>
      {children}
      {error && <p className="field-error" role="alert">{error}</p>}
    </div>
  );
}
