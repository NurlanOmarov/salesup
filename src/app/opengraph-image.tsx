import { ImageResponse } from "next/og";
import { getSeoSettings } from "@/lib/seo/settings";
import { ogFileResponse } from "@/lib/seo/og";

export const alt = "Бизнес-платформа ACTIVE SALES — AI-тренажёр продаж";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/**
 * OG-изображение: если владелец загрузил свою картинку в SEO-настройках
 * (defaultOgKey) — отдаём её; иначе — авто-генерация через satori.
 * Текст латиницей: дефолтный шрифт satori не содержит кириллицы,
 * а тянуть шрифт по сети при сборке нельзя (один сервер, без внешних зависимостей).
 */
export default async function OgImage() {
  try {
    const s = await getSeoSettings();
    const custom = await ogFileResponse(s.defaultOgKey);
    if (custom) return custom;
  } catch {
    // при сборке без БД / сбое хранилища — генерируем как обычно
  }
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "80px",
          background: "linear-gradient(135deg, #020617 0%, #0f172a 100%)",
          color: "white",
          fontSize: 32,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
            color: "#f59e0b",
            fontSize: 28,
            fontWeight: 700,
          }}
        >
          {/* логотип-стрелка как CSS-фигура: глифы вне базового шрифта satori недоступны */}
          <div
            style={{
              width: 0,
              height: 0,
              borderLeft: "16px solid transparent",
              borderRight: "16px solid transparent",
              borderBottom: "26px solid #f59e0b",
            }}
          />
          ACTIVE SALES
        </div>
        <div
          style={{
            marginTop: 36,
            fontSize: 72,
            fontWeight: 800,
            lineHeight: 1.1,
            letterSpacing: -2,
          }}
        >
          AI Sales Training
        </div>
        <div style={{ marginTop: 24, color: "rgba(255,255,255,0.65)" }}>
          Video courses + AI client simulator · Minsk · Belarus
        </div>
        <div
          style={{
            marginTop: 48,
            display: "flex",
            gap: 12,
            alignItems: "center",
          }}
        >
          <div
            style={{
              background: "#f59e0b",
              color: "#020617",
              borderRadius: 999,
              padding: "12px 28px",
              fontSize: 26,
              fontWeight: 700,
            }}
          >
            salesacademy.kz
          </div>
        </div>
      </div>
    ),
    size,
  );
}
