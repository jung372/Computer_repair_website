"use client";

import { LockKeyhole, Send, ShieldCheck } from "lucide-react";
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
  const [copied, setCopied] = useState(false);
  const [success, setSuccess] = useState<{
    publicId: string;
    generatedLookupCode: string;
  } | null>(null);

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
        generatedLookupCode?: string | null;
        error?: string;
        fields?: Record<string, string>;
      };
      if (!response.ok || !result.publicId) {
        setErrors(result.fields ?? { form: result.error ?? "신청을 저장하지 못했습니다." });
        return;
      }
      if (result.generatedLookupCode) {
        setSuccess({
          publicId: result.publicId,
          generatedLookupCode: result.generatedLookupCode,
        });
        return;
      }
      window.location.assign(`/requests/${result.publicId}?submitted=1`);
    } catch {
      setErrors({ form: "연결이 원활하지 않습니다. 잠시 후 다시 시도해 주세요." });
    } finally {
      setSubmitting(false);
    }
  }

  async function copyLookupCode() {
    if (!success) return;
    try {
      await navigator.clipboard.writeText(success.generatedLookupCode);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  if (success) {
    return (
      <section className="request-form request-success-panel" aria-labelledby="request-success-title">
        <div className="form-intro">
          <span className="eyebrow">Request received</span>
          <h1 id="request-success-title">서비스 신청이 완료되었습니다.</h1>
          <p>접수번호와 자동 조회코드를 안전한 곳에 보관해 주세요.</p>
        </div>
        <div className="private-request-notice generated-lookup-notice">
          <LockKeyhole size={24} aria-hidden="true" />
          <span>
            <strong>자동 조회코드</strong>
            <code>{success.generatedLookupCode}</code>
            <small>이 화면을 벗어나면 코드를 다시 표시하지 않습니다. 화면 캡처도 권장합니다.</small>
          </span>
        </div>
        <div className="form-submit request-success-actions">
          <button className="button button-secondary" type="button" onClick={copyLookupCode}>
            {copied ? "복사 완료" : "조회코드 복사"}
          </button>
          <Link className="button button-primary" href={`/requests/${success.publicId}?submitted=1`}>
            신청내역 확인
          </Link>
        </div>
      </section>
    );
  }

  return (
    <form className="request-form" onSubmit={submit} noValidate>
      <div className="form-intro">
        <span className="eyebrow">Service request</span>
        <h1>서비스 신청</h1>
        <p>확인 후 영업시간 내에 연락드리겠습니다. 별표(*) 항목은 필수입니다.</p>
      </div>

      {errors.form && <div className="form-alert" role="alert">{errors.form}</div>}

      <section className="form-section">
        <div className="form-section-heading">
          <span>01</span>
          <div><h2>연락받을 정보</h2><p>접수 확인과 방문 상담에만 사용합니다.</p></div>
        </div>
        <div className="form-grid">
          <Field label="이름" name="name" error={errors.name}>
            <input
              id="name"
              name="name"
              autoComplete="name"
              maxLength={30}
              placeholder="미입력 시 미상으로 저장"
            />
          </Field>
          <Field label="연락처 *" name="phone" error={errors.phone}>
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
          <div aria-hidden="true" className="honeypot">
            <label htmlFor="website">웹사이트</label>
            <input id="website" name="website" tabIndex={-1} autoComplete="off" />
          </div>
          <Field label="기본 주소 *" name="address1" error={errors.address1} wide>
            <input
              id="address1"
              name="address1"
              autoComplete="street-address"
              placeholder="예: 서울시 강남구 테헤란로"
              required
            />
          </Field>
          <Field label="상세 주소" name="address2" error={errors.address2} wide>
            <input
              id="address2"
              name="address2"
              placeholder="건물명, 동·호수 (선택)"
            />
          </Field>
        </div>
      </section>

      <section className="form-section">
        <div className="form-section-heading">
          <span>02</span>
          <div><h2>기기와 증상</h2><p>정확하지 않아도 괜찮습니다. 보이는 현상을 적어 주세요.</p></div>
        </div>
        <div className="form-grid">
          <Field label="기기 종류 *" name="deviceType" error={errors.deviceType}>
            <select id="deviceType" name="deviceType" defaultValue={initialDevice} required>
              <option value="">기기를 선택하세요</option>
              {DEVICE_TYPES.map((type) => (
                <option value={type} key={type}>{DEVICE_LABELS[type]}</option>
              ))}
            </select>
          </Field>
          <Field label="제조사·모델명" name="manufacturerModel">
            <input
              id="manufacturerModel"
              name="manufacturerModel"
              maxLength={100}
              placeholder="예: LG 15U50, MacBook Air M2"
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
          <Field label="상세 접수 내용" name="description" error={errors.description} wide>
            <textarea
              id="description"
              name="description"
              rows={7}
              placeholder="언제부터, 어떤 상황에서 증상이 발생하는지 적어 주세요."
            />
            <small>선택 입력입니다. 추가로 전달할 내용이 있을 때만 적어 주세요.</small>
          </Field>
        </div>
      </section>

      <section className="form-section">
        <div className="form-section-heading">
          <span>03</span>
          <div><h2>조회 방법과 개인정보 처리 안내</h2><p>모든 신청은 비공개로 저장되며 본인만 조회할 수 있습니다.</p></div>
        </div>
        <div className="private-request-notice">
          <LockKeyhole size={22} aria-hidden="true" />
          <span>
            <strong>신청 내용은 공개되지 않습니다.</strong>
            <small>휴대전화 번호와 직접 지정한 비밀번호 또는 자동 조회코드가 일치할 때만 조회할 수 있어요.</small>
          </span>
        </div>
        <Field label="신청 조회 비밀번호" name="password" error={errors.password} wide>
          <input
            id="password"
            name="password"
            type="password"
            minLength={4}
            maxLength={20}
            autoComplete="new-password"
            placeholder="비워두면 자동 조회코드가 발급됩니다"
          />
          <small>선택 입력입니다. 직접 지정하려면 4~20자로 입력해 주세요.</small>
        </Field>
        <div className="consent-check privacy-processing-notice">
          <ShieldCheck size={20} aria-hidden="true" />
          <span>
            <strong>서비스 접수에 필요한 개인정보 처리 안내</strong>
            <small>연락처·기본주소·대표증상은 접수처리에 사용합니다. 자세한 내용은 <Link href="/privacy" target="_blank" rel="noreferrer">개인정보 처리방침</Link>에서 확인할 수 있습니다.</small>
          </span>
        </div>
      </section>

      <div className="form-submit">
        <p>휴대전화 번호와 직접 지정한 비밀번호 또는 자동 조회코드로 신청을 확인할 수 있습니다.</p>
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
  children,
}: {
  label: string;
  name: string;
  error?: string;
  wide?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={`field ${wide ? "field-wide" : ""}`}>
      <label htmlFor={name}>{label}</label>
      {children}
      {error && <p className="field-error" role="alert">{error}</p>}
    </div>
  );
}
