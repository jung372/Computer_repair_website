import type { DeviceType } from "./domain";

export type SymptomGuide = {
  id: string;
  title: string;
  cause: string;
  action: string;
};

export type DeviceGuide = {
  slug: DeviceType;
  title: string;
  english: string;
  summary: string;
  accent: string;
  symptoms: SymptomGuide[];
};

export const deviceGuides: Record<Exclude<DeviceType, "other">, DeviceGuide> = {
  desktop: {
    slug: "desktop",
    title: "컴퓨터 수리",
    english: "Desktop care",
    accent: "blue",
    summary: "전원·부팅·속도·블루스크린까지, 증상을 재현하고 원인부터 정확히 살핍니다.",
    symptoms: [
      {
        id: "power",
        title: "전원이 켜지지 않아요",
        cause: "파워서플라이, 메인보드 전원부, 케이스 스위치 이상 가능성이 있습니다.",
        action: "멀티탭과 전원 케이블을 확인한 뒤 반복해서 전원을 넣지 마세요.",
      },
      {
        id: "display",
        title: "전원은 켜지는데 화면이 없어요",
        cause: "메모리 접촉, 그래픽카드, 모니터 연결 또는 메인보드 문제일 수 있습니다.",
        action: "케이블 연결을 확인하고 다른 화면 출력 단자가 있다면 한 번만 시험해 보세요.",
      },
      {
        id: "boot",
        title: "부팅이 안 되거나 재부팅돼요",
        cause: "저장장치, 윈도우 손상, 메모리 또는 발열 문제가 원인일 수 있습니다.",
        action: "중요한 자료가 있다면 초기화나 윈도우 재설치를 먼저 진행하지 마세요.",
      },
      {
        id: "slow",
        title: "너무 느리고 자주 멈춰요",
        cause: "저장장치 상태, 과도한 시작 프로그램, 악성코드, 메모리 부족을 점검해야 합니다.",
        action: "이상 소음이 들리면 추가 사용을 중단하고 데이터 상태부터 확인하세요.",
      },
    ],
  },
  laptop: {
    slug: "laptop",
    title: "노트북 수리",
    english: "Laptop care",
    accent: "mint",
    summary: "액정·충전·발열·침수 등 노트북 특유의 문제를 분해 점검 기준으로 안내합니다.",
    symptoms: [
      {
        id: "screen",
        title: "화면이 깨지거나 나오지 않아요",
        cause: "액정 패널, 디스플레이 케이블, 그래픽 회로 이상 가능성이 있습니다.",
        action: "외부 모니터가 있다면 연결 결과를 접수 내용에 적어 주세요.",
      },
      {
        id: "charge",
        title: "충전이 안 되고 전원이 꺼져요",
        cause: "어댑터, 충전 단자, 배터리 또는 메인보드 전원 회로를 확인해야 합니다.",
        action: "타는 냄새나 과열이 느껴지면 충전기를 즉시 분리하세요.",
      },
      {
        id: "heat",
        title: "발열과 팬 소음이 심해요",
        cause: "냉각팬 오염, 써멀 성능 저하, 통풍구 막힘이 흔한 원인입니다.",
        action: "이불이나 쿠션 위 사용을 피하고 자동 종료가 반복되면 사용을 멈추세요.",
      },
      {
        id: "spill",
        title: "물이나 음료를 쏟았어요",
        cause: "키보드 아래 메인보드까지 액체가 유입되면 부식과 쇼트가 진행될 수 있습니다.",
        action: "전원을 끄고 충전기를 분리하세요. 켜지는지 확인하려고 다시 전원을 넣지 마세요.",
      },
    ],
  },
  monitor: {
    slug: "monitor",
    title: "모니터 수리",
    english: "Monitor care",
    accent: "orange",
    summary: "전원·백라이트·화면 이상을 확인해 수리 가능성과 교체 경제성을 함께 판단합니다.",
    symptoms: [
      {
        id: "no-power",
        title: "전원이 들어오지 않아요",
        cause: "전원 어댑터, 전원 보드 또는 내부 회로 이상 가능성이 있습니다.",
        action: "다른 콘센트와 전원선을 확인하고 모델명을 함께 접수해 주세요.",
      },
      {
        id: "black",
        title: "전원은 켜지는데 화면이 없어요",
        cause: "입력 신호, 메인보드, 백라이트 또는 패널 문제일 수 있습니다.",
        action: "입력 소스와 케이블을 바꿔 본 결과를 알려 주시면 진단에 도움이 됩니다.",
      },
      {
        id: "flicker",
        title: "화면이 깜빡이거나 줄이 생겨요",
        cause: "케이블, 주사율 설정, 패널 또는 내부 보드 이상을 구분해야 합니다.",
        action: "증상이 보일 때 사진이나 발생 조건을 기록해 두세요.",
      },
      {
        id: "broken-panel",
        title: "패널이 파손됐어요",
        cause: "외부 충격으로 패널이 파손된 경우 동일 규격 부품 확인이 필요합니다.",
        action: "파손 부위를 누르지 말고 모델명과 화면 크기를 접수 내용에 적어 주세요.",
      },
    ],
  },
  apple: {
    slug: "apple",
    title: "애플기기 수리",
    english: "Apple device care",
    accent: "violet",
    summary: "MacBook·iMac의 부팅, 화면, 배터리와 macOS 문제를 데이터 우선으로 점검합니다.",
    symptoms: [
      {
        id: "mac-boot",
        title: "Mac이 켜지지 않거나 부팅이 멈춰요",
        cause: "전원 회로, 저장장치, macOS 또는 메인보드 이상 가능성이 있습니다.",
        action: "중요한 자료가 있다면 초기화나 복구 모드 재설치를 먼저 하지 마세요.",
      },
      {
        id: "mac-screen",
        title: "화면이 나오지 않아요",
        cause: "액정, 케이블, 백라이트, 그래픽 회로를 순서대로 확인해야 합니다.",
        action: "기기 연식과 정확한 모델 식별 정보를 접수해 주세요.",
      },
      {
        id: "battery",
        title: "배터리가 빨리 닳고 뜨거워요",
        cause: "배터리 수명, 백그라운드 작업, 냉각 계통 문제일 수 있습니다.",
        action: "배터리가 부풀었다면 화면을 닫지 말고 충전과 사용을 중단하세요.",
      },
      {
        id: "macos",
        title: "macOS 설치·초기화가 필요해요",
        cause: "운영체제 손상, 용량 부족 또는 저장장치 문제를 먼저 확인해야 합니다.",
        action: "데이터 백업 여부와 사용 중인 주요 프로그램을 접수 내용에 적어 주세요.",
      },
    ],
  },
};

export const serviceGuideList = Object.values(deviceGuides);

export function getSymptom(device: string, symptomId: string) {
  const guide = deviceGuides[device as keyof typeof deviceGuides];
  return guide?.symptoms.find((symptom) => symptom.id === symptomId);
}
