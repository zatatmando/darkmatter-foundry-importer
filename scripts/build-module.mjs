import { mkdir, copyFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const distFoundry = path.join(root, "dist", "foundry");
const require = createRequire(import.meta.url);
const pdfjsRoot = path.dirname(require.resolve("pdfjs-dist/package.json"));

await mkdir(distFoundry, { recursive: true });

await build({
  entryPoints: [path.join(root, "src", "foundry", "main.ts")],
  outfile: path.join(distFoundry, "main.js"),
  bundle: true,
  format: "esm",
  platform: "browser",
  target: "es2022",
  sourcemap: true,
  logLevel: "info"
});

await copyFile(
  path.join(pdfjsRoot, "legacy", "build", "pdf.worker.mjs"),
  path.join(distFoundry, "pdf.worker.mjs")
);
