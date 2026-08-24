import {
  getAdminRequestRecord,
  updateAdminRequestRecord,
  type AdminRequestRecordUpdate,
} from "@/data/admin-request-repository";
import {
  PAYMENT_METHODS,
  RECEIPT_TYPES,
  REQUEST_STATUSES,
  SETTLEMENT_DEFAULT_STATUSES,
  type PaymentMethod,
  type ReceiptType,
  type RequestStatus,
} from "@/lib/domain";
import { deriveSettlement } from "@/lib/settlement";

export class AdminRecordValidationError extends Error {
  constructor(public fields: Record<string, string>) {
    super("입력 내용을 확인해 주세요.");
  }
}

export class AdminRecordAuthorizationError extends Error {}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function clean(value: unknown, maximum: number) {
  return typeof value === "string" ? value.trim().slice(0, maximum) : "";
}

function optionalDate(value: unknown, field: string, errors: Record<string, string>) {
  const date = clean(value, 10);
  if (!date) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(`${date}T00:00:00Z`))) {
    errors[field] = "올바른 날짜를 선택해 주세요.";
  }
  return date;
}

function amount(value: unknown, field: string, errors: Record<string, string>) {
  const text = typeof value === "number" ? String(value) : clean(value, 20).replaceAll(",", "");
  if (!text) return 0;
  const parsed = Number(text);
  if (!Number.isSafeInteger(parsed) || parsed < 0 || parsed > 2_147_483_647) {
    errors[field] = "0 이상의 원 단위 금액을 입력해 주세요.";
    return 0;
  }
  return parsed;
}

function todayInSeoul() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export async function saveAdminRequestRecord(
  publicId: string,
  input: unknown,
  actor: { id: string; loginName: string; role: "OWNER" | "STAFF" },
) {
  const request = await getAdminRequestRecord(
    publicId,
    actor.role === "STAFF" ? actor.id : undefined,
  );
  if (!request) throw new Error("NOT_FOUND");
  const values = isRecord(input) ? input : {};
  const errors: Record<string, string> = {};
  const status = clean(values.status, 40);
  if (!REQUEST_STATUSES.includes(status as RequestStatus)) {
    errors.status = "처리 상태를 선택해 주세요.";
  }
  const address1 = clean(values.address1, 160);
  const symptom = clean(values.symptom, 120);
  const description = clean(values.description, 20_000);
  const customerType = clean(values.customerType, 40);
  const receiptType = clean(values.receiptType, 40);
  const title = clean(values.title, 120);
  const receivedDate = optionalDate(values.receivedDate, "receivedDate", errors);
  const visitDate = optionalDate(values.visitDate, "visitDate", errors);
  const invoiceDate = optionalDate(values.invoiceDate, "invoiceDate", errors);
  let completedDate = optionalDate(values.completedDate, "completedDate", errors);

  if (!address1) errors.address1 = "기본 주소를 입력해 주세요.";
  if (!symptom) errors.symptom = "대표 증상을 입력해 주세요.";
  if (!customerType) errors.customerType = "고객 구분을 입력해 주세요.";
  if (!RECEIPT_TYPES.includes(receiptType as ReceiptType)) {
    errors.receiptType = "접수구분을 선택해 주세요.";
  }
  if (!title) errors.title = "제목을 입력해 주세요.";
  if (!receivedDate) errors.receivedDate = "접수일을 선택해 주세요.";
  if (
    !completedDate &&
    ([...SETTLEMENT_DEFAULT_STATUSES, "COMPLETED"] as string[]).includes(status)
  ) {
    completedDate = todayInSeoul();
  }

  // 운영자는 결제방법, 총수금액과 자재비를 입력한다. 직원은 기존 자재비를 조회만
  // 할 수 있으며, 부가세·기사수익·사무실입금액은
  // 클라이언트가 보낸 값을 믿지 않고 항상 서버에서 다시 계산한다.
  const paymentMethod = clean(values.paymentMethod, 40);
  const totalAmount = amount(values.totalAmount, "totalAmount", errors);
  if (
    actor.role !== "OWNER" &&
    Object.prototype.hasOwnProperty.call(values, "materialCost")
  ) {
    throw new AdminRecordAuthorizationError("자재비는 운영자만 입력하거나 수정할 수 있습니다.");
  }
  const materialCost = actor.role === "OWNER"
    ? amount(values.materialCost, "materialCost", errors)
    : request.materialCost;
  if (!paymentMethod && (totalAmount > 0 || materialCost > 0)) {
    errors.paymentMethod = "금액을 입력할 때는 결제방법을 선택해 주세요.";
  } else if (
    paymentMethod &&
    !PAYMENT_METHODS.includes(paymentMethod as PaymentMethod)
  ) {
    errors.paymentMethod = "현금 결제, 현금영수증 결제, 카드 결제 중에서 선택해 주세요.";
  }
  const settlement = deriveSettlement(
    paymentMethod as PaymentMethod | "",
    totalAmount,
    materialCost,
  );
  if (
    materialCost + settlement.materialVatAmount >
    totalAmount - settlement.totalVatAmount
  ) {
    errors[actor.role === "OWNER" ? "materialCost" : "totalAmount"] =
      "자재비와 자재비 부가세의 합계가 정산 가능한 금액을 초과할 수 없습니다.";
  }

  const update: AdminRequestRecordUpdate = {
    name: clean(values.name, 30) || "미상",
    address1,
    address2: clean(values.address2, 160),
    symptom,
    description,
    status: status as RequestStatus,
    publicNote: clean(values.publicNote, 500),
    internalNote: clean(values.internalNote, 2_000),
    receiptType,
    customerType,
    landline: clean(values.landline, 30),
    invoiceDate,
    invoiceContent: clean(values.invoiceContent, 1_000),
    title,
    requestCategory: clean(values.requestCategory, 80),
    receivedDate: receivedDate ?? "",
    visitTiming: clean(values.visitTiming, 20) || "협의",
    visitDate,
    completedDate,
    paymentMethod,
    totalAmount,
    materialCost,
    ...settlement,
  };
  if (Object.keys(errors).length) throw new AdminRecordValidationError(errors);
  await updateAdminRequestRecord(request, update, actor.loginName);
}
