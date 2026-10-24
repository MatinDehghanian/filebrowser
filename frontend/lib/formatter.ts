import type { BuiltInParserName, Plugin } from "prettier";
import { MAX_FORMAT_BYTES } from "@/lib/preview";

export type FormatterOptions = {
  filename: string;
  code: string;
  cursorOffset?: number;
  tabWidth?: number;
  useTabs?: boolean;
  language?: string;
};
const parsers: Record<string, BuiltInParserName> = {
  js: "babel",
  mjs: "babel",
  cjs: "babel",
  jsx: "babel",
  ts: "typescript",
  mts: "typescript",
  cts: "typescript",
  tsx: "typescript",
  json: "json",
  jsonc: "jsonc",
  json5: "json5",
  html: "html",
  htm: "html",
  vue: "vue",
  css: "css",
  scss: "scss",
  less: "less",
  md: "markdown",
  markdown: "markdown",
  mdx: "mdx",
  yaml: "yaml",
  yml: "yaml",
  graphql: "graphql",
  gql: "graphql",
};
const languageParsers: Record<string, BuiltInParserName> = {
  JavaScript: "babel",
  JSX: "babel",
  TypeScript: "typescript",
  TSX: "typescript",
  JSON: "json",
  HTML: "html",
  Vue: "vue",
  CSS: "css",
  SCSS: "scss",
  Less: "less",
  LESS: "less",
  Markdown: "markdown",
  YAML: "yaml",
  GraphQL: "graphql",
};
export function formatterParser(
  filename: string,
  language = "auto",
): BuiltInParserName | undefined {
  if (language !== "auto") return languageParsers[language];
  const name = filename.toLowerCase();
  if ([".prettierrc", ".babelrc", ".eslintrc", ".stylelintrc"].includes(name))
    return "json";
  return parsers[name.split(".").pop() || ""];
}

export async function formatCode(options: FormatterOptions) {
  const parser = formatterParser(options.filename, options.language);
  if (!parser)
    throw new Error(
      "Prettier does not support formatting this language. Syntax highlighting and editing are available.",
    );
  if (new TextEncoder().encode(options.code).byteLength > MAX_FORMAT_BYTES)
    throw new Error(
      "Automatic formatting is limited to 1 MB to keep the editor responsive.",
    );
  const prettier = await import("prettier/standalone");
  const plugins: Plugin[] = [];
  if (
    [
      "babel",
      "typescript",
      "json",
      "jsonc",
      "json5",
      "markdown",
      "mdx",
      "vue",
      "html",
    ].includes(parser)
  ) {
    const [babel, estree, typescript] = await Promise.all([
      import("prettier/plugins/babel"),
      import("prettier/plugins/estree"),
      import("prettier/plugins/typescript"),
    ]);
    plugins.push(babel, estree, typescript);
  }
  if (
    ["html", "vue", "babel", "typescript", "markdown", "mdx"].includes(parser)
  )
    plugins.push(await import("prettier/plugins/html"));
  if (
    ["css", "scss", "less", "html", "vue", "markdown", "mdx"].includes(parser)
  )
    plugins.push(await import("prettier/plugins/postcss"));
  if (["markdown", "mdx"].includes(parser))
    plugins.push(await import("prettier/plugins/markdown"));
  if (["yaml", "markdown", "mdx"].includes(parser))
    plugins.push(await import("prettier/plugins/yaml"));
  if (parser === "graphql")
    plugins.push(await import("prettier/plugins/graphql"));
  const result = await prettier.formatWithCursor(options.code, {
    parser,
    plugins,
    tabWidth: options.tabWidth === 4 ? 4 : 2,
    useTabs: options.useTabs ?? false,
    cursorOffset: Math.max(
      0,
      Math.min(options.cursorOffset ?? 0, options.code.length),
    ),
    printWidth: 100,
    endOfLine: "auto",
    embeddedLanguageFormatting: "auto",
  });
  return { formatted: result.formatted, cursorOffset: result.cursorOffset };
}
