import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

export type PdfFields = Record<string, string>;

function normalizeValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (Array.isArray(value)) return value.map(normalizeValue).join(", ");
  return String(value);
}

export async function extractPdfFields(data: Uint8Array): Promise<PdfFields> {
  const pdf = await getDocument({ data }).promise;
  const fields: PdfFields = {};

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
    const page = await pdf.getPage(pageNumber);
    const annotations = await page.getAnnotations({ intent: "display" });

    for (const annotation of annotations) {
      if (annotation.subtype !== "Widget" || !annotation.fieldName) continue;

      const value =
        annotation.fieldValue ??
        annotation.buttonValue ??
        annotation.exportValue ??
        "";

      fields[annotation.fieldName] = normalizeValue(value);
    }
  }

  return fields;
}
