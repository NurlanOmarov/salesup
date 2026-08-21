/**
 * Сборка XLSX-отчёта организации ПРЯМО В БРАУЗЕРЕ.
 *
 * Почему не на сервере, как экспорт админ-аналитики: имена сотрудников
 * зашифрованы ключом организации, которого у сервера нет и быть не должно
 * (L2, docs/B2B-PLAN.md §5.2). Собирали бы файл на сервере — пришлось бы
 * отправить туда расшифрованные ФИО, то есть выбросить всю схему обезличивания.
 *
 * Поэтому: данные приходят с сервера в кодах, имена расшифровываются в браузере,
 * книга собирается здесь же и сразу отдаётся на скачивание.
 *
 * ExcelJS импортируется динамически (≈900 КБ) — чанк грузится только по клику
 * на «Скачать», а не при открытии страницы.
 */

export interface MemberReportRow {
  login: string;
  /** Уже расшифрованная имя или null, если ключ не введён. */
  label: string | null;
  group: string | null;
  courses: number;
  lessonsDone: number;
  lessonsTotal: number;
  progressPct: number;
  avgScore: number | null;
  certificates: number;
  lastActive: string;
  status: string;
}

export interface CourseReportRow {
  courseTitle: string;
  learners: number;
  completed: number;
  notStarted: number;
  avgProgressPct: number;
  avgScore: number | null;
  certificates: number;
  seatsUsed: number;
  seatsTotal: number;
  expiresAt: string;
}

export interface OrgReportInput {
  orgName: string;
  generatedAt: string;
  /** Были ли имена расшифрованы — от этого зависит колонка «Сотрудник». */
  labelsIncluded: boolean;
  members: MemberReportRow[];
  courses: CourseReportRow[];
}

const HEADER_FILL = "FFF3F4F6";

export async function downloadOrgReportXlsx(input: OrgReportInput): Promise<void> {
  // UMD-сборка: в зависимости от interop бандлера объект приезжает либо как
  // `default`, либо как сам модуль. Проверяем оба варианта, чтобы выгрузка не
  // отвалилась молча в проде.
  const mod = await import("exceljs/dist/exceljs.min.js");
  const ExcelJS = mod.default?.default ?? mod.default ?? mod;
  if (typeof ExcelJS?.Workbook !== "function") {
    throw new Error("Не удалось загрузить генератор Excel — обновите страницу");
  }

  const wb = new ExcelJS.Workbook();
  wb.creator = "ACTIVE SALES";
  wb.created = new Date();

  // ─── Лист «Сотрудники» ───
  const members = wb.addWorksheet("Сотрудники");
  members.columns = [
    { header: "Код", key: "login", width: 16 },
    ...(input.labelsIncluded
      ? [{ header: "Сотрудник", key: "label", width: 30 }]
      : []),
    { header: "Подразделение", key: "group", width: 22 },
    { header: "Курсов", key: "courses", width: 10 },
    { header: "Пройдено уроков", key: "lessons", width: 18 },
    { header: "Прогресс, %", key: "progress", width: 13 },
    { header: "Средний балл, %", key: "score", width: 17 },
    { header: "Сертификатов", key: "certs", width: 14 },
    { header: "Последняя активность", key: "active", width: 22 },
    { header: "Статус", key: "status", width: 14 },
  ];

  members.spliceRows(
    1,
    0,
    [`Отчёт по обучению — ${input.orgName}`],
    [`Сформирован: ${input.generatedAt}`],
    [],
  );
  members.getRow(1).font = { bold: true, size: 14 };
  members.getRow(2).font = { color: { argb: "FF6B7280" } };
  styleHeader(members.getRow(4));

  for (const m of input.members) {
    members.addRow({
      login: m.login,
      ...(input.labelsIncluded ? { label: m.label ?? "" } : {}),
      group: m.group ?? "",
      courses: m.courses,
      lessons: `${m.lessonsDone} из ${m.lessonsTotal}`,
      progress: m.progressPct,
      score: m.avgScore ?? "",
      certs: m.certificates,
      active: m.lastActive,
      status: m.status,
    });
  }
  members.autoFilter = {
    from: { row: 4, column: 1 },
    to: { row: 4, column: members.columns.length },
  };
  members.views = [{ state: "frozen", ySplit: 4 }];

  // ─── Лист «По курсам» ───
  const courses = wb.addWorksheet("По курсам");
  courses.columns = [
    { header: "Курс", key: "title", width: 42 },
    { header: "Учатся", key: "learners", width: 11 },
    { header: "Прошли полностью", key: "completed", width: 19 },
    { header: "Не начинали", key: "notStarted", width: 14 },
    { header: "Средний прогресс, %", key: "progress", width: 21 },
    { header: "Средний балл, %", key: "score", width: 17 },
    { header: "Сертификатов", key: "certs", width: 14 },
    { header: "Мест занято", key: "seats", width: 14 },
    { header: "Доступ до", key: "expires", width: 14 },
  ];
  styleHeader(courses.getRow(1));

  for (const c of input.courses) {
    courses.addRow({
      title: c.courseTitle,
      learners: c.learners,
      completed: c.completed,
      notStarted: c.notStarted,
      progress: c.avgProgressPct,
      score: c.avgScore ?? "",
      certs: c.certificates,
      seats: `${c.seatsUsed} из ${c.seatsTotal}`,
      expires: c.expiresAt,
    });
  }
  courses.views = [{ state: "frozen", ySplit: 1 }];

  // ─── Примечание о приватности ───
  const note = wb.addWorksheet("О данных");
  note.columns = [{ header: "", key: "text", width: 110 }];
  const lines = input.labelsIncluded
    ? [
        "Подписи сотрудников расшифрованы в вашем браузере и добавлены в этот файл.",
        "На платформе они хранятся только в зашифрованном виде — прочитать их можем только вы.",
      ]
    : [
        "Подписи сотрудников не включены: ПИН-код не вводилась.",
        "Сотрудники указаны условными обозначениями — соответствие людям ведёте вы.",
      ];
  for (const line of [
    ...lines,
    "",
    "Файл содержит сведения о ходе обучения. Храните его по правилам вашей организации.",
    `Организация: ${input.orgName}. Сформирован: ${input.generatedAt}.`,
  ]) {
    note.addRow({ text: line });
  }

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  triggerDownload(blob, buildFileName(input));
}

/** `Отчёт_Ромашка_2026-08-14.xlsx` — имя, по которому файл найдётся в загрузках. */
export function buildFileName(input: {
  orgName: string;
  generatedAt: string;
}): string {
  const safeOrg = input.orgName
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
  const date = input.generatedAt.slice(0, 10).replace(/\./g, "-");
  return `Обучение_${safeOrg || "организация"}_${date}.xlsx`;
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  // Освобождаем объект после того, как браузер начал скачивание.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

function styleHeader(row: { eachCell: (cb: (cell: HeaderCell) => void) => void }): void {
  row.eachCell((cell) => {
    cell.font = { bold: true };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: HEADER_FILL },
    };
  });
}

interface HeaderCell {
  font: unknown;
  fill: unknown;
}
