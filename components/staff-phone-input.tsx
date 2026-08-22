"use client";

import { useState } from "react";
import { formatPhoneInput, formatPhoneOnBlur } from "@/lib/phone";

export function StaffPhoneInput({
  id,
  defaultValue = "",
}: {
  id: string;
  defaultValue?: string;
}) {
  const [phone, setPhone] = useState(() => formatPhoneOnBlur(defaultValue));

  return (
    <input
      id={id}
      name="phone"
      type="tel"
      inputMode="numeric"
      autoComplete="tel"
      maxLength={13}
      placeholder="010-0000-0000"
      value={phone}
      onChange={(event) => setPhone(formatPhoneInput(event.target.value))}
      onBlur={(event) => setPhone(formatPhoneOnBlur(event.target.value))}
    />
  );
}
