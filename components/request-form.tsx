"use client";

import { LockKeyhole, Send, ShieldCheck } from "lucide-react";
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
          <Field label="상세 접수 내용 *" name="description" error={errors.description} wide>
            <textarea
              id="description"
              name="description"
              rows={7}
              placeholder="언제부터, 어떤 상황에서 증상이 발생하는지 적어 주세요."
              required
            />
            <small>길이 제한은 없습니다. 떠오르는 내용을 자유롭게 적어 주세요.</small>
          </Field>
        </div>
      </section>

      <section className="form-section">
        <div className="form-section-heading">
          <span>03</span>
          <div><h2>조회 비밀번호와 동의</h2><p>모든 신청은 비공개로 저장되며 본인만 조회할 수 있습니다.</p></div>
        </div>
        <div className="private-request-notice">
          <LockKeyhole size={22} aria-hidden="true" />
          <span>
            <strong>신청 내용은 공개되지 않습니다.</strong>
            <small>휴대전화 번호와 아래 비밀번호가 모두 일치할 때만 조회할 수 있어요.</small>
          </span>
        </div>
        <Field label="신청 조회 비밀번호 *" name="password" error={errors.password} wide>
          <input
            id="password"
            name="password"
            type="password"
            minLength={4}
            maxLength={20}
            autoComplete="new-password"
            required
          />
          <small>4~20자로 입력해 주세요. 보안을 위해 8자 이상을 권장합니다.</small>
        </Field>
        <label className="consent-check">
          <input type="checkbox" name="privacyConsent" required />
          <ShieldCheck size={20} aria-hidden="true" />
          <span>
            <strong>[필수] 개인정보 수집·이용에 동의합니다.</strong>
            <small>수리 상담을 위해 연락처와 주소를 수집하며, 이름은 선택 입력입니다. 서비스 종료 후 1년 보관합니다.</small>
          </span>
        </label>
        {errors.privacyConsent && <p className="field-error">{errors.privacyConsent}</p>}
      </section>

      <div className="form-submit">
        <p>휴대전화 번호와 비밀번호로 언제든 내 신청을 확인할 수 있습니다.</p>
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
