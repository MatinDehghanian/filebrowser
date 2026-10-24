import { test } from "node:test";
import assert from "node:assert/strict";
import {
  previewKind,
  parseDelimited,
  htmlPreviewDocument,
  readPreviewText,
  MAX_TEXT_BYTES,
} from "../lib/preview.ts";
import { formatCode, formatterParser } from "../lib/formatter.ts";
import {
  indentationFor,
  parseEditorPreferences,
} from "../lib/editor-options.ts";
import api from "../lib/api.ts";

const item = (name: string, type = "") => ({ name, type, isDir: false });
test("preview classification handles code, media, documents and binary files", () => {
  for (const [name, expected] of [
    ["readme.md", "markdown"],
    ["data.csv", "table"],
    ["data.tsv", "table"],
    ["index.html", "html"],
    ["test.TSX", "code"],
    ["script.py", "code"],
    [".env", "code"],
    ["movie.MP4", "video"],
    ["sound.opus", "audio"],
    ["picture.avif", "image"],
    ["diagram.svg", "image"],
    ["book.pdf", "pdf"],
    ["document.docx", "unsupported"],
    ["archive.zip", "unsupported"],
  ]) {
    assert.equal(previewKind(item(name, "text")), expected, name);
  }
  assert.equal(previewKind(item("unknown", "textImmutable")), "code");
  assert.equal(previewKind(item("unknown", "blob")), "unsupported");
  assert.equal(
    previewKind({ ...item("folder.md"), isDir: true }),
    "unsupported",
  );
});

test("CSV parsing preserves quoted commas, quotes and multiline fields", () => {
  const parsed = parseDelimited(
    'name,note\r\n"سلام, دنیا","line one\nline ""two"""\r\n',
  );
  assert.deepEqual(parsed.rows, [
    ["name", "note"],
    ["سلام, دنیا", 'line one\nline "two"'],
  ]);
  assert.equal(parsed.truncated, false);
  assert.equal(
    parseDelimited('a,b\n"incomplete').error?.includes("incomplete"),
    true,
  );
  assert.deepEqual(parseDelimited("a\tb\n1\t2", "\t").rows, [
    ["a", "b"],
    ["1", "2"],
  ]);
});

test("large tables have predictable row and column limits", () => {
  const rows = parseDelimited("a,b,c\n1,2,3\n4,5,6\n7,8,9", ",", 2, 2);
  assert.deepEqual(rows.rows, [
    ["a", "b"],
    ["1", "2"],
  ]);
  assert.equal(rows.truncated, true);
});

test("HTML preview has a restrictive policy before user markup", () => {
  const html = htmlPreviewDocument("<h1>hello</h1>");
  assert.ok(html.indexOf("Content-Security-Policy") < html.indexOf("<h1>"));
  assert.match(html, /default-src 'none'/);
  assert.match(html, /form-action 'none'/);
  assert.match(html, /base-uri 'none'/);
});

test("bounded text reader supports chunked Unicode without splitting characters", async () => {
  const bytes = new TextEncoder().encode("سلام 🌍");
  const response = new Response(
    new ReadableStream({
      start(controller) {
        controller.enqueue(bytes.slice(0, 3));
        controller.enqueue(bytes.slice(3));
        controller.close();
      },
    }),
  );
  assert.equal(await readPreviewText(response), "سلام 🌍");
  await assert.rejects(
    () => readPreviewText(new Response("error", { status: 403 })),
    /403/,
  );
  await assert.rejects(
    () =>
      readPreviewText(
        new Response("test", {
          headers: { "Content-Length": String(MAX_TEXT_BYTES + 1) },
        }),
      ),
    /10 MB/,
  );
  const oversized = new Response(
    new ReadableStream({
      start(controller) {
        controller.enqueue(new Uint8Array(MAX_TEXT_BYTES + 1));
        controller.close();
      },
    }),
  );
  await assert.rejects(() => readPreviewText(oversized), /10 MB/);
});

test("editor preferences recover from corrupt or invalid stored settings", () => {
  assert.equal(parseEditorPreferences("invalid").fontSize, 14);
  assert.equal(parseEditorPreferences("null").wordWrap, false);
  assert.equal(
    parseEditorPreferences('{"fontSize":500,"indentation":"oops"}').indentation,
    "auto",
  );
  assert.deepEqual(indentationFor("Python", "auto"), {
    tabWidth: 4,
    useTabs: false,
  });
  assert.deepEqual(indentationFor("Go", "auto"), {
    tabWidth: 4,
    useTabs: true,
  });
  assert.deepEqual(indentationFor("JavaScript", "2"), {
    tabWidth: 2,
    useTabs: false,
  });
});

test("formatter selects the right parser without pretending to support every language", () => {
  assert.equal(formatterParser("test.tsx"), "typescript");
  assert.equal(formatterParser(".prettierrc"), "json");
  assert.equal(formatterParser("test.css", "TypeScript"), "typescript");
  assert.equal(formatterParser("script.py"), undefined);
  assert.equal(formatterParser("main.go"), undefined);
  assert.equal(formatterParser("file.js", "Plain text"), undefined);
});

test("Prettier formats JavaScript, TypeScript and JSON with the chosen indentation", async () => {
  assert.equal(
    (await formatCode({ filename: "file.js", code: "const test={a:1,b:2}" }))
      .formatted,
    "const test = { a: 1, b: 2 };\n",
  );
  assert.match(
    (
      await formatCode({
        filename: "file.tsx",
        code: 'const el=<div a="b">Hi</div>',
      })
    ).formatted,
    /const el = <div/,
  );
  const json = await formatCode({
    filename: "file.json",
    code: '{"nested":{"ok":true}}',
    tabWidth: 4,
    cursorOffset: 15,
  });
  assert.match(json.formatted, /"nested"/);
  assert.ok(
    json.cursorOffset >= 0 && json.cursorOffset <= json.formatted.length,
  );
  assert.deepEqual(JSON.parse(json.formatted), { nested: { ok: true } });
});

test("Prettier formats CSS, HTML, Markdown, YAML and GraphQL", async () => {
  for (const [filename, code, pattern] of [
    ["file.css", "a{color:red}", /color: red;/],
    [
      "file.html",
      "<main    class=demo><p>hello</p></main>",
      /<main class="demo">/,
    ],
    ["file.md", "#Title\n\n-   one\n- two", /- one/],
    ["file.yaml", "items: [one,two]", /one, two/],
    ["file.graphql", "query{user{id name}}", /query \{/],
  ] as const)
    assert.match((await formatCode({ filename, code })).formatted, pattern);
});

test("invalid code and oversized formatting preserve the supplied source", async () => {
  const source = "const = {";
  await assert.rejects(() => formatCode({ filename: "file.js", code: source }));
  assert.equal(source, "const = {");
  await assert.rejects(
    () => formatCode({ filename: "file.py", code: "x=1" }),
    /does not support/,
  );
  await assert.rejects(
    () =>
      formatCode({ filename: "file.js", code: " ".repeat(1024 * 1024 + 1) }),
    /1 MB/,
  );
});

test("preview and download URLs do not expose the private session token", () => {
  api.setToken("private-test-token");
  assert.ok(!api.getDownloadUrl("/image.png").includes("private-test-token"));
  assert.ok(!api.getPreviewUrl("/image.png").includes("private-test-token"));
  api.setToken(null);
});
