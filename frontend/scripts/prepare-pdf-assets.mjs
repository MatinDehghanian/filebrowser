import { cp, mkdir } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
const require = createRequire(import.meta.url);
const source = path.dirname(require.resolve("pdfjs-dist/package.json"));
const target = fileURLToPath(new URL("../public/pdfjs/", import.meta.url));
await mkdir(target, { recursive: true });
for (const directory of ["cmaps", "standard_fonts", "wasm"]) {
  await cp(path.join(source, directory), path.join(target, directory), {
    recursive: true,
  });
}
