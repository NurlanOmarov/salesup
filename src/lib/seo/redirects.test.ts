import { describe, it, expect } from "vitest";
import { isProbePath, normalizePath } from "@/lib/seo/redirects";

/** Выборка реальных путей из журнала 404 на проде — все до одного пробы сканеров. */
const PROBES = [
  "/ip",
  "/7",
  "/adm",
  "/info",
  "/env",
  "/_environment",
  "/.env.local",
  "/.env.prod",
  "/.env.bak",
  "/.env~",
  "/.env2",
  "/.env_copy",
  "/.env.development.local",
  "/.git/config",
  "/.git/HEAD",
  "/public/.git/config",
  "/var/www/.git/config",
  "/.git-credentials",
  "/.aws/credentials",
  "/id_rsa",
  "/id_ed25519",
  "/.esmtprc",
  "/config",
  "/application.yml",
  "/docker-compose.yml",
  "/storage/logs/laravel.log",
  "/wp",
  "/wp-json",
  "/wp/wp-json/batch/v1",
  "/wp-config.php.bak",
  "/wp-content/uploads/dump.sql",
  "/wordpress/.git/config",
  "/webroot/index.php/_environment",
  "/actuator/env",
  "/actuator/configprops",
  "/_profiler/phpinfo",
  "/phpinfo",
  "/phpinfo.php.old",
  "/info.php.bak",
  "/livewire/update",
  "/graphql",
  "/v1/chat/completions",
  "/chat/completions",
  "/backup.sql",
  "/backup.zip",
  "/backup.tar.gz",
  "/db.sqlite",
  "/database.bak",
  "/dump.sql.gz",
  "/study.activesales.by.sql",
  "/study.zip",
  "/2026.zip",
  "/tel:+375296053032",
  "/mailto:info@activesales.by",
  "/crusader-404-probe",
  "/__scanrs_missing_17619_2095112444212238371",
  "/__nonexistent_7619_6466",
  "/.well-known/traffic-advice",
];

/** Настоящие публичные адреса — их фильтр обязан пропускать в журнал. */
const REAL_PATHS = [
  "/courses",
  "/courses/sales-pharma",
  "/courses/sales-b2b",
  "/courses/time-management",
  "/business",
  "/offer",
  "/offer-b2b",
  "/privacy",
  "/obuchenie/kak-prodavat-nedvizhimost",
  "/obuchenie/trening-prodazh-minsk",
  "/verify/clx0000000000000000000000",
  "/app/learn/sales-realty/clx111",
  "/login",
];

describe("normalizePath", () => {
  it("отрезает query, hash и хвостовой слэш", () => {
    expect(normalizePath("/courses/?utm_source=vk")).toBe("/courses");
    expect(normalizePath("/courses#top")).toBe("/courses");
    expect(normalizePath("courses")).toBe("/courses");
    expect(normalizePath("/")).toBe("/");
  });
});

describe("isProbePath", () => {
  it.each(PROBES)("отсеивает пробу %s", (path) => {
    expect(isProbePath(path)).toBe(true);
  });

  it.each(REAL_PATHS)("пропускает настоящий адрес %s", (path) => {
    expect(isProbePath(path)).toBe(false);
  });

  it("пропускает опечатку в настоящем адресе — это и есть битая ссылка", () => {
    expect(isProbePath("/courses/sales-pharm")).toBe(false);
    expect(isProbePath("/cources/sales-pharma")).toBe(false);
  });
});
