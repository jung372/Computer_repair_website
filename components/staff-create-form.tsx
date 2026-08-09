"use client";

import { useState } from "react";
import { formatPhoneInput, formatPhoneOnBlur } from "@/lib/phone";

export function StaffCreateForm() {
  const [phone, setPhone] = useState("");

  return (
    <form action="/api/admin/staff" method="post" className="staff-create-form">
      <input type="hidden" name="action" value="create" />
      <label htmlFor="staff-display-name">
        <span>직원명</span>
        <input id="staff-display-name" name="displayName" maxLength={30} required placeholder="예: 홍길동" />
      </label>
      <label htmlFor="staff-login-name">
        <span>로그인 아이디</span>
        <input id="staff-login-name" name="loginName" minLength={3} maxLength={30} pattern="[a-z0-9._-]{3,30}" required placeholder="예: staff01" autoComplete="off" />
      </label>
      <label htmlFor="staff-phone">
        <span>연락처</span>
        <input
          id="staff-phone"
          name="phone"
          type="tel"
          inputMode="numeric"
          autoComplete="tel"
          placeholder="010-0000-0000"
          value={phone}
          onChange={(event) => setPhone(formatPhoneInput(event.target.value))}
          onBlur={(event) => setPhone(formatPhoneOnBlur(event.target.value))}
        />
      </label>
      <label htmlFor="staff-password">
        <span>숫자 비밀번호</span>
        <input id="staff-password" name="password" type="password" inputMode="numeric" minLength={4} maxLength={64} pattern="[0-9]{4,64}" required autoComplete="new-password" placeholder="숫자 4자리 이상" />
      </label>
      <button className="button button-primary" type="submit">직원 등록</button>
    </form>
  );
}
