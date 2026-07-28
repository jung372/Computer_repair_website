"use client";

import { CheckCircle2, LockKeyhole, Send, ShieldCheck } from "lucide-react";
import { useState, type FormEvent } from "react";
import { DEVICE_LABELS, DEVICE_TYPES } from "@/lib/domain";

type RequestFormProps = {
  initialDevice?: string;
  initialSymptom?: string;
};

export function RequestForm({ initialDevice = "", initialSymptom = "" }: RequestFormProps) {
  const [visibility, setVisibility] = useState<"PRIVATE" | "PUBLIC">("PRIVATE");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

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
          privacyConsent: form.get("privacyConsent") === "on",
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
        <p>확인 후 영업시간 내에 연락드리겠습니다. 별표(*) 항목은 필수입니다.</p>
      </div>

      {errors.form && <div className="form-alert" role="alert">{errors.form}</div>}

      <section className="form-section">
        <div className="form-section-heading">
          <span>01</span>
          <div><h2>연락받을 정보</h2><p>접수 확인과 방문 상담에만 사용합니다.</p></div>
        </div>
        <div className="form-grid">
          <Field label="이름 *" name="name" error={errors.name}>
            <input id="name" name="name" autoComplete="name" maxLength={30} required />
          </Field>
          <Field label="연락처 *" name="phone" error={errors.phone}>
            <input
              id="phone"
              name="phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="010-1234-5678"
              required
            />
          </Field>
          <Field label="우편번호 *" name="postalCode" error={errors.postalCode}>
            <input id="postalCode" name="postalCode" inputMode="numeric" maxLength={12} required />
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
          <Field label="상세 주소 *" name="address2" error={errors.address2} wide>
            <input
              id="address2"
              name="address2"
              placeholder="건물명, 동·호수"
              required
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
          <Field label="상세 접수 내용 *" name="description" error={errors.description} wide>
            <textarea
              id="description"
              name="description"
              minLength={10}
              maxLength={2000}
              rows={7}
              placeholder="언제부터, 어떤 상황에서 증상이 발생하는지 적어 주세요."
              required
            />
          </Field>
          <Field label="희망 방문 일시" name="preferredAt" wide>
            <input id="preferredAt" name="preferredAt" type="datetime-local" />
            <small>희망 시간이며 운영자 확인 후 최종 일정이 확정됩니다.</small>
          </Field>
        </div>
      </section>

      <section className="form-section">
        <div className="form-section-heading">
          <span>03</span>
          <div><h2>공개 범위와 동의</h2><p>기본값은 개인정보 보호에 안전한 비공개입니다.</p></div>
        </div>
        <div className="visibility-options">
          <label className={visibility === "PRIVATE" ? "selected" : ""}>
            <input
              type="radio"
              name="visibility"
              value="PRIVATE"
              checked={visibility === "PRIVATE"}
              onChange={() => setVisibility("PRIVATE")}
            />
            <LockKeyhole size={22} aria-hidden="true" />
            <span><strong>비공개</strong><small>비밀번호를 입력해야 내용을 볼 수 있어요.</small></span>
          </label>
          <label className={visibility === "PUBLIC" ? "selected" : ""}>
            <input
              type="radio"
              name="visibility"
              value="PUBLIC"
              checked={visibility === "PUBLIC"}
              onChange={() => setVisibility("PUBLIC")}
            />
            <CheckCircle2 size={22} aria-hidden="true" />
            <span><strong>공개</strong><small>마스킹된 정보와 접수 내용이 공개돼요.</small></span>
          </label>
        </div>
        {visibility === "PRIVATE" && (
          <Field label="비공개 글 비밀번호 *" name="password" error={errors.password} wide>
            <input
              id="password"
              name="password"
              type="password"
              minLength={8}
              maxLength={64}
              autoComplete="new-password"
              required
            />
            <small>8~64자로 입력하고 잊지 않도록 보관해 주세요.</small>
          </Field>
        )}
        <label className="consent-check">
          <input type="checkbox" name="privacyConsent" required />
          <ShieldCheck size={20} aria-hidden="true" />
          <span>
            <strong>[필수] 개인정보 수집·이용에 동의합니다.</strong>
            <small>수리 상담을 위해 이름, 연락처, 주소를 수집하며 서비스 종료 후 1년 보관합니다.</small>
          </span>
        </label>
        {errors.privacyConsent && <p className="field-error">{errors.privacyConsent}</p>}
      </section>

      <div className="form-submit">
        <p>제출 후 접수번호를 꼭 확인해 주세요.</p>
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
