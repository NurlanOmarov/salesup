import type { Metadata } from "next";
import { JoinForm } from "./join-form";

export const metadata: Metadata = {
  title: "Регистрация по коду",
  robots: { index: false },
};

/**
 * Страница самозаписи работника. Код можно передать ссылкой (/join?code=ABCD2345) —
 * так удобнее раздавать через корпоративный чат.
 */
export default async function JoinPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string }>;
}) {
  const { code } = await searchParams;
  return <JoinForm defaultCode={code} />;
}
