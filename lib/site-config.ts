import { getRuntimeString } from "./runtime-config";

export const siteDefaults = {
  name: "컴박사",
  tagline: "멈춘 컴퓨터, 다시 일상으로.",
  phone: "010-0000-0000",
  hours: "평일·토요일 09:00–20:00",
  region: "서울·경기 일부 지역 출장",
  email: "contact@example.com",
};

export function getSiteConfig() {
  return {
    name: getRuntimeString("NEXT_PUBLIC_BUSINESS_NAME") || siteDefaults.name,
    tagline: siteDefaults.tagline,
    phone: getRuntimeString("NEXT_PUBLIC_BUSINESS_PHONE") || siteDefaults.phone,
    hours: getRuntimeString("NEXT_PUBLIC_BUSINESS_HOURS") || siteDefaults.hours,
    region: getRuntimeString("NEXT_PUBLIC_SERVICE_REGION") || siteDefaults.region,
    email: getRuntimeString("NEXT_PUBLIC_BUSINESS_EMAIL") || siteDefaults.email,
  };
}
