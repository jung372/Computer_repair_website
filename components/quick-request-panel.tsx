"use client";

import { X } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { formatPhoneInput, formatPhoneOnBlur } from "@/lib/phone";

const DISMISSED_KEY = "combaksa-quick-request-dismissed";

function rememberDismissal() {
  try {
    window.sessionStorage.setItem(DISMISSED_KEY, "1");
  } catch {
    // The panel can still close or navigate when browser storage is unavailable.
  }
}

export function QuickRequestPanel() {
  const [open, setOpen] = useState(false);
  const [phone, setPhone] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      try {
        setOpen(window.sessionStorage.getItem(DISMISSED_KEY) !== "1");
      } catch {
        setOpen(true);
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        rememberDismissal();
        setOpen(false);
      }
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [open]);

  function close() {
    rememberDismissal();
    setOpen(false);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;

    const formElement = event.currentTarget;
    setSubmitting(true);
    setErrors({});

    try {
      const payload = Object.fromEntries(new FormData(formElement).entries());
      const response = await fetch("/api/requests", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = (await response.json()) as {
        publicId?: string;
        error?: string;
        fields?: Record<string, string>;
      };

      if (!response.ok || !result.publicId) {
        const nextErrors = result.fields ?? {
          form: result.error ?? "신청을 저장하지 못했습니다.",
        };
        setErrors(nextErrors);
        const firstField = Object.keys(nextErrors).find((name) => name !== "form");
        if (firstField) {
          window.requestAnimationFrame(() => {
            const field = formElement.elements.namedItem(firstField);
            if (field instanceof HTMLElement) field.focus();
          });
        }
        return;
      }

      rememberDismissal();
      window.location.assign(`/requests/${result.publicId}?submitted=1`);
    } catch {
      setErrors({ form: "연결이 원활하지 않습니다. 잠시 후 다시 시도해 주세요." });
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) return null;

  const errorMessage = errors.phone ?? errors.address1 ?? errors.symptom ?? errors.form;
  const errorDescription = errorMessage ? "quick-request-error" : undefined;

  return (
    <div className="quick-request-shell">
      <form
        className="quick-request-panel"
        onSubmit={submit}
        noValidate
        role="dialog"
        aria-modal="false"
        aria-label="빠른 서비스 신청"
      >
        <label className="sr-only" htmlFor="quick-phone">연락처</label>
        <input
          id="quick-phone"
          name="phone"
          type="tel"
          inputMode="numeric"
          autoComplete="tel"
          placeholder="연락처 입력"
          value={phone}
          onChange={(event) => setPhone(formatPhoneInput(event.target.value))}
          onBlur={(event) => setPhone(formatPhoneOnBlur(event.target.value))}
          aria-invalid={Boolean(errors.phone)}
          aria-describedby={errors.phone ? errorDescription : undefined}
          required
        />
        <button
          className="quick-request-close"
          type="button"
          aria-label="빠른 신청 닫기"
          onClick={close}
        >
          <X size={20} aria-hidden="true" />
        </button>

        <label className="sr-only" htmlFor="quick-address">주소</label>
        <input
          id="quick-address"
          name="address1"
          autoComplete="street-address"
          placeholder="주소 입력"
          maxLength={160}
          aria-invalid={Boolean(errors.address1)}
          aria-describedby={errors.address1 ? errorDescription : undefined}
          required
        />

        <label className="sr-only" htmlFor="quick-symptom">고장내용</label>
        <input
          id="quick-symptom"
          name="symptom"
          placeholder="고장내용 입력"
          maxLength={120}
          aria-invalid={Boolean(errors.symptom)}
          aria-describedby={errors.symptom ? errorDescription : undefined}
          required
        />

        <div aria-hidden="true" className="honeypot">
          <label htmlFor="quick-website">웹사이트</label>
          <input id="quick-website" name="website" tabIndex={-1} autoComplete="off" />
        </div>

        {errorMessage && (
          <p className="quick-request-error" id="quick-request-error" role="alert">
            {errorMessage}
          </p>
        )}

        <button className="quick-request-submit" disabled={submitting}>
          {submitting ? "신청 중..." : "빠른 신청하기"}
        </button>
      </form>
    </div>
  );
}
