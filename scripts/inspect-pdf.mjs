import { readFile, writeFile } from "node:fs/promises";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

const input = process.argv[2];
if (!input) {
  console.error("Usage: npm run inspect:pdf -- /path/to/character.pdf");
  process.exit(1);
}

const data = new Uint8Array(await readFile(input));
const pdf = await getDocument({ data }).promise;
const fields = {};

for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
  const page = await pdf.getPage(pageNumber);
  const annotations = await page.getAnnotations({ intent: "display" });

  for (const annotation of annotations) {
    if (annotation.subtype !== "Widget" || !annotation.fieldName) continue;
    const value = annotation.fieldValue ?? annotation.buttonValue ?? annotation.exportValue ?? "";
    fields[annotation.fieldName] = Array.isArray(value) ? value.join(", ") : String(value);
  }
}

const output = input.replace(/\.pdf$/i, ".fields.json");
await writeFile(output, JSON.stringify(fields, null, 2), "utf8");
console.log(`Extracted ${Object.keys(fields).length} fields.`);
console.log(`Wrote ${output}`);
