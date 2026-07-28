import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

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
