import { getRuntimeString } from "./runtime-config";
import { resolveConsultationRouting } from "./logic/consultation-routing";

export const siteDefaults = {
  name: "컴박사",
  tagline: "멈춘 컴퓨터, 다시 일상으로.",
  phone: "1660-0596",
  afterHoursPhone: "070-7917-5281",
  hours: "평일·토요일 09:00–18:00 / 야간·공휴일은 접수 상담만 가능합니다.",
  region: "서울·경기 일부 지역 출장",
  email: "contact@example.com",
  businessNumber: "389-80-03376",
  representative: "김규웅",
  address: "서울특별시 광진구 자양로19길 42-17, 101호",
  naverBlogId: "combaksa_repair",
};

export function getSiteConfig(now = new Date()) {
  const daytimePhone =
    getRuntimeString("BUSINESS_PHONE_DAYTIME") ||
    getRuntimeString("NEXT_PUBLIC_BUSINESS_PHONE") ||
    siteDefaults.phone;
  const consultation = resolveConsultationRouting({
    now,
    enabled: getRuntimeString("AI_PHONE_ROUTING_ENABLED").toLowerCase() === "true",
    daytimePhone,
    afterHoursPhone:
      getRuntimeString("BUSINESS_PHONE_AFTER_HOURS") || siteDefaults.afterHoursPhone,
    timeZone: getRuntimeString("BUSINESS_TIMEZONE") || "Asia/Seoul",
    businessHoursStart: getRuntimeString("BUSINESS_HOURS_START") || "09:00",
    businessHoursEnd: getRuntimeString("BUSINESS_HOURS_END") || "18:00",
    holidays: getRuntimeString("BUSINESS_HOLIDAYS_KST"),
  });

  return {
    name: getRuntimeString("NEXT_PUBLIC_BUSINESS_NAME") || siteDefaults.name,
    tagline: siteDefaults.tagline,
    phone: consultation.phone,
    consultationMode: consultation.mode,
    hours: getRuntimeString("BUSINESS_CONSULTATION_HOURS_LABEL") || siteDefaults.hours,
    region: getRuntimeString("NEXT_PUBLIC_SERVICE_REGION") || siteDefaults.region,
    email: getRuntimeString("NEXT_PUBLIC_BUSINESS_EMAIL") || siteDefaults.email,
    businessNumber:
      getRuntimeString("NEXT_PUBLIC_BUSINESS_NUMBER") || siteDefaults.businessNumber,
    representative:
      getRuntimeString("NEXT_PUBLIC_BUSINESS_OWNER") || siteDefaults.representative,
    address: getRuntimeString("NEXT_PUBLIC_BUSINESS_ADDRESS") || siteDefaults.address,
    naverBlogId: getRuntimeString("NEXT_PUBLIC_NAVER_BLOG_ID") || siteDefaults.naverBlogId,
    naverBlogUrl: `https://blog.naver.com/${encodeURIComponent(
      getRuntimeString("NEXT_PUBLIC_NAVER_BLOG_ID") || siteDefaults.naverBlogId,
    )}`,
  };
}
