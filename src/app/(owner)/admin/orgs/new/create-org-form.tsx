"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createOrgAction } from "../actions";
import { slugifyOrgName } from "@/lib/org/seats";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Заведение корпоративного клиента. Ничего лишнего: реквизиты нужны для счёта,
 * контакт — для связи с ответственным. Лицензии и представителя добавляем на
 * следующем шаге, в карточке организации.
 */
export function CreateOrgForm({
  defaultName,
  defaultContactEmail,
  defaultContactNote,
  defaultNote,
}: {
  defaultName?: string;
  defaultContactEmail?: string;
  defaultContactNote?: string;
  defaultNote?: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [name, setName] = useState(defaultName ?? "");
  const [slug, setSlug] = useState("");

  // Код организации задаёт вид логинов работников — показываем это сразу,
  // потому что менять его после выдачи логинов уже нельзя.
  const effectiveSlug = slug || slugifyOrgName(name) || "org";

  async function onSubmit(formData: FormData) {
    setPending(true);
    setError(null);
    setFieldErrors({});
    try {
      const res = await createOrgAction({
        name: formData.get("name"),
        slug: slug || undefined,
        unp: formData.get("unp") || undefined,
        contactEmail: formData.get("contactEmail") || undefined,
        contactNote: formData.get("contactNote") || undefined,
        note: formData.get("note") || undefined,
      });
      if (res.ok) {
        router.push(`/admin/orgs/${res.data.orgId}`);
        router.refresh();
        return;
      }
      setError(res.error);
      if (res.fieldErrors) setFieldErrors(res.fieldErrors);
    } catch {
      // Сбой самого вызова экшена (не бизнес-ошибка внутри него) — например,
      // сессия истекла и запрос перехватил редирект на /login. Без этого catch
      // форма тихо зависала: без ошибки, без редиректа (баг из практики).
      setError("Не удалось отправить форму — обновите страницу и попробуйте ещё раз.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form action={onSubmit} className="max-w-lg space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="name">Наименование организации *</Label>
        <Input
          id="name"
          name="name"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="ООО «Фарм-Дистрибьютор»"
        />
        {fieldErrors.name ? (
          <p className="text-xs text-red-600">{fieldErrors.name[0]}</p>
        ) : null}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="slug">Код организации</Label>
        <Input
          id="slug"
          name="slug"
          value={slug}
          onChange={(e) => setSlug(e.target.value.toLowerCase())}
          placeholder={slugifyOrgName(name) || "acme"}
        />
        <p className="text-xs text-foreground/55">
          Из него строятся логины работников:{" "}
          <span className="font-mono text-foreground/80">{effectiveSlug}-0001</span>,{" "}
          <span className="font-mono text-foreground/80">{effectiveSlug}-0002</span>.
          Пусто — подставим автоматически. После выдачи логинов не меняется.
        </p>
        {fieldErrors.slug ? (
          <p className="text-xs text-red-600">{fieldErrors.slug[0]}</p>
        ) : null}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="unp">УНП</Label>
        <Input id="unp" name="unp" placeholder="191234567" />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="contactEmail">E-mail ответственного</Label>
        <Input
          id="contactEmail"
          name="contactEmail"
          type="email"
          defaultValue={defaultContactEmail}
          placeholder="hr@company.by"
        />
        {fieldErrors.contactEmail ? (
          <p className="text-xs text-red-600">{fieldErrors.contactEmail[0]}</p>
        ) : null}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="contactNote">Другой контакт</Label>
        <Input
          id="contactNote"
          name="contactNote"
          defaultValue={defaultContactNote}
          placeholder="Telegram, телефон"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="note">Заметка для себя</Label>
        <Input
          id="note"
          name="note"
          defaultValue={defaultNote}
          placeholder="Счёт №12 от 14.08, оплата до 20.08"
        />
      </div>

      {error ? (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      ) : null}

      <Button type="submit" disabled={pending}>
        {pending ? "Создаём…" : "Создать организацию"}
      </Button>

      <p className="text-xs text-foreground/50">
        Персональные данные работников на платформе не хранятся: они регистрируются
        сами по кодам, под условными обозначениями (оферта для организаций, п. 10).
      </p>
    </form>
  );
}
