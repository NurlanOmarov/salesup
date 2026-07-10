/**
 * Инлайн-скрипт темы: ставит класс .dark/.light на <html> ДО первой отрисовки,
 * чтобы не было вспышки светлой темы (FOUC). Источник: localStorage('theme') =
 * 'dark' | 'light' | 'system' (по умолчанию system → следуем настройке ОС).
 * Парный переключатель — components/theme-toggle.tsx.
 */
const SCRIPT = `
(function () {
  try {
    var t = localStorage.getItem('theme');
    var dark = t === 'dark' || ((!t || t === 'system') && window.matchMedia('(prefers-color-scheme: dark)').matches);
    var c = document.documentElement.classList;
    c.toggle('dark', dark);
    c.toggle('light', !dark);
  } catch (e) {}
})();
`;

export function ThemeScript() {
  return <script dangerouslySetInnerHTML={{ __html: SCRIPT }} />;
}
