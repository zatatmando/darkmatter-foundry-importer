import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { extractPdfFields } from "../src/parser/pdf-reader.js";

const fixture = process.env.DMFI_TEST_PDF;

describe.skipIf(!fixture)("extractPdfFields", () => {
  it("extracts Theron's AcroForm fields", async () => {
    const data = new Uint8Array(await readFile(fixture!));
    const fields = await extractPdfFields(data);

    expect(fields["Character Name 1"]).toBe("Theron");
    expect(fields["Class 1"]).toBe("Vagabond");
    expect(fields["Species 1"]).toBe("Star Gnome");
    expect(fields["Hit Points 1"]).toBe("36");
    expect(fields["GP 13"]).toBe("4100");
  });
});
