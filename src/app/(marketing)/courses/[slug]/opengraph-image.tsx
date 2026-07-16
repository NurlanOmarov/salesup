import { ImageResponse } from "next/og";
import { db } from "@/lib/db";
import { formatPrice } from "@/lib/utils";
import { ogFileResponse } from "@/lib/seo/og";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Бизнес-платформа ACTIVE SALES — курс по продажам";

const industryColors: Record<string, string> = {
  "Медпредставители": "#0d9488",
  "Туризм": "#0284c7",
  "Мебель и кухни": "#ea580c",
  "Обувь и одежда": "#db2777",
  "Недвижимость": "#059669",
  "B2B-переговоры": "#4f46e5",
  "FMCG": "#7c3aed",
  "Розница": "#e11d48",
};

export default async function CourseOgImage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const course = await db.course.findFirst({
    where: { slug, status: "PUBLISHED" },
    select: {
      title: true,
      subtitle: true,
      industry: true,
      priceTiyn: true,
      hoursLabel: true,
      ogImageUrl: true,
    },
  });

  // Кастомная OG-картинка курса (загружена в админке) — приоритет над генерацией.
  const custom = await ogFileResponse(course?.ogImageUrl);
  if (custom) return custom;

  const title = course?.title ?? "Курс по продажам";
  const subtitle = course?.subtitle ?? "Авторские программы бизнес-тренера";
  const industry = course?.industry ?? "";
  const accentColor = industry ? (industryColors[industry] ?? "#f59e0b") : "#f59e0b";
  const price = course ? formatPrice(course.priceTiyn) : "";
  const hours = course?.hoursLabel ?? "";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "64px 80px",
          background: "linear-gradient(135deg, #020617 0%, #0f172a 60%, #1e293b 100%)",
          color: "white",
        }}
      >
        {/* Header: logo + industry */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, color: "#f59e0b", fontWeight: 700, fontSize: 22 }}>
            <div style={{ width: 0, height: 0, borderLeft: "12px solid transparent", borderRight: "12px solid transparent", borderBottom: "20px solid #f59e0b" }} />
            ACTIVE SALES
          </div>
          {industry ? (
            <div style={{ background: accentColor + "22", border: `1px solid ${accentColor}55`, borderRadius: 999, padding: "6px 18px", fontSize: 16, color: accentColor }}>
              {industry}
            </div>
          ) : null}
        </div>

        {/* Title block */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 900 }}>
          <div style={{ fontSize: 64, fontWeight: 800, lineHeight: 1.1, letterSpacing: -2 }}>
            {title}
          </div>
          <div style={{ fontSize: 28, color: "rgba(255,255,255,0.6)" }}>
            {subtitle}
          </div>
        </div>

        {/* Footer: price, hours, badge */}
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          {price ? (
            <div style={{ background: "#f59e0b", color: "#020617", borderRadius: 999, padding: "10px 28px", fontSize: 28, fontWeight: 700 }}>
              {price}
            </div>
          ) : null}
          {hours ? (
            <div style={{ fontSize: 20, color: "rgba(255,255,255,0.5)" }}>
              {hours}
            </div>
          ) : null}
          <div style={{ marginLeft: "auto", fontSize: 18, color: "rgba(255,255,255,0.35)" }}>
            salesacademy.kz
          </div>
        </div>
      </div>
    ),
    size,
  );
}
