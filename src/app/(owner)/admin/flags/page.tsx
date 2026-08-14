import type { Metadata } from "next";
import Link from "next/link";
import { ShieldAlert, MonitorSmartphone, Globe, Eye } from "lucide-react";
import { getFlaggedStudents } from "@/lib/antishare/devices";
import type { FlagReason } from "@/lib/antishare/heuristics";

export const metadata: Metadata = {
  title: "Подозрительная активность",
  robots: { index: false },
};

export const dynamic = "force-dynamic";

const REASON_LABELS: Record<FlagReason, { label: string; icon: typeof MonitorSmartphone }> = {
  MANY_DEVICES: { label: "Много устройств", icon: MonitorSmartphone },
  MANY_CITIES: { label: "Разные IP/города", icon: Globe },
  ABNORMAL_WATCH: { label: "Аномальный просмотр", icon: Eye },
};

export default async function FlagsPage() {
  const flagged = await getFlaggedStudents();

  return (
    <main>
      <h1 className="text-2xl font-bold">Подозрительная активность</h1>
      <p className="mt-1 text-foreground/60">
        Признаки возможной раздачи аккаунта. Вход не блокируется автоматически —
        решение за вами: заморозить вход или отозвать доступ.
      </p>

      {flagged.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-foreground/10 bg-foreground/[0.02] p-10 text-center">
          <ShieldAlert className="mx-auto size-10 text-foreground/30" />
          <p className="mt-3 font-medium">Подозрительной активности нет</p>
          <p className="mt-1 text-sm text-foreground/60">
            Все ученики в пределах нормы по устройствам и просмотру.
          </p>
        </div>
      ) : (
        <div className="mt-6 space-y-3">
          {flagged.map((s) => (
            <div key={s.userId} className="rounded-2xl border border-amber-600/20 bg-amber-500/[0.04] p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex size-10 items-center justify-center rounded-xl bg-amber-500/15 text-amber-700">
                    <ShieldAlert className="size-5" />
                  </div>
                  <div>
                    <Link href={`/admin/students/${s.userId}`} className="font-semibold text-amber-800 hover:underline">
                      {s.name ?? s.email ?? s.login ?? "Работник организации"}
                    </Link>
                    <p className="text-xs text-foreground/50">
                      {s.activeDevices} устройств · {s.distinctIps} IP за неделю
                      {s.blocked ? " · вход заблокирован" : ""}
                    </p>
                  </div>
                </div>
                <Link
                  href={`/admin/students/${s.userId}`}
                  className="rounded-lg border border-foreground/15 px-3 py-1.5 text-sm font-medium transition-colors hover:bg-foreground/5"
                >
                  Открыть карточку
                </Link>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {s.reasons.map((r) => {
                  const def = REASON_LABELS[r];
                  return (
                    <span key={r} className="inline-flex items-center gap-1.5 rounded-full bg-background px-2.5 py-1 text-xs font-medium text-amber-700">
                      <def.icon className="size-3.5" />
                      {def.label}
                    </span>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
