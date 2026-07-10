import { NextResponse } from "next/server";
import { currency } from "@/lib/currency";

export const dynamic = "force-dynamic";

/**
 * Публичные курсы валют Нацбанка РК (база — тенге).
 *   GET /api/currency/rates → { rates: { KZT:1, RUB:…, BYN:…, … }, updatedAt }
 * Кэш на сутки; при протухании — фоновое обновление (см. lib/currency/rates).
 */
export async function GET() {
  const data = await currency.getRates();
  return NextResponse.json(data, {
    headers: {
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
