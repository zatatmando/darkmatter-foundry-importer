import type { CharacterModel } from "../model/character.js";
import { parseCharacterPdf } from "../parser/parse-character.js";
import { buildActorData, type FoundryActorSource } from "./actor-builder.js";
import { resolveActorItems } from "./item-resolver.js";

type FoundryActorApi = {
  create?: (source: FoundryActorSource) => Promise<unknown>;
  implementation?: {
    create(source: FoundryActorSource): Promise<unknown>;
  };
};

export type CharacterPdfParser = (data: Uint8Array) => Promise<CharacterModel>;
export type ActorCreator = (source: FoundryActorSource) => Promise<unknown>;
export type ActorItemResolver = (source: FoundryActorSource) => Promise<FoundryActorSource>;

export interface ImportCharacterPdfOptions {
  parse?: CharacterPdfParser;
  createActor?: ActorCreator;
  resolveItems?: ActorItemResolver;
}

export interface ImportCharacterPdfResult {
  character: CharacterModel;
  actorData: FoundryActorSource;
  actor: unknown;
}

function defaultActorCreator(): ActorCreator {
  const actorApi = (globalThis as typeof globalThis & { Actor?: FoundryActorApi }).Actor;
  const createActor = actorApi?.implementation?.create ?? actorApi?.create;
  if (!actorApi || !createActor) {
    throw new Error("Foundry Actor API is not available.");
  }

  return (source) => createActor.call(actorApi.implementation ?? actorApi, source);
}

export async function importCharacterPdf(
  data: Uint8Array,
  options: ImportCharacterPdfOptions = {}
): Promise<ImportCharacterPdfResult> {
  const parse = options.parse ?? parseCharacterPdf;
  const createActor = options.createActor ?? defaultActorCreator();
  const resolveItems = options.resolveItems ?? resolveActorItems;
  const character = await parse(data);
  const actorData = await resolveItems(buildActorData(character));
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

export async function importCharacterPdfFiles(
  files: Iterable<File>,
  options: ImportCharacterPdfOptions = {}
): Promise<ImportCharacterPdfResult[]> {
  const results: ImportCharacterPdfResult[] = [];

  for (const file of files) {
    results.push(await importCharacterPdfFile(file, options));
  }

  return results;
}
