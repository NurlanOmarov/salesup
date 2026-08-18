import type { MetadataRoute } from "next";
import { siteOrigin } from "@/lib/seo/site";

export default async function robots(): Promise<MetadataRoute.Robots> {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // приватные зоны и API не индексируем
      disallow: ["/app", "/admin", "/api/", "/login", "/change-password"],
    },
    sitemap: `${await siteOrigin()}/sitemap.xml`,
  };
}
