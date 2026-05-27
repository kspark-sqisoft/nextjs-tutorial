// next-intl 의 매 요청 컨피그.
// 학습 단순화: [locale] segment 와 middleware 를 도입하지 않고,
// cookie 'blog_locale' 로 locale 을 결정한다 (없으면 ko).
import { getRequestConfig } from "next-intl/server";
import { cookies } from "next/headers";

const LOCALES = ["ko", "en"] as const;
type Locale = (typeof LOCALES)[number];

export default getRequestConfig(async () => {
  const jar = await cookies();
  const cookieLocale = jar.get("blog_locale")?.value;
  const locale: Locale = LOCALES.includes(cookieLocale as Locale)
    ? (cookieLocale as Locale)
    : "ko";
  return {
    locale,
    messages: (await import(`./messages/${locale}.json`)).default,
  };
});
