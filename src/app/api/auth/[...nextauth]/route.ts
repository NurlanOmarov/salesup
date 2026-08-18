import { NextRequest } from "next/server";
import { handlers } from "@/auth";

/**
 * Мультидомен: Auth.js строит адреса (callback-url, редиректы) из URL запроса, а
 * в standalone-контейнере он внутренний — `http://0.0.0.0:3000`. Раньше это
 * лечили переменной AUTH_URL, но она пиннила все домены на один и ломала
 * самостоятельность .kz/.ru (docs/MULTI-DOMAIN-PLAN.md).
 *
 * Поэтому подставляем публичный адрес из заголовков прокси перед тем, как отдать
 * запрос обработчику: edge проксирует реальные X-Forwarded-Host/Proto.
 */
function withPublicUrl(req: NextRequest): NextRequest {
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  if (!host) return req;
  const url = new URL(req.url);
  url.protocol = (req.headers.get("x-forwarded-proto") ?? url.protocol.replace(":", "")) + ":";
  url.host = host;
  return new NextRequest(url, req);
}

export const GET = (req: NextRequest) => handlers.GET(withPublicUrl(req));
export const POST = (req: NextRequest) => handlers.POST(withPublicUrl(req));
