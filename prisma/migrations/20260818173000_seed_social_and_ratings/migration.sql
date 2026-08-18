-- Ссылки на соцсети и оценки школы на картах заполняем в самой БД, а не только
-- в SEO_DEFAULTS: дефолты из кода применяются, лишь когда строки SeoSettings нет
-- вовсе, а на проде она есть — из-за этого футер и блок доверия остались пустыми.
-- Трогаем только незаполненные поля: то, что владелец задал в /admin/seo, важнее.
UPDATE "SeoSettings" SET
  "socialInstagram" = COALESCE(NULLIF("socialInstagram", ''), 'https://www.instagram.com/activesales.by/'),
  "socialYoutube"   = COALESCE(NULLIF("socialYoutube", ''),   'https://www.youtube.com/channel/UCI9_MiDDbAsfctHtXtsG5Bw'),
  "socialTiktok"    = COALESCE(NULLIF("socialTiktok", ''),    'https://www.tiktok.com/@dubovikvitaliy'),
  "socialFacebook"  = COALESCE(NULLIF("socialFacebook", ''),  'https://www.facebook.com/groups/activesales/'),
  "socialLinkedin"  = COALESCE(NULLIF("socialLinkedin", ''),  'https://www.linkedin.com/in/vitaly-dubovik-1ab9204a/'),
  "socialVk"        = COALESCE(NULLIF("socialVk", ''),        'https://vk.com/activesalesby'),
  "yandexMapsUrl"   = COALESCE(NULLIF("yandexMapsUrl", ''),   'https://yandex.by/maps/org/ektiv_seylz/225492259144/reviews/'),
  "googleMapsUrl"   = COALESCE(NULLIF("googleMapsUrl", ''),   'https://www.google.com/maps?cid=6438951297707191038'),
  "yandexRating"    = COALESCE("yandexRating", 4.7),
  "googleRating"    = COALESCE("googleRating", 4.9)
WHERE "id" = 'singleton';
