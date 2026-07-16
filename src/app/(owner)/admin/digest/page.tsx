import type { Metadata } from "next";
import Link from "next/link";
import { Users, UserPlus, PlayCircle, GraduationCap, Award, Inbox, Coins, HardDrive, ThumbsDown, AlertTriangle, FileWarning, ArrowRightLeft } from "lucide-react";
import { buildDigest } from "@/lib/digest/build";
import { formatUsd } from "@/lib/ai/pricing";

export const metadata: Metadata = {
  title: "Дайджест",
  robots: { index: false },
};

export const dynamic = "force-dynamic";

function humanBytes(n: number | null): string {
  if (n == null) return "—";
  const u = ["Б", "КБ", "МБ", "ГБ", "ТБ"];
  let v = n;
  let i = 0;
  while (v >= 1024 && i < u.length - 1) { v /= 1024; i++; }
  return `${v.toFixed(i === 0 ? 0 : 1)} ${u[i]}`;
}

export default async function DigestPage() {
  const d = await buildDigest(7);

  const groups = [
    {
      title: "Ученики и продажи",
      cards: [
        { icon: UserPlus, label: "Новых учеников", value: d.newStudents, sub: "за 7 дней" },
        { icon: PlayCircle, label: "Активных учеников", value: d.activeStudents, sub: "учились на неделе" },
        { icon: Users, label: "Выдано доступов", value: d.enrollmentsGranted, sub: "за 7 дней" },
        { icon: Inbox, label: "Новых заявок", value: d.newLeads, sub: "ожидают" },
      ],
    },
    {
      title: "Прогресс обучения",
      cards: [
        { icon: PlayCircle, label: "Уроков пройдено", value: d.lessonsCompleted, sub: "за 7 дней" },
        { icon: GraduationCap, label: "Тестов сдано", value: d.quizzesPassed, sub: "за 7 дней" },
        { icon: Award, label: "Сертификатов", value: d.certificatesIssued, sub: "выдано" },
      ],
    },
    {
      title: "Ресурсы и контроль",
      cards: [
        { icon: Coins, label: "Расход LLM", value: formatUsd(Math.round(d.llmCostUsd * 1_000_000)), sub: "за 7 дней" },
        { icon: HardDrive, label: "Размер БД", value: humanBytes(d.dbBytes), sub: "текущий" },
        { icon: ThumbsDown, label: "Дизлайков контента", value: d.thumbsDown, sub: "всего" },
        { icon: AlertTriangle, label: "FAILED-контент", value: d.failedContent, sub: "не прошёл критика" },
      ],
    },
    {
      title: "SEO",
      cards: [
        { icon: FileWarning, label: "Битых адресов (404)", value: d.notFoundTotal, sub: "за 7 дней" },
        { icon: ArrowRightLeft, label: "Срабатываний редиректов", value: d.redirectHits, sub: "всего" },
      ],
    },
  ];

  return (
    <main>
      <h1 className="text-2xl font-bold">Еженедельный дайджест</h1>
      <p className="mt-1 text-foreground/60">
        Сводка за последние 7 дней. Платформа работает на автопилоте — заходите по событию.
      </p>

      <div className="mt-8 space-y-8">
        {groups.map((g) => (
          <section key={g.title}>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-foreground/50">{g.title}</h2>
            <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {g.cards.map((c) => (
                <div key={c.label} className="rounded-2xl border border-foreground/10 bg-background p-5">
                  <c.icon className="size-5 text-amber-600" />
                  <p className="mt-3 text-2xl font-bold">{c.value}</p>
                  <p className="text-sm text-foreground/60">{c.label}</p>
                  <p className="mt-0.5 text-xs text-foreground/40">{c.sub}</p>
                </div>
              ))}
            </div>
          </section>
        ))}

        {/* Топ битых адресов недели — с быстрым переходом к созданию редиректа */}
        {d.notFoundTop.length > 0 ? (
          <section>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-foreground/50">
              Топ 404 за неделю
            </h2>
            <div className="mt-3 overflow-hidden rounded-2xl border border-foreground/10">
              <table className="w-full text-sm">
                <tbody className="divide-y divide-foreground/5">
                  {d.notFoundTop.map((n) => (
                    <tr key={n.path}>
                      <td className="px-4 py-2.5 font-mono text-xs">{n.path}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-foreground/60">
                        {n.hits}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="border-t border-foreground/5 px-4 py-2 text-xs text-foreground/40">
                Создать редиректы можно в{" "}
                <Link href="/admin/seo/redirects" className="text-amber-700 hover:underline">
                  менеджере редиректов
                </Link>
                .
              </p>
            </div>
          </section>
        ) : null}
      </div>
    </main>
  );
}
