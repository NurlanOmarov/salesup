import { ImageResponse } from "next/og";

/**
 * Генерация PNG-иконок приложения «на лету» для PWA-манифеста (без бинарных ассетов
 * в репозитории). ?size=192|512, ?maskable=1 — с safe-zone отступом под Android-маски.
 * Брендовый знак: красный квадрат + белый «шеврон» (как в public/logo.png).
 */
export const dynamic = "force-static";
export const revalidate = false;

export function GET(req: Request) {
  const url = new URL(req.url);
  const size = Math.min(1024, Math.max(48, Number(url.searchParams.get("size")) || 512));
  const maskable = url.searchParams.get("maskable") === "1";
  const pad = maskable ? Math.round(size * 0.14) : 0; // safe-zone для maskable
  const inner = size - pad * 2;
  const stroke = Math.round(inner * 0.1);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#f4003a",
        }}
      >
        <svg
          width={inner}
          height={inner}
          viewBox="0 0 64 64"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M20 44 L32 20 L44 44"
            fill="none"
            stroke="#ffffff"
            strokeWidth={stroke * (64 / inner)}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="32" cy="20" r="4" fill="#ffffff" />
        </svg>
      </div>
    ),
    { width: size, height: size },
  );
}
