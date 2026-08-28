export type ConsultationMode = "GENERAL" | "AI_INTAKE";

export type ConsultationRoutingInput = {
  now?: Date;
  enabled: boolean;
  daytimePhone: string;
  afterHoursPhone: string;
  timeZone?: string;
  businessHoursStart?: string;
  businessHoursEnd?: string;
  holidays?: string | readonly string[];
};

export type ConsultationRoutingResult = {
  phone: string;
  mode: ConsultationMode;
  isBusinessHours: boolean;
  localDate: string;
};

const DEFAULT_TIME_ZONE = "Asia/Seoul";
const DEFAULT_START_MINUTES = 9 * 60;
const DEFAULT_END_MINUTES = 18 * 60;

function parseClock(value: string | undefined, fallback: number) {
  const match = /^(\d{2}):(\d{2})$/.exec(value?.trim() ?? "");
  if (!match) return fallback;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return fallback;
  return hours * 60 + minutes;
}

function holidaySet(value: string | readonly string[] | undefined) {
  const entries = typeof value === "string" ? value.split(",") : value ?? [];
  return new Set(entries.map((entry) => entry.trim()).filter((entry) => /^\d{4}-\d{2}-\d{2}$/.test(entry)));
}

function localParts(now: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    weekday: get("weekday"),
    minutes: Number(get("hour")) * 60 + Number(get("minute")),
  };
}

export function resolveConsultationRouting(
  input: ConsultationRoutingInput,
): ConsultationRoutingResult {
  const now = input.now ?? new Date();
  const timeZone = input.timeZone?.trim() || DEFAULT_TIME_ZONE;
  const local = localParts(now, timeZone);
  const start = parseClock(input.businessHoursStart, DEFAULT_START_MINUTES);
  const end = parseClock(input.businessHoursEnd, DEFAULT_END_MINUTES);
  const isScheduledDay = local.weekday !== "Sun" && !holidaySet(input.holidays).has(local.date);
  const isBusinessHours = isScheduledDay && start < end && local.minutes >= start && local.minutes < end;

  if (!input.enabled || isBusinessHours) {
    return {
      phone: input.daytimePhone,
      mode: "GENERAL",
      isBusinessHours,
      localDate: local.date,
    };
  }

  return {
    phone: input.afterHoursPhone,
    mode: "AI_INTAKE",
    isBusinessHours: false,
    localDate: local.date,
  };
}
