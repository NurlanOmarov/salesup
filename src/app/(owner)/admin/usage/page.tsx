import type { Metadata } from "next";
import { Coins, TrendingUp, Cpu } from "lucide-react";
import { db } from "@/lib/db";
import { formatUsd } from "@/lib/ai/pricing";

export const metadata: Metadata = {
  title: "Расходы LLM",
  robots: { index: false },
};

export const dynamic = "force-dynamic";

/** Краткая запись токенов: 1234567 → «1.2M», 12345 → «12.3K». */
function fmtTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export default async function UsagePage() {
  const since30 = new Date();
  since30.setDate(since30.getDate() - 30);

  const [total, last30, byUser, byModel] = await Promise.all([
    db.llmUsage.aggregate({
      _sum: { inputTokens: true, outputTokens: true, costMicroUsd: true },
    }),
    db.llmUsage.aggregate({
      where: { createdAt: { gte: since30 } },
      _sum: { costMicroUsd: true },
    }),
    db.llmUsage.groupBy({
      by: ["userId"],
      _sum: { inputTokens: true, outputTokens: true, costMicroUsd: true },
      orderBy: { _sum: { costMicroUsd: "desc" } },
    }),
    db.llmUsage.groupBy({
      by: ["model"],
      _sum: { inputTokens: true, outputTokens: true, costMicroUsd: true },
      orderBy: { _sum: { costMicroUsd: "desc" } },
    }),
  ]);

  const totalIn = total._sum.inputTokens ?? 0;
  const totalOut = total._sum.outputTokens ?? 0;
  const totalCost = total._sum.costMicroUsd ?? 0;
  const last30Cost = last30._sum.costMicroUsd ?? 0;

  // Подтягиваем имена учеников для строк с userId.
  const userIds = byUser.map((u) => u.userId).filter(Boolean) as string[];
  const users = userIds.length
    ? await db.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, name: true, email: true },
      })
    : [];
  const userById = new Map(users.map((u) => [u.id, u]));

  const cards = [
    { icon: Coins, label: "Всего потрачено", value: formatUsd(totalCost), sub: `${fmtTokens(totalIn + totalOut)} токенов` },
    { icon: TrendingUp, label: "За последние 30 дней", value: formatUsd(last30Cost), sub: "по дате вызова" },
    { icon: Cpu, label: "Токены (вход / выход)", value: `${fmtTokens(totalIn)} / ${fmtTokens(totalOut)}`, sub: "за всё время" },
  ];

  const hasData = byUser.length > 0;

  return (
    <main>
      <h1 className="text-2xl font-bold">Расходы на LLM</h1>
      <p className="mt-1 text-foreground/60">
        Учёт токенов и стоимости вызовов Anthropic и Voyage. Стоимость фиксируется
        в момент вызова по действующему тарифу.
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        {cards.map((c) => (
          <div key={c.label} className="rounded-2xl border border-foreground/10 bg-background p-5">
            <c.icon className="size-5 text-amber-600" />
            <p className="mt-3 text-2xl font-bold">{c.value}</p>
            <p className="text-sm text-foreground/60">{c.label}</p>
            <p className="mt-0.5 text-xs text-foreground/40">{c.sub}</p>
          </div>
        ))}
      </div>

      {!hasData ? (
        <div className="mt-8 rounded-2xl border border-foreground/10 bg-foreground/[0.02] p-10 text-center text-foreground/50">
          <Cpu className="mx-auto size-10 opacity-30" />
          <p className="mt-3 font-medium">Расходов пока нет</p>
          <p className="mt-1 text-sm">
            Записи появятся при вызовах LLM: AI-наставник, проверка открытых ответов,
            генерация контента фабрикой.
          </p>
        </div>
      ) : (
        <>
          {/* По ученикам */}
          <section className="mt-8">
            <h2 className="text-lg font-semibold">По ученикам</h2>
            <div className="mt-3 overflow-hidden rounded-xl border border-foreground/10 bg-background">
              <table className="w-full text-sm">
                <thead className="border-b border-foreground/10 bg-foreground/[0.02] text-left text-xs uppercase tracking-wide text-foreground/50">
                  <tr>
                    <th className="px-4 py-3 font-medium">Ученик</th>
                    <th className="px-4 py-3 font-medium text-right">Токены (вход)</th>
                    <th className="px-4 py-3 font-medium text-right">Токены (выход)</th>
                    <th className="px-4 py-3 font-medium text-right">Стоимость</th>
                  </tr>
                </thead>
                <tbody>
                  {byUser.map((row) => {
                    const u = row.userId ? userById.get(row.userId) : null;
                    const label = row.userId
                      ? (u?.name ?? u?.email ?? "Удалённый ученик")
                      : "Система / фабрика";
                    return (
                      <tr key={row.userId ?? "system"} className="border-b border-foreground/5 last:border-0">
                        <td className="px-4 py-3">
                          {row.userId && u ? (
                            <a href={`/admin/students/${u.id}`} className="text-amber-700 hover:underline">
                              {label}
                            </a>
                          ) : (
                            <span className="text-foreground/70">{label}</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right text-foreground/70">{fmtTokens(row._sum.inputTokens ?? 0)}</td>
                        <td className="px-4 py-3 text-right text-foreground/70">{fmtTokens(row._sum.outputTokens ?? 0)}</td>
                        <td className="px-4 py-3 text-right font-medium">{formatUsd(row._sum.costMicroUsd ?? 0)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          {/* По моделям */}
          <section className="mt-8">
            <h2 className="text-lg font-semibold">По моделям</h2>
            <div className="mt-3 overflow-hidden rounded-xl border border-foreground/10 bg-background">
              <table className="w-full text-sm">
                <thead className="border-b border-foreground/10 bg-foreground/[0.02] text-left text-xs uppercase tracking-wide text-foreground/50">
                  <tr>
                    <th className="px-4 py-3 font-medium">Модель</th>
                    <th className="px-4 py-3 font-medium text-right">Токены (вход)</th>
                    <th className="px-4 py-3 font-medium text-right">Токены (выход)</th>
                    <th className="px-4 py-3 font-medium text-right">Стоимость</th>
                  </tr>
                </thead>
                <tbody>
                  {byModel.map((row) => (
                    <tr key={row.model} className="border-b border-foreground/5 last:border-0">
                      <td className="px-4 py-3 font-mono text-xs">{row.model}</td>
                      <td className="px-4 py-3 text-right text-foreground/70">{fmtTokens(row._sum.inputTokens ?? 0)}</td>
                      <td className="px-4 py-3 text-right text-foreground/70">{fmtTokens(row._sum.outputTokens ?? 0)}</td>
                      <td className="px-4 py-3 text-right font-medium">{formatUsd(row._sum.costMicroUsd ?? 0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </main>
  );
}
