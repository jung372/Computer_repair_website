import { getRuntimeString } from "@/lib/runtime-config";

export type InitialNotificationStatus = "DISABLED" | "CONFIG_REQUIRED" | "PENDING";

export function getInitialNotificationStatus(): InitialNotificationStatus {
  if (getRuntimeString("TELEGRAM_NOTIFICATION_ENABLED").toLowerCase() !== "true") {
    return "DISABLED";
  }
  if (
    !getRuntimeString("TELEGRAM_BOT_TOKEN") ||
    !getRuntimeString("TELEGRAM_CHAT_ID")
  ) {
    return "CONFIG_REQUIRED";
  }
  return "PENDING";
}

export function isTelegramNotificationReady() {
  return getInitialNotificationStatus() === "PENDING";
}
