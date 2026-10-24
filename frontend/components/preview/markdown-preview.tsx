import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Highlight, themes } from "prism-react-renderer";
import { useTheme } from "@/components/theme-provider";

export default function MarkdownPreview({ content }: { content: string }) {
  const { theme } = useTheme();
  return (
    <article className="markdown-preview mx-auto max-w-4xl px-5 py-6 sm:px-8">
      <Markdown
        remarkPlugins={[remarkGfm]}
        skipHtml
        components={{
          a: ({ children, href }) => (
            <a href={href} target="_blank" rel="noreferrer noopener">
              {children}
            </a>
          ),
          img: ({ alt }) => (
            <span className="inline-flex rounded border px-2 py-1 text-sm text-muted-foreground">
              Image: {alt || "embedded image"} (remote images are not loaded)
            </span>
          ),
          code: ({ children, className }) => {
            const match = /language-([\w-]+)/.exec(className || "");
            if (!match) return <code className={className}>{children}</code>;
            return (
              <Highlight
                theme={theme === "light" ? themes.github : themes.vsDark}
                code={String(children).replace(/\n$/, "")}
                language={match[1]}
              >
                {({ style, tokens, getLineProps, getTokenProps }) => (
                  <code className="block min-w-fit" style={style}>
                    {tokens.map((line, i) => (
                      <span
                        {...getLineProps({ line })}
                        key={i}
                        className="block"
                      >
                        {line.map((token, key) => (
                          <span {...getTokenProps({ token })} key={key} />
                        ))}
                      </span>
                    ))}
                  </code>
                )}
              </Highlight>
            );
          },
        }}
      >
        {content}
      </Markdown>
    </article>
  );
}
