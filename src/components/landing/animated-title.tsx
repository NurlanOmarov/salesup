/**
 * Пословное появление заголовка hero (стиль премиальных продуктовых сайтов).
 * Чистый CSS: текст рендерится на сервере и рисуется сразу (быстрый LCP),
 * анимируется только transform (без задержки opacity). prefers-reduced-motion
 * отключает анимацию через globals.css (.hero-word).
 */
export function AnimatedTitle({
  text,
  className,
}: {
  text: string;
  className?: string;
}) {
  const words = text.split(" ");
  return (
    <h1 className={className}>
      {words.map((w, i) => (
        <span key={i}>
          <span
            className="hero-word"
            style={{ animationDelay: `${0.12 + i * 0.06}s` }}
          >
            {w}
          </span>
          {i < words.length - 1 ? " " : null}
        </span>
      ))}
    </h1>
  );
}
