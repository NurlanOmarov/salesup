import { db } from "@/lib/db";
import { canAccessLesson } from "@/lib/access";

/**
 * Заметки ученика по таймкоду урока (модель Note). Заметки приватны (только автор),
 * привязаны к уроку и секунде видео — клик по заметке перематывает плеер. Доступ к
 * уроку проверяется через lib/access (нельзя писать/читать заметки по чужому уроку).
 */

export interface NoteView {
  id: string;
  lessonId: string;
  timecodeSec: number;
  text: string;
  createdAt: string;
}

export async function listLessonNotes(userId: string, lessonId: string): Promise<NoteView[]> {
  const notes = await db.note.findMany({
    where: { userId, lessonId },
    orderBy: { timecodeSec: "asc" },
    select: { id: true, lessonId: true, timecodeSec: true, text: true, createdAt: true },
  });
  return notes.map((n) => ({
    id: n.id,
    lessonId: n.lessonId,
    timecodeSec: n.timecodeSec,
    text: n.text,
    createdAt: n.createdAt.toISOString(),
  }));
}

export async function addNote(
  userId: string,
  lessonId: string,
  timecodeSec: number,
  text: string,
): Promise<NoteView> {
  const access = await canAccessLesson(userId, lessonId);
  if (!access.ok) throw new Error("Нет доступа к уроку");

  const note = await db.note.create({
    data: { userId, lessonId, timecodeSec: Math.max(0, Math.floor(timecodeSec)), text: text.trim() },
    select: { id: true, lessonId: true, timecodeSec: true, text: true, createdAt: true },
  });
  return {
    id: note.id,
    lessonId: note.lessonId,
    timecodeSec: note.timecodeSec,
    text: note.text,
    createdAt: note.createdAt.toISOString(),
  };
}

export async function deleteNote(userId: string, noteId: string): Promise<void> {
  // deleteMany с фильтром по userId — нельзя удалить чужую заметку (тихо ноль строк).
  await db.note.deleteMany({ where: { id: noteId, userId } });
}

/** Все заметки ученика, сгруппированные по курсу/уроку — для сводной страницы /app/notes. */
export interface CourseNotes {
  courseSlug: string;
  courseTitle: string;
  lessons: { lessonId: string; lessonTitle: string; notes: NoteView[] }[];
}

export async function listAllNotes(userId: string): Promise<CourseNotes[]> {
  const notes = await db.note.findMany({
    where: { userId },
    orderBy: [{ lessonId: "asc" }, { timecodeSec: "asc" }],
    select: {
      id: true,
      lessonId: true,
      timecodeSec: true,
      text: true,
      createdAt: true,
      lesson: {
        select: {
          title: true,
          module: { select: { sortOrder: true, course: { select: { slug: true, title: true } } } },
        },
      },
    },
  });

  // Группируем: курс → урок → заметки (порядок: курс по названию, заметки по таймкоду).
  const byCourse = new Map<string, CourseNotes>();
  for (const n of notes) {
    const course = n.lesson.module.course;
    let bucket = byCourse.get(course.slug);
    if (!bucket) {
      bucket = { courseSlug: course.slug, courseTitle: course.title, lessons: [] };
      byCourse.set(course.slug, bucket);
    }
    let lessonBucket = bucket.lessons.find((l) => l.lessonId === n.lessonId);
    if (!lessonBucket) {
      lessonBucket = { lessonId: n.lessonId, lessonTitle: n.lesson.title, notes: [] };
      bucket.lessons.push(lessonBucket);
    }
    lessonBucket.notes.push({
      id: n.id,
      lessonId: n.lessonId,
      timecodeSec: n.timecodeSec,
      text: n.text,
      createdAt: n.createdAt.toISOString(),
    });
  }
  return [...byCourse.values()].sort((a, b) => a.courseTitle.localeCompare(b.courseTitle, "ru"));
}
