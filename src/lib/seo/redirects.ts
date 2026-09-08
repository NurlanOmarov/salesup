import "server-only";
import { db } from "@/lib/db";
import { log } from "@/lib/log";

/**
 * Резолвинг 301/308-редиректов на уровне приложения (не в edge-middleware — там нет
 * Prisma). Основной кейс: фабрика переименовала slug курса → старый /courses/<old>
 * ведёт на новый через permanentRedirect в courses/[slug]. hits инкрементируется
 * best-effort (не блокирует ответ, идёт в дайджест).
 */

/** Нормализация пути: ведущий /, без хвостового /, без query/hash. */
export function normalizePath(path: string): string {
  const clean = (path.split("?")[0] ?? "").split("#")[0]?.trim() ?? "";
  const withLead = clean.startsWith("/") ? clean : `/${clean}`;
  return withLead.length > 1 ? withLead.replace(/\/+$/, "") : withLead;
}

/**
 * Найти назначение редиректа для пути. Возвращает `to` или null.
 * Инкремент hits — в фоне (без await на критическом пути), ошибки глотаем.
 */
export async function resolveRedirect(fromPath: string): Promise<string | null> {
  const from = normalizePath(fromPath);
  const row = await db.redirect.findUnique({ where: { from } });
  if (!row) return null;

  db.redirect
    .update({ where: { id: row.id }, data: { hits: { increment: 1 } } })
    .catch((e) => log.warn({ err: e, from }, "redirect: не удалось инкрементировать hits"));

  return row.to;
}

// ─────────────────────────── Журнал 404 ───────────────────────────

/** Расширения, которые не логируем (скан-шум ботов и запросы ассетов). */
const SKIP_EXT =
  /\.(png|jpe?g|webp|gif|svg|ico|css|js|map|txt|xml|json|woff2?|ttf|php|asp|aspx|env|html?|py|sh|rb|pl|cgi|action|lock|conf|cnf|toml|db|pem|key|crt|p12|pfx|jks|tfstate)$/i;
/** Служебные метадата-пути Next (og/twitter-картинки, иконки) — не битые ссылки. */
const SKIP_META = /(opengraph-image|twitter-image|apple-icon|favicon|\/icon)([-.?/]|$)/i;
/**
 * Пробы сканеров уязвимостей: секреты, дампы, чужие стеки. Без них журнал 404 на
 * 100% состоит из ботового шума и настоящую битую ссылку в нём не разглядеть.
 */
const SKIP_PROBE = [
  // Секреты, ключи, конфиги
  /(^|\/)\.?env([-._~\d]|$)/i,
  /^\/_?environment$/i,
  /(^|\/)\.(git|svn|hg)(\/|-|$)/i,
  /^\/\.(aws|ssh|docker|npmrc|netrc|esmtprc|pgpass|pypirc|ftpconfig|envrc|terraform|DS_Store|[a-z]*_?history)/i,
  /(^|\/)id_(rsa|dsa|ecdsa|ed25519)$/i,
  /(^|\/)aws_?\/credentials$/i,
  /^\/(config|application|docker-compose|storage\/logs)([./]|$)/i,
  /^\/(Dockerfile|Procfile|Jenkinsfile|Makefile)$/,
  // Чужие стеки, которых у нас нет
  /^\/(wp|wordpress)([-./]|$)/i,
  /index\.php(\/|$)/i,
  /^\/(actuator|_profiler|livewire|telescope|rails|rest|ecp|enhancecp|minio|RPC2)(\/|$)/i,
  /(^|\/)(phpinfo|info\.php)|\.php[-.]/i,
  /(^|\/)META-INF(\/|$)/,
  /^\/(graphql|graphiql|swagger-ui|api-docs|api)(\/|$)/i,
  /^\/v[\d.]+\/(api-docs|_catalog|keys|sys|kv|containers|chat)(\/|$)/i,
  /^\/(chat\/completions|containers\/json)$/i,
  // Отладка, метрики и health чужих сервисов
  /^\/(debug|metrics|console|haproxy|nodesync|exec|preload|server)(\/|$)/i,
  /^\/(status|server-status|server-info|nginx_status|fpm-status|trace\.axd|@vite\/env)$/i,
  // Дампы и архивы
  /\.(sql|sqlite|bak|zip|gz|tgz|rar|7z|swp|old|save|orig|dist|tpl|ya?ml|log)$/i,
  /^\/(backup|backups|dump|db|database|mysql|data)([-._\d]|$)/i,
  // Служебные маркеры самих сканеров, мусор и короткие пробы
  /^\/(__|_)/,
  /(^|\/)(crusader|scanrs|seoops|nonexistent)/i,
  /^\/\.well-known(\/|$)/i,
  /[\\*$&]/,
  /^\/(ip|info|adm|admin|home|about|lookup|image|null|\d{1,4})$/i,
  // Краулеры, принимающие tel:/mailto:/viber: за относительный путь
  /^\/(tel|mailto|viber|sms|callto|skype|https?):/i,
];

/** Похож ли путь на пробу бота, а не на битую ссылку сайта. */
export function isProbePath(path: string): boolean {
  return SKIP_PROBE.some((re) => re.test(path));
}

/**
 * Зафиксировать 404 на публичной странице (агрегат по пути: hits++). Best-effort:
 * ошибки глотаем, ответ пользователю не задерживаем. Пути ассетов/скан-шум — мимо.
 */
export async function recordNotFound(rawPath: string): Promise<void> {
  try {
    const path = normalizePath(rawPath);
    if (
      path.length < 2 ||
      path.length > 200 ||
      SKIP_EXT.test(path) ||
      SKIP_META.test(path) ||
      isProbePath(path)
    ) {
      return;
    }
    await db.notFoundHit.upsert({
      where: { path },
      create: { path },
      update: { hits: { increment: 1 } },
    });
  } catch (e) {
    log.warn({ err: e, rawPath }, "notfound: не удалось записать");
  }
}
