import type { CharacterModel } from "../model/character.js";
import { parseCharacterPdf } from "../parser/parse-character.js";
import { buildActorData, type FoundryActorSource } from "./actor-builder.js";

type FoundryActorApi = {
  create(source: FoundryActorSource): Promise<unknown>;
};

export type CharacterPdfParser = (data: Uint8Array) => Promise<CharacterModel>;
export type ActorCreator = (source: FoundryActorSource) => Promise<unknown>;

export interface ImportCharacterPdfOptions {
  parse?: CharacterPdfParser;
  createActor?: ActorCreator;
}

export interface ImportCharacterPdfResult {
  character: CharacterModel;
  actorData: FoundryActorSource;
  actor: unknown;
}

function defaultActorCreator(): ActorCreator {
  const actorApi = (globalThis as typeof globalThis & { Actor?: FoundryActorApi }).Actor;
  if (!actorApi) {
    throw new Error("Foundry Actor API is not available.");
  }

  return (source) => actorApi.create(source);
}

export async function importCharacterPdf(
  data: Uint8Array,
  options: ImportCharacterPdfOptions = {}
): Promise<ImportCharacterPdfResult> {
  const parse = options.parse ?? parseCharacterPdf;
  const createActor = options.createActor ?? defaultActorCreator();
  const character = await parse(data);
  const actorData = buildActorData(character);
  const actor = await createActor(actorData);

  return {
    character,
    actorData,
    actor
  };
}

export async function importCharacterPdfFile(
  file: File,
  options: ImportCharacterPdfOptions = {}
): Promise<ImportCharacterPdfResult> {
  const data = new Uint8Array(await file.arrayBuffer());
  return importCharacterPdf(data, options);
}
