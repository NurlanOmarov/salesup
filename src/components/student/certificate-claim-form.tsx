"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Award, Loader2, AlertCircle } from "lucide-react";
import { issueCertificateAction } from "@/app/(student)/app/certificates/actions";
import { Button } from "@/components/ui/button";

/**
 * Шаг 2: ФИО для сертификата и согласие на обработку персональных данных.
 * Сертификат выпускается сразу после отправки (D-019). Согласие — отдельная
 * галочка, по умолчанию снята (Закон РБ № 99-З: согласие — активным действием),
 * полный текст показан рядом, а не спрятан за ссылкой.
 */
export function CertificateClaimForm({
  certificateId,
  consentText,
  isOrgLearner,
}: {
  certificateId: string;
  consentText: string;
  isOrgLearner: boolean;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const submit = () => {
    setError(null);
    if (!consent) {
      setError("Отметьте согласие на обработку персональных данных");
      return;
    }
    start(async () => {
      const res = await issueCertificateAction({ certificateId, holderName: name, consent: true });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.refresh();
    });
  };

  return (
    <div className="mt-4 rounded-xl border border-amber-500/25 bg-amber-500/[0.04] p-4">
      <p className="text-sm font-semibold">Шаг 2. ФИО для сертификата</p>
      <p className="mt-1 text-sm text-foreground/60">
        Спасибо за отзыв! Укажите фамилию, имя и отчество так, как они должны стоять в
        сертификате, — он будет готов сразу.
        {isOrgLearner
          ? " Копия уйдёт на почту ответственного представителя вашей компании."
          : " Копия придёт вам на почту."}
      </p>

      <label className="mt-3 block text-xs font-medium text-foreground/70" htmlFor="holder-name">
        Фамилия, имя, отчество
      </label>
      <input
        id="holder-name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        autoComplete="name"
        placeholder="Например: Иванов Иван Иванович"
        className="mt-1 block w-full rounded-lg border border-foreground/15 bg-background px-3 py-2 text-sm outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20"
      />
      <p className="mt-1 text-xs text-foreground/50">Проверьте написание: исправить ФИО после выпуска нельзя.</p>

      <label className="mt-4 flex items-start gap-2 text-xs leading-relaxed text-foreground/70">
        <input
          type="checkbox"
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
          className="mt-0.5 size-4 shrink-0 accent-amber-500"
        />
        <span>
          {consentText}{" "}
          <Link href="/privacy" target="_blank" className="text-amber-700 underline underline-offset-2">
            Политика обработки персональных данных
          </Link>
        </span>
      </label>

      {error ? (
        <p className="mt-3 flex items-center gap-1.5 text-sm text-red-600">
          <AlertCircle className="size-4 shrink-0" />
          {error}
        </p>
      ) : null}

      <Button onClick={submit} disabled={pending || !name.trim()} variant="accent" className="mt-4">
        {pending ? <Loader2 className="size-4 animate-spin" /> : <Award className="size-4" />}
        {pending ? "Выпускаем сертификат…" : "Получить сертификат"}
      </Button>
    </div>
  );
}
