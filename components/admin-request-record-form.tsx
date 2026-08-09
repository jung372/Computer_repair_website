"use client";

import { BellRing, List, Save, ShieldAlert, UserCheck } from "lucide-react";
import { useState, type FormEvent } from "react";
import type { AdminRequestRecord } from "@/data/admin-request-repository";
import type { AdminUser } from "@/lib/admin-auth";
import {
  ADMIN_OPERATIONAL_STATUSES,
  CUSTOMER_TYPES,
  PAYMENT_METHODS,
  STATUS_LABELS,
  type PaymentMethod,
  type RequestStatus,
} from "@/lib/domain";
import { deriveSettlement, formatWon } from "@/lib/settlement";

type Amounts = {
  totalAmount: number;
  materialCost: number;
};

type StaffOption = {
  id: string;
  loginName: string;
  displayName: string;
  phone: string;
  isActive: boolean;
};

function unique(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}

export function AdminRequestRecordForm({
  request,
  user,
  staff,
  returnTo,
}: {
  request: AdminRequestRecord;
  user: AdminUser;
  staff: StaffOption[];
  returnTo: string;
}) {
  const [message, setMessage] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [selectedStaffId, setSelectedStaffId] = useState(request.assigneeAccountId ?? "");
  const [assignment, setAssignment] = useState({
    id: request.assigneeAccountId ?? "",
    name: request.assignee,
    phone: request.assigneePhone,
  });
  const [assignmentMessage, setAssignmentMessage] = useState("");
  const [amounts, setAmounts] = useState<Amounts>({
    totalAmount: request.totalAmount,
    materialCost: request.materialCost,
  });
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | "">(
    PAYMENT_METHODS.includes(request.paymentMethod as PaymentMethod)
      ? request.paymentMethod as PaymentMethod
      : "",
  );
  const settlement = deriveSettlement(
    paymentMethod,
    amounts.totalAmount,
    amounts.materialCost,
  );
  const statusOptions = unique([
    ...ADMIN_OPERATIONAL_STATUSES,
    ...(ADMIN_OPERATIONAL_STATUSES.includes(
      request.status as (typeof ADMIN_OPERATIONAL_STATUSES)[number],
    )
      ? []
      : [request.status]),
  ]) as RequestStatus[];
  const customerTypes = unique([...CUSTOMER_TYPES, request.customerType]);

  async function send(payload: Record<string, unknown>) {
    setBusy(true);
    setMessage("");
    setErrors({});
    try {
      const response = await fetch(`/api/admin/requests/${request.publicId}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = (await response.json()) as {
        error?: string;
        message?: string;
        fields?: Record<string, string>;
        assignment?: {
          assigneeAccountId: string | null;
          assignee: string;
          assigneePhone: string;
        };
      };
      if (!response.ok) {
        setErrors(result.fields ?? {});
        setMessage(result.error ?? "처리하지 못했습니다.");
        return null;
      }
      setMessage(result.message ?? "저장했습니다.");
      return result;
    } catch {
      setMessage("연결이 원활하지 않습니다. 잠시 후 다시 시도해 주세요.");
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const payload = Object.fromEntries(new FormData(event.currentTarget).entries());
    await send({ ...payload, action: "save-record" });
  }

  async function anonymize() {
    if (!window.confirm("신청자의 개인정보와 접수 내용을 복구할 수 없게 삭제할까요?")) return;
    const result = await send({ action: "anonymize" });
    if (result) window.location.assign(returnTo);
  }

  async function assignStaff() {
    if (!selectedStaffId && assignment.id) {
      if (!window.confirm("현재 담당자 배정을 해제할까요?")) return;
    }
    setAssignmentMessage("");
    const result = await send({
      action: "assign",
      assigneeAccountId: selectedStaffId,
    });
    if (!result?.assignment) return;
    setAssignment({
      id: result.assignment.assigneeAccountId ?? "",
      name: result.assignment.assignee,
      phone: result.assignment.assigneePhone,
    });
    setAssignmentMessage(result.message ?? "담당자 배정을 저장했습니다.");
  }

  return (
    <form className="admin-record-form" onSubmit={submit} noValidate>
      <section className="admin-record-section">
        <div className="admin-record-section-heading">
          <span>01</span>
          <div><h2>고객 정보</h2><p>고객명은 비워 저장하면 ‘미상’으로 표시됩니다.</p></div>
        </div>
        <div className="admin-record-grid">
          <RecordField label="고객명" name="name" error={errors.name}>
            <input id="name" name="name" defaultValue={request.name === "미상" ? "" : request.name} maxLength={30} placeholder="미상" />
          </RecordField>
          <RecordField label="휴대전화" name="phone">
            <div className="admin-readonly-value">
              <a href={`tel:${request.phone}`}>{request.phone}</a>
              <a className="admin-sms-link" href={`sms:${request.phone}`}>SMS</a>
            </div>
          </RecordField>
          <RecordField label="일반전화" name="landline" error={errors.landline}>
            <input id="landline" name="landline" type="tel" defaultValue={request.landline} maxLength={30} />
          </RecordField>
          <RecordField label="계산서 발행일자" name="invoiceDate" error={errors.invoiceDate}>
            <input id="invoiceDate" name="invoiceDate" type="date" defaultValue={request.invoiceDate ?? ""} />
          </RecordField>
          <RecordField label="계산서 발행내용" name="invoiceContent" error={errors.invoiceContent} wide>
            <textarea id="invoiceContent" name="invoiceContent" rows={3} maxLength={1000} defaultValue={request.invoiceContent} />
          </RecordField>
          <RecordField label="기본 주소 *" name="address1" error={errors.address1} wide>
            <input id="address1" name="address1" defaultValue={request.address1} maxLength={160} required />
          </RecordField>
          <RecordField label="상세 주소" name="address2" error={errors.address2} wide>
            <input id="address2" name="address2" defaultValue={request.address2} maxLength={160} placeholder="선택 입력" />
          </RecordField>
        </div>
      </section>

      <section className="admin-record-section">
        <div className="admin-record-section-heading">
          <span>02</span>
          <div><h2>접수 및 장애 내용</h2><p>목록 제목과 기사 전달 내용을 구분해 기록합니다.</p></div>
        </div>
        <div className="admin-record-grid">
          <RecordField label="제목 *" name="title" error={errors.title} wide>
            <input id="title" name="title" defaultValue={request.title} maxLength={120} required />
          </RecordField>
          <RecordField label="대표 증상 *" name="symptom" error={errors.symptom} wide>
            <input id="symptom" name="symptom" defaultValue={request.symptom} maxLength={120} required />
          </RecordField>
          <RecordField label="장애현상 *" name="description" error={errors.description} wide>
            <textarea id="description" name="description" rows={7} maxLength={20000} defaultValue={request.description} required />
          </RecordField>
          <RecordField label="관리자메모" name="internalNote" error={errors.internalNote} wide>
            <textarea id="internalNote" name="internalNote" rows={5} maxLength={2000} defaultValue={request.internalNote} placeholder="고객에게 보이지 않는 메모" />
          </RecordField>
        </div>
      </section>

      <section className="admin-record-section">
        <div className="admin-record-section-heading">
          <span>03</span>
          <div><h2>배정과 일정</h2><p>접수 분류, 담당자와 주요 처리 일자를 관리합니다.</p></div>
        </div>
        <div className="admin-record-grid">
          <RecordField label="고객접수구분" name="requestCategory" error={errors.requestCategory}>
            <input id="requestCategory" name="requestCategory" defaultValue={request.requestCategory} maxLength={80} placeholder="예: 출장수리" />
          </RecordField>
          {user.role === "OWNER" ? (
            <RecordField label="담당자" name="assigneeAccountId">
              <div className="admin-assignment-control">
                <select
                  id="assigneeAccountId"
                  value={selectedStaffId}
                  onChange={(event) => {
                    setSelectedStaffId(event.target.value);
                    setAssignmentMessage("");
                  }}
                >
                  <option value="">미배정</option>
                  {staff.map((account) => (
                    <option value={account.id} key={account.id} disabled={!account.isActive}>
                      {account.displayName} · {account.loginName}{account.isActive ? "" : " (차단됨)"}
                    </option>
                  ))}
                </select>
                <button
                  className="button button-assignment"
                  type="button"
                  disabled={
                    busy ||
                    (selectedStaffId === assignment.id && !(assignment.name && !assignment.id))
                  }
                  onClick={assignStaff}
                >
                  <UserCheck size={17} aria-hidden="true" />
                  {selectedStaffId ? (assignment.id ? "배정 변경" : "담당자 배정") : "배정 해제"}
                </button>
              </div>
              {assignment.name && !assignment.id && (
                <small className="admin-assignment-legacy">기존 담당자 기록: {assignment.name}</small>
              )}
              {assignmentMessage && <small className="admin-assignment-success">{assignmentMessage}</small>}
            </RecordField>
          ) : (
            <RecordField label="담당자" name="assigneeReadonly">
              <div className="admin-readonly-value admin-assignee-readonly">
                <strong>{assignment.name || user.displayName}</strong>
                <small>{user.loginName}</small>
              </div>
            </RecordField>
          )}
          <RecordField label="담당자 휴대전화" name="assigneePhoneReadonly">
            <div className="admin-readonly-value">
              {selectedStaffId
                ? staff.find((account) => account.id === selectedStaffId)?.phone || "연락처 미등록"
                : assignment.phone || "연락처 미등록"}
            </div>
          </RecordField>
          <RecordField label="접수일 *" name="receivedDate" error={errors.receivedDate}>
            <input id="receivedDate" name="receivedDate" type="date" defaultValue={request.receivedDate} required />
          </RecordField>
          <RecordField label="방문구분" name="visitTiming" error={errors.visitTiming}>
            <select id="visitTiming" name="visitTiming" defaultValue={request.visitTiming}>
              {unique(["협의", "즉시", "예약", request.visitTiming]).map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
          </RecordField>
          <RecordField label="방문일" name="visitDate" error={errors.visitDate}>
            <input id="visitDate" name="visitDate" type="date" defaultValue={request.visitDate ?? ""} />
          </RecordField>
          <RecordField label="처리완료일" name="completedDate" error={errors.completedDate}>
            <input id="completedDate" name="completedDate" type="date" defaultValue={request.completedDate ?? ""} />
          </RecordField>
          <RecordField label="고객분류 *" name="customerType" error={errors.customerType}>
            <select id="customerType" name="customerType" defaultValue={request.customerType} required>
              {customerTypes.map((value) => <option key={value}>{value}</option>)}
            </select>
          </RecordField>
        </div>
      </section>

      <section className="admin-record-section">
        <div className="admin-record-section-heading">
          <span>04</span>
          <div>
            <h2>결제와 정산</h2>
            <p>결제방법·총수금액·자재비를 입력하면 두 부가세와 기사수익이 자동 계산됩니다.</p>
          </div>
        </div>
        <div className="admin-record-grid">
          <RecordField label="결제방법" name="paymentMethod" error={errors.paymentMethod} wide>
            <select
              id="paymentMethod"
              name="paymentMethod"
              value={paymentMethod}
              onChange={(event) => setPaymentMethod(event.target.value as PaymentMethod | "")}
            >
              <option value="">선택하세요</option>
              {PAYMENT_METHODS.map((value) => <option key={value}>{value}</option>)}
            </select>
          </RecordField>
          <AmountField label="총수금액" name="totalAmount" value={amounts.totalAmount} error={errors.totalAmount} setAmounts={setAmounts} />
          <DerivedAmountField
            label="총수금액 부가세"
            value={settlement.totalVatAmount}
            hint={paymentMethod === "현금 결제" ? "현금 결제 시 0원" : "총수금액 ÷ 11"}
          />
          <AmountField label="자재비" name="materialCost" value={amounts.materialCost} error={errors.materialCost} setAmounts={setAmounts} />
          <DerivedAmountField label="자재비 부가세" value={settlement.materialVatAmount} hint="자재비 × 10%" />
          <DerivedAmountField
            label="기사수익"
            value={settlement.technicianIncome}
            hint="총수금액 − 두 부가세 − 자재비"
            wide
          />
        </div>
      </section>

      <section className="admin-record-section">
        <div className="admin-record-section-heading">
          <span>05</span>
          <div><h2>처리 상태</h2><p>변경 이력과 고객에게 공개할 안내를 함께 남길 수 있습니다.</p></div>
        </div>
        <div className="admin-record-grid">
          <RecordField label="상태값 *" name="status" error={errors.status}>
            <select id="status" name="status" defaultValue={request.status} required>
              {statusOptions.map((status) => <option value={status} key={status}>{STATUS_LABELS[status]}</option>)}
            </select>
          </RecordField>
          <RecordField label="고객 공개 메모" name="publicNote" error={errors.publicNote} wide>
            <textarea id="publicNote" name="publicNote" rows={3} maxLength={500} placeholder="상태 변경 시 고객이 볼 수 있는 안내" />
          </RecordField>
        </div>
      </section>

      {message && (
        <p className={`admin-record-message ${Object.keys(errors).length ? "error" : ""}`} role="status">
          {message}
        </p>
      )}

      <div className="admin-record-footer">
        <a className="button button-secondary" href={returnTo}><List size={18} /> 목록</a>
        <button className="button button-primary" type="submit" disabled={busy}>
          <Save size={18} /> {busy ? "저장 중..." : "저장"}
        </button>
      </div>

      <div className="admin-record-secondary-actions">
        <button
          className="button button-secondary"
          type="button"
          disabled={busy}
          onClick={() => send({ action: "retry-notification" })}
        >
          <BellRing size={18} /> 텔레그램 알림 재전송
        </button>
        <button className="button button-danger" type="button" disabled={busy} onClick={anonymize}>
          <ShieldAlert size={18} /> 개인정보 삭제
        </button>
      </div>
    </form>
  );
}

function RecordField({
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
    <div className={`admin-record-field ${wide ? "wide" : ""}`}>
      <label htmlFor={name}>{label}</label>
      {children}
      {error && <small className="field-error">{error}</small>}
    </div>
  );
}

function DerivedAmountField({
  label,
  value,
  hint,
  wide,
}: {
  label: string;
  value: number;
  hint: string;
  wide?: boolean;
}) {
  return (
    <div className={`admin-record-field ${wide ? "wide" : ""}`}>
      <span className="admin-record-derived-label">{label}</span>
      <output className="admin-readonly-value admin-derived-amount">
        <strong>{formatWon(value)}</strong>
        <small>{hint}</small>
      </output>
    </div>
  );
}

function AmountField({
  label,
  name,
  value,
  error,
  setAmounts,
}: {
  label: string;
  name: keyof Amounts;
  value: number;
  error?: string;
  setAmounts: React.Dispatch<React.SetStateAction<Amounts>>;
}) {
  return (
    <RecordField label={label} name={name} error={error}>
      <div className="admin-money-input">
        <input
          id={name}
          name={name}
          type="number"
          inputMode="numeric"
          min={0}
          step={1}
          value={value}
          onChange={(event) =>
            setAmounts((current) => ({
              ...current,
              [name]: Math.max(0, Number(event.target.value) || 0),
            }))
          }
        />
        <span>원</span>
      </div>
    </RecordField>
  );
}
