import { env } from "cloudflare:workers";

export function getRuntimeString(name: string): string {
  const workerValue: unknown = Reflect.get(env, name);
  if (typeof workerValue === "string" && workerValue.trim()) {
    return workerValue.trim();
  }

  const processValue = typeof process !== "undefined" ? process.env[name] : undefined;
  return processValue?.trim() ?? "";
}

export function isDevelopment() {
  return typeof process !== "undefined" && process.env.NODE_ENV !== "production";
}
