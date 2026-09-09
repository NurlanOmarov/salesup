import { test, expect } from "@playwright/test";
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

/** Контакты, созданные тестами: номера обязаны быть настоящими, поэтому чистим по списку. */
const usedContacts: string[] = [];

/** Валидный белорусский мобильный — форма принимает только разбираемый номер. */
function belarusPhone(): { typed: string; stored: string } {
  const digits = String(Math.floor(1_000_000 + Math.random() * 8_999_999));
  usedContacts.push(`+37529${digits}`);
  return { typed: `+375 29 ${digits}`, stored: `+37529${digits}` };
}

test.afterAll(async () => {
  await db.lead.deleteMany({ where: { contact: { in: usedContacts } } });
  await db.$disconnect();
});

test("заявка с формы создаёт Lead в БД", async ({ page }) => {
  const phone = belarusPhone();

  await page.goto("/");
  await page
    .getByRole("link", { name: "Подобрать курс под мою отрасль" })
    .click();

  // форма заявки в секции #zayavka
  await page.getByLabel("Имя").fill("E2E Заявка");
  // Канал по умолчанию — мессенджер: на письма владелец отвечает дольше.
  await expect(page.getByRole("button", { name: "WhatsApp" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.getByLabel(/Как с вами связаться/).fill(phone.typed);
  await page.getByLabel("Комментарий").fill("Интересует курс по туризму");
  // согласие на обработку ПДн — обязательная отметка (Закон РБ № 99-З)
  await page.getByRole("checkbox", { name: /Я согласен/ }).check();
  await page.getByRole("button", { name: "Оставить заявку" }).click();

  await expect(page.getByText("Заявка отправлена!")).toBeVisible();

  // проверяем, что запись появилась в БД (AC: «заявка появляется в админке»)
  await expect
    .poll(async () => db.lead.count({ where: { contact: phone.stored } }))
    .toBe(1);

  const lead = await db.lead.findFirst({ where: { contact: phone.stored } });
  // Номер сохранён в E.164 с кодом страны — иначе мессенджер его не найдёт,
  // а страна номера нужна владельцу до звонка.
  expect(lead?.contactType).toBe("WHATSAPP");
  expect(lead?.contactCountry).toBe("BY");
  // и что зафиксирован факт согласия с версией редакции документов
  expect(lead?.consentAt).not.toBeNull();
  expect(lead?.consentVersion).toBeTruthy();
});

test("номер без кода страны в заявку не попадает", async ({ page }) => {
  // Локальный «0291234567» WhatsApp не находит — такую заявку принимать нельзя.
  await page.goto("/#zayavka");
  await page.getByLabel(/Как с вами связаться/).fill("12345");
  await page.getByRole("checkbox", { name: /Я согласен/ }).check();
  await page.getByRole("button", { name: "Оставить заявку" }).click();

  await expect(page.getByText("Заявка отправлена!")).toBeHidden();
  await expect(page.getByText(/Укажите номер WhatsApp с кодом страны/)).toBeVisible();
});

test("заявка без согласия на обработку ПДн не отправляется", async ({
  page,
}) => {
  const phone = belarusPhone();

  await page.goto("/#zayavka");
  await page.getByLabel(/Как с вами связаться/).fill(phone.typed);
  await page.getByRole("button", { name: "Оставить заявку" }).click();

  // браузер не даёт отправить форму с непроставленной обязательной отметкой
  await expect(page.getByText("Заявка отправлена!")).toBeHidden();
  expect(await db.lead.count({ where: { contact: phone.stored } })).toBe(0);
});

test("заявка на офлайн-тренинг: без тарифа и расчёта", async ({ page }) => {
  // Офлайн платформа не продаёт: переключатель прячет калькулятор, а в заявке
  // не должно остаться ни выбранного тарифа, ни посчитанной суммы — иначе в
  // уведомлении владельцу появится цена, которой он клиенту не называл.
  const contact = `hr-offline-${Date.now()}@test.local`;

  await page.goto("/business");
  await page.getByRole("button", { name: "Офлайн-тренинг" }).first().click();
  await expect(
    page.getByText("Живой тренинг у вас в компании").first(),
  ).toBeVisible();

  await page.getByLabel("Организация").first().fill("E2E Офлайн Компания");
  await page.getByLabel("Сколько участников").first().fill("14");
  // Почта — не канал по умолчанию: чтобы её оставить, вкладку выбирают явно.
  await page.getByRole("button", { name: "E-mail" }).first().click();
  await page.getByLabel(/Как с вами связаться/).first().fill(contact);
  await page.getByRole("checkbox").first().check();
  await page.getByRole("button", { name: "Отправить запрос" }).first().click();
  await expect(page.getByText(/Заявка отправлена/).first()).toBeVisible();

  const lead = await db.lead.findFirstOrThrow({ where: { contact } });
  expect(lead.format).toBe("OFFLINE");
  expect(lead.kind).toBe("B2B");
  expect(lead.seatsWanted).toBe(14);
  expect(lead.plan).toBeNull();
  expect(lead.quotedTotalTiyn).toBeNull();

  await db.lead.deleteMany({ where: { contact } });
});

test("публичные страницы оферты и политики доступны без входа", async ({
  page,
}) => {
  await page.goto("/offer");
  await expect(
    page.getByRole("heading", { name: "Публичная оферта" }),
  ).toBeVisible();

  await page.goto("/offer-b2b");
  await expect(
    page.getByRole("heading", { name: "Публичная оферта для организаций" }),
  ).toBeVisible();
  // приложение-поручение на обработку ПДн — обязательная часть B2B-документа
  await expect(
    page.getByRole("heading", { name: /Поручение на обработку персональных данных/ }),
  ).toBeVisible();

  await page.goto("/privacy");
  await expect(
    page.getByRole("heading", {
      name: "Политика в отношении обработки персональных данных",
    }),
  ).toBeVisible();

  // тексты документов должны быть на месте, а не заглушка
  await expect(
    page.getByRole("heading", { name: /Права субъекта персональных данных/ }),
  ).toBeVisible();
});
