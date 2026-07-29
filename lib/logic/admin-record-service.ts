import {
  getAdminRequestRecord,
  updateAdminRequestRecord,
  type AdminRequestRecordUpdate,
} from "@/data/admin-request-repository";
import {
  REQUEST_STATUSES,
  type RequestStatus,
} from "@/lib/domain";

export class AdminRecordValidationError extends Error {
  constructor(public fields: Record<string, string>) {
    super("입력 내용을 확인해 주세요.");
  }
}

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
  changedBy: string,
) {
  const request = await getAdminRequestRecord(publicId);
  if (!request) throw new Error("NOT_FOUND");
  const values = isRecord(input) ? input : {};
  const errors: Record<string, string> = {};
  const status = clean(values.status, 40);
  if (!REQUEST_STATUSES.includes(status as RequestStatus)) {
    errors.status = "처리 상태를 선택해 주세요.";
  }
  const address1 = clean(values.address1, 160);
  const symptom = clean(values.symptom, 120);
  const description = clean(values.description, 2_000);
  const receiptType = clean(values.receiptType, 40);
  const customerType = clean(values.customerType, 40);
  const title = clean(values.title, 120);
  const receivedDate = optionalDate(values.receivedDate, "receivedDate", errors);
  const visitDate = optionalDate(values.visitDate, "visitDate", errors);
  const invoiceDate = optionalDate(values.invoiceDate, "invoiceDate", errors);
  let completedDate = optionalDate(values.completedDate, "completedDate", errors);

  if (!address1) errors.address1 = "기본 주소를 입력해 주세요.";
  if (!symptom) errors.symptom = "대표 증상을 입력해 주세요.";
  if (!description) errors.description = "장애 현상을 입력해 주세요.";
  if (!receiptType) errors.receiptType = "접수 구분을 입력해 주세요.";
  if (!customerType) errors.customerType = "고객 구분을 입력해 주세요.";
  if (!title) errors.title = "제목을 입력해 주세요.";
  if (!receivedDate) errors.receivedDate = "접수일을 선택해 주세요.";
  if (
    !completedDate &&
    ["SHIPPED", "ONSITE_COMPLETED", "COMPLETED"].includes(status)
  ) {
    completedDate = todayInSeoul();
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
    assignee: clean(values.assignee, 80),
    assigneePhone: clean(values.assigneePhone, 30),
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
    paymentMethod: clean(values.paymentMethod, 40),
    totalAmount: amount(values.totalAmount, "totalAmount", errors),
    materialCost: amount(values.materialCost, "materialCost", errors),
    vatAmount: amount(values.vatAmount, "vatAmount", errors),
    technicianIncome: amount(values.technicianIncome, "technicianIncome", errors),
    officeDeposit: amount(values.officeDeposit, "officeDeposit", errors),
  };
  if (Object.keys(errors).length) throw new AdminRecordValidationError(errors);
  await updateAdminRequestRecord(request, update, changedBy);
}
