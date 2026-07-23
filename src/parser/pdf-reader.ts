import { getDocument, GlobalWorkerOptions } from "pdfjs-dist/legacy/build/pdf.mjs";

export type PdfFields = Record<string, string>;

function configurePdfWorker(): void {
  if (typeof window === "undefined") return;
  GlobalWorkerOptions.workerSrc ||= new URL("./pdf.worker.mjs", import.meta.url).href;
}

function normalizeValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (Array.isArray(value)) return value.map(normalizeValue).join(", ");
  return String(value).trim();
}

export async function extractPdfFields(data: Uint8Array): Promise<PdfFields> {
  configurePdfWorker();
  const pdf = await getDocument({ data, useSystemFonts: true }).promise;
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
