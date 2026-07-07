import { extractPdfFields } from "./pdf-reader.js";
import { normalizeCharacter } from "./normalize.js";
import type { CharacterModel } from "../model/character.js";

export async function parseCharacterPdf(data: Uint8Array): Promise<CharacterModel> {
  const fields = await extractPdfFields(data);
  return normalizeCharacter(fields);
}
