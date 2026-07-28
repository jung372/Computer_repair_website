import { env } from "cloudflare:workers";

type RuntimeBindings = Record<string, unknown>;

export function getRuntimeString(name: string): string {
  const workerValue = (env as unknown as RuntimeBindings)[name];
  if (typeof workerValue === "string" && workerValue.trim()) {
    return workerValue.trim();
  }

  const processValue = typeof process !== "undefined" ? process.env[name] : undefined;
  return processValue?.trim() ?? "";
}

export function isDevelopment() {
  return typeof process !== "undefined" && process.env.NODE_ENV !== "production";
}
