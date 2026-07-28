import { Apple, Laptop, Monitor, PcCase, Wrench } from "lucide-react";
import type { DeviceType } from "@/lib/domain";

export function DeviceIcon({ type, size = 28 }: { type: DeviceType; size?: number }) {
  const props = { size, strokeWidth: 1.8, "aria-hidden": true as const };
  if (type === "desktop") return <PcCase {...props} />;
  if (type === "laptop") return <Laptop {...props} />;
  if (type === "monitor") return <Monitor {...props} />;
  if (type === "apple") return <Apple {...props} />;
  return <Wrench {...props} />;
}
