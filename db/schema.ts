import { index, integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const serviceRequests = sqliteTable(
  "service_requests",
  {
    id: text("id").primaryKey(),
    publicId: text("public_id").notNull().unique(),
    name: text("name").notNull(),
    phone: text("phone").notNull(),
    postalCode: text("postal_code").notNull(),
    address1: text("address1").notNull(),
    address2: text("address2").notNull(),
    regionPublic: text("region_public").notNull(),
    deviceType: text("device_type").notNull(),
    manufacturerModel: text("manufacturer_model").notNull().default(""),
    symptom: text("symptom").notNull(),
    description: text("description").notNull(),
    visibility: text("visibility").notNull(),
    accessPasswordHash: text("access_password_hash"),
    lookupKey: text("lookup_key"),
    status: text("status").notNull().default("RECEIVED"),
    preferredAt: text("preferred_at"),
    internalNote: text("internal_note").notNull().default(""),
    notificationStatus: text("notification_status").notNull().default("PENDING"),
    notificationError: text("notification_error"),
    privacyConsentVersion: text("privacy_consent_version").notNull(),
    privacyConsentedAt: text("privacy_consented_at").notNull(),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
    deletedAt: text("deleted_at"),
  },
  (table) => [
    index("service_requests_created_idx").on(table.createdAt),
    index("service_requests_status_idx").on(table.status),
    index("service_requests_lookup_phone_idx").on(table.lookupKey, table.phone),
  ],
);

export const requestStatusHistory = sqliteTable(
  "request_status_history",
  {
    id: text("id").primaryKey(),
    requestId: text("request_id")
      .notNull()
      .references(() => serviceRequests.id),
    status: text("status").notNull(),
    publicNote: text("public_note").notNull().default(""),
    changedBy: text("changed_by").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [index("request_history_request_idx").on(table.requestId)],
);

export const notificationOutbox = sqliteTable(
  "notification_outbox",
  {
    id: text("id").primaryKey(),
    requestId: text("request_id")
      .notNull()
      .references(() => serviceRequests.id),
    channel: text("channel").notNull().default("TELEGRAM"),
    status: text("status").notNull().default("PENDING"),
    attempts: integer("attempts").notNull().default(0),
    nextAttemptAt: text("next_attempt_at").notNull(),
    lastError: text("last_error"),
    sentAt: text("sent_at"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [index("notification_outbox_status_idx").on(table.status)],
);

export const accessAttempts = sqliteTable("access_attempts", {
  key: text("key").primaryKey(),
  failures: integer("failures").notNull().default(0),
  blockedUntil: text("blocked_until"),
  updatedAt: text("updated_at").notNull(),
});

export const customerLookupSessions = sqliteTable("customer_lookup_sessions", {
  id: text("id").primaryKey(),
  tokenHash: text("token_hash").notNull().unique(),
  expiresAt: text("expires_at").notNull(),
  createdAt: text("created_at").notNull(),
});

export const customerLookupSessionRequests = sqliteTable(
  "customer_lookup_session_requests",
  {
    sessionId: text("session_id")
      .notNull()
      .references(() => customerLookupSessions.id, { onDelete: "cascade" }),
    requestId: text("request_id")
      .notNull()
      .references(() => serviceRequests.id, { onDelete: "cascade" }),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.sessionId, table.requestId] }),
    index("customer_lookup_request_idx").on(table.requestId),
  ],
);

export const securitySettings = sqliteTable("security_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const admins = sqliteTable("admins", {
  id: text("id").primaryKey(),
  loginName: text("login_name").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  isActive: integer("is_active").notNull().default(1),
  sessionVersion: integer("session_version").notNull().default(1),
  passwordChangedAt: text("password_changed_at").notNull(),
  lastLoginAt: text("last_login_at"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const adminAuditLogs = sqliteTable(
  "admin_audit_logs",
  {
    id: text("id").primaryKey(),
    adminId: text("admin_id"),
    eventType: text("event_type").notNull(),
    clientHash: text("client_hash"),
    metadata: text("metadata"),
    createdAt: text("created_at").notNull(),
  },
  (table) => [index("admin_audit_created_idx").on(table.createdAt)],
);

export const requestSerials = sqliteTable("request_serials", {
  serialNo: integer("serial_no").primaryKey({ autoIncrement: true }),
  requestId: text("request_id")
    .notNull()
    .unique()
    .references(() => serviceRequests.id, { onDelete: "cascade" }),
});

export const requestOperations = sqliteTable(
  "request_operations",
  {
    requestId: text("request_id")
      .primaryKey()
      .references(() => serviceRequests.id, { onDelete: "cascade" }),
    receiptType: text("receipt_type").notNull().default("온라인접수"),
    assignee: text("assignee").notNull().default(""),
    assigneePhone: text("assignee_phone").notNull().default(""),
    customerType: text("customer_type").notNull().default("신규일반고객"),
    landline: text("landline").notNull().default(""),
    invoiceDate: text("invoice_date"),
    invoiceContent: text("invoice_content").notNull().default(""),
    title: text("title").notNull().default("수리요청"),
    requestCategory: text("request_category").notNull().default(""),
    receivedDate: text("received_date").notNull(),
    visitTiming: text("visit_timing").notNull().default("협의"),
    visitDate: text("visit_date"),
    completedDate: text("completed_date"),
    paymentMethod: text("payment_method").notNull().default(""),
    totalAmount: integer("total_amount").notNull().default(0),
    materialCost: integer("material_cost").notNull().default(0),
    vatAmount: integer("vat_amount").notNull().default(0),
    technicianIncome: integer("technician_income").notNull().default(0),
    officeDeposit: integer("office_deposit").notNull().default(0),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    index("request_operations_receipt_idx").on(table.receiptType),
    index("request_operations_assignee_idx").on(table.assignee),
    index("request_operations_dates_idx").on(table.receivedDate, table.completedDate),
  ],
);
