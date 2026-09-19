"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Check, Loader2, Mail, Send } from "lucide-react";
import { sendOrgCredentialsAction } from "../actions";
import { pluralRu } from "@/lib/courses/plural";
import { ActionResult, useActionResult } from "@/components/action-result";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { DeliveryStatus } from "@/lib/org/delivery";

/**
 * «Доступы клиенту»: итог настройки клиента и кнопка отправки письма со всеми
 * логинами и паролями.
 *
 * Панель отвечает на один вопрос владельца — «клиент получил свои доступы или я
 * забыл их отправить?» — и всегда показывает ответ цветом и текстом. Отправка
 * выдаёт новые временные пароли, поэтому нажатие сначала раскрывает
 * подтверждение с пересказом, что именно произойдёт и что получит клиент.
 */

export interface DeliveryPanelProps {
  orgId: string;
  orgName: string;
  status: DeliveryStatus;
  missing: string[];
  admins: number;
  learners: number;
  unissued: number;
  awaitingFirstLogin: number;
  signedIn: number;
  /** ISO-строка: Date через границу server → client не передаётся. */
  sentAt: string | null;
  sentTo: string | null;
  lastError: string | null;
  suggestedRecipient: string | null;
  emailEnabled: boolean;
}

const TONE: Record<DeliveryStatus, { box: string; icon: string }> = {
  "not-ready": { box: "border-foreground/15 bg-foreground/[0.02]", icon: "text-foreground/40" },
  unsent: { box: "border-amber-500/50 bg-amber-500/10", icon: "text-amber-600" },
  sending: { box: "border-sky-500/40 bg-sky-500/10", icon: "text-sky-600" },
  sent: { box: "border-emerald-600/30 bg-emerald-500/5", icon: "text-emerald-600" },
  failed: { box: "border-red-500/40 bg-red-500/5", icon: "text-red-600" },
};

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString("ru-RU", { dateStyle: "short", timeStyle: "short" });
}

export function DeliveryPanel(props: DeliveryPanelProps) {
  const router = useRouter();
  const feedback = useActionResult();
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);
  const [to, setTo] = useState(props.suggestedRecipient ?? "");
  const tone = TONE[props.status];

  // Письмо уходит фоновой задачей: пока она идёт, подтягиваем итог сами, чтобы
  // не заставлять нажимать «обновить».
  useEffect(() => {
    if (props.status !== "sending") return;
    const timer = window.setInterval(() => router.refresh(), 4000);
    return () => window.clearInterval(timer);
  }, [props.status, router]);

  async function send() {
    setPending(true);
    feedback.clear();
    try {
      const res = await sendOrgCredentialsAction({ orgId: props.orgId, to });
      if (res.ok) {
        setConfirming(false);
        router.refresh();
      } else {
        feedback.fail(res.error);
      }
    } catch {
      feedback.fail("Не удалось отправить запрос — обновите страницу и попробуйте ещё раз.");
    } finally {
      setPending(false);
    }
  }

  const learnersWord = pluralRu(props.learners, "сотрудник", "сотрудника", "сотрудников");
  const canSend = props.status !== "not-ready" && props.status !== "sending";
  const isResend = props.status === "sent" || Boolean(props.sentAt);

  // Кого затронет отправка: всех, кто ещё не входил под выданным паролем.
  const affected = props.awaitingFirstLogin;

  return (
    <section
      id="delivery"
      className={`scroll-mt-20 rounded-2xl border p-4 sm:p-5 ${tone.box}`}
      aria-live="polite"
    >
      <div className="flex flex-wrap items-start gap-3">
        <span className={`mt-0.5 ${tone.icon}`}>
          {props.status === "sent" ? (
            <Check className="size-5" />
          ) : props.status === "sending" ? (
            <Loader2 className="size-5 animate-spin" />
          ) : props.status === "not-ready" ? (
            <Mail className="size-5" />
          ) : (
            <AlertTriangle className="size-5" />
          )}
        </span>

        <div className="min-w-0 flex-1">
          <h2 className="text-base font-semibold">Доступы клиенту</h2>

          {props.status === "not-ready" ? (
            <p className="mt-1 text-sm text-foreground/65">
              Пока нечего отправлять. Не хватает: <strong>{props.missing.join(", ")}</strong>.
              Когда всё будет готово, здесь появится кнопка отправки.
            </p>
          ) : null}

          {props.status === "unsent" ? (
            <p className="mt-1 text-sm text-foreground/75">
              <strong>Клиент ещё не получил доступы.</strong>{" "}
              {props.sentAt
                ? `После последней отправки появились новые учётки (${props.unissued}) — им пароли ещё не выданы.`
                : `Кабинеты созданы (ответственных: ${props.admins}, сотрудников: ${props.learners}), но логины и пароли никуда не отправлены.`}{" "}
              Нажмите кнопку — клиенту уйдёт одно письмо со всеми доступами.
            </p>
          ) : null}

          {props.status === "sending" ? (
            <p className="mt-1 text-sm text-foreground/75">
              Письмо отправляется… Результат появится здесь и придёт вам в Telegram.
            </p>
          ) : null}

          {props.status === "sent" ? (
            <p className="mt-1 text-sm text-foreground/75">
              {props.sentAt ? (
                <>
                  <strong>Доступы отправлены</strong> {formatWhen(props.sentAt)} на{" "}
                  <span className="font-mono">{props.sentTo}</span>.
                </>
              ) : (
                <>
                  <strong>Клиент уже работает в кабинете</strong> ({props.signedIn} уже входили) —
                  доступы были выданы раньше.
                </>
              )}
              {props.awaitingFirstLogin > 0
                ? ` Ещё не входили: ${props.awaitingFirstLogin}.`
                : " Все учётки уже использованы."}
            </p>
          ) : null}

          {props.status === "failed" ? (
            <p className="mt-1 text-sm text-red-700">
              <strong>Письмо не отправлено.</strong>{" "}
              {props.lastError ? `Причина: ${props.lastError}. ` : ""}
              Пароли при этом не менялись — можно нажать «Отправить» ещё раз.
            </p>
          ) : null}

          {!props.emailEnabled && props.status !== "not-ready" ? (
            <p className="mt-2 text-sm text-red-700">
              Почта на сервере выключена (EMAIL_ENABLED=false), поэтому отправить письмо нельзя.
            </p>
          ) : null}
        </div>

        {canSend && !confirming && props.emailEnabled ? (
          <Button
            size="sm"
            variant={props.status === "sent" ? "outline" : "default"}
            onClick={() => setConfirming(true)}
          >
            <Send className="mr-1.5 size-4" />
            {props.status === "sent"
              ? "Отправить ещё раз"
              : isResend
                ? "Отправить новые доступы"
                : "Завершить настройку и отправить"}
          </Button>
        ) : null}
      </div>

      {confirming ? (
        <div className="mt-4 rounded-xl border border-foreground/10 bg-background p-4">
          <p className="text-sm font-semibold">Что произойдёт после нажатия</p>
          <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm text-foreground/75">
            <li>
              Клиенту уйдёт <strong>одно письмо</strong> с двумя блоками: учётка{" "}
              <strong>ответственного</strong> (управляет обучением: подключает сотрудников,
              смотрит отчёты, выдаёт пароли) и учётки <strong>сотрудников</strong> (
              {props.learners} {learnersWord}: только проходят курсы). У каждого блока в письме
              объяснено, для чего он.
            </li>
            <li>
              Всем, кто ещё не входил ({affected}), будут выданы{" "}
              <strong>новые временные пароли</strong>. Пароли, которые вы передавали раньше,
              перестанут работать. Уже вошедшие ({props.signedIn}) не затрагиваются.
            </li>
            <li>Пароли нигде не сохраняются: в системе остаётся только их защищённый хеш.</li>
          </ul>

          <div className="mt-3 max-w-md space-y-1.5">
            <Label htmlFor="delivery-to">Кому отправить</Label>
            <Input
              id="delivery-to"
              type="email"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder="hr@company.by"
            />
            <p className="text-xs text-foreground/55">
              Обычно — e-mail ответственного: он раздаст логины сотрудникам.
            </p>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Button size="sm" onClick={send} disabled={pending || !to.includes("@")}>
              {pending ? "Отправляем…" : "Да, отправить клиенту"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setConfirming(false);
                feedback.clear();
              }}
              disabled={pending}
            >
              Отмена
            </Button>
            <ActionResult result={feedback.result} />
          </div>
        </div>
      ) : (
        <ActionResult result={feedback.result} className="mt-2" />
      )}
    </section>
  );
}
