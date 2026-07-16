import ReactMarkdown from "react-markdown";

/**
 * Markdown-рендер текста статических страниц (/offer, /privacy) с типографикой
 * лендинга. Текст пишется владельцем в /admin/seo (или AI-черновиком) — это
 * доверенный контент, не пользовательский ввод.
 */
export function StaticPageBody({ text }: { text: string }) {
  return (
    <div className="mt-6">
      <ReactMarkdown
        components={{
          h2: ({ children }) => (
            <h2 className="mt-8 text-xl font-bold first:mt-0">{children}</h2>
          ),
          h3: ({ children }) => <h3 className="mt-5 font-semibold">{children}</h3>,
          p: ({ children }) => <p className="mt-3 text-foreground/80">{children}</p>,
          ul: ({ children }) => (
            <ul className="mt-3 list-disc space-y-1.5 pl-5 text-foreground/80">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-foreground/80">{children}</ol>
          ),
          li: ({ children }) => <li>{children}</li>,
          strong: ({ children }) => (
            <strong className="font-semibold text-foreground">{children}</strong>
          ),
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}
