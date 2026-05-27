// shadcn/ui 컴포넌트들이 className 병합에 사용하는 cn 헬퍼.
// clsx 로 조건부 클래스를 합치고 twMerge 로 Tailwind 우선순위를 정리한다.
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
