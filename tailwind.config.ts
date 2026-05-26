import type { Config } from "tailwindcss";

// Tailwind v4 는 기본적으로 source 를 자동 감지하지만,
// content 를 명시해 트리쉐이킹과 빌드 안정성을 보장한다.
const config: Config = {
  content: ["./src/**/*.{ts,tsx,mdx}"],
  // next-themes 와 결합해 .dark 클래스로 다크모드 토글.
  darkMode: "class",
};

export default config;
