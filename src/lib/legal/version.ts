import "server-only";
import { legalVersion } from "@/content/legal";
import { currentSite } from "@/lib/seo/site";

/**
 * Редакция документов, которую человек принял на своём домене: на .kz и .ru
 * оферта и политика содержат страновое приложение, поэтому версия у них своя
 * («1.1-KZ»). Без этого по User.termsVersion нельзя восстановить, какой текст
 * показывали при акцепте (docs/MULTI-DOMAIN-PLAN.md).
 */
export async function acceptedLegalVersion(): Promise<string> {
  const site = await currentSite();
  return legalVersion(site?.code ?? "BY");
}
