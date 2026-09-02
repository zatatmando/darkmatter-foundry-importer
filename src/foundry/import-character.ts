import type { CharacterModel } from "../model/character.js";
import { parseCharacterPdf } from "../parser/parse-character.js";
import { buildActorData, MODULE_ID, type FoundryActorSource, type FoundryItemSource } from "./actor-builder.js";
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

type CreatedItem = {
  id?: string;
  _id?: string;
  name?: string;
  type?: string;
  system?: Record<string, unknown>;
  flags?: Record<string, unknown>;
  getFlag?: (scope: string, key: string) => unknown;
};

type CreatedActor = {
  items?: Iterable<CreatedItem> | {
    values?: () => IterableIterator<CreatedItem>;
    find?: (predicate: (item: CreatedItem) => boolean) => CreatedItem | undefined;
  };
  update?: (data: Record<string, unknown>) => Promise<unknown>;
  updateEmbeddedDocuments?: (
    embeddedName: "Item",
    updates: Array<Record<string, unknown>>
  ) => Promise<unknown>;
};

function defaultActorCreator(): ActorCreator {
  const actorApi = (globalThis as typeof globalThis & { Actor?: FoundryActorApi }).Actor;
  const createActor = actorApi?.implementation?.create ?? actorApi?.create;
  if (!actorApi || !createActor) {
    throw new Error("Foundry Actor API is not available.");
  }

  return (source) => createActor.call(actorApi.implementation ?? actorApi, source);
}

function createdActorItems(actor: CreatedActor): CreatedItem[] {
  const items = actor.items;
  if (!items) return [];
  if (Array.isArray(items)) return items;
  if ("values" in items && typeof items.values === "function") return [...items.values()];
  if (Symbol.iterator in Object(items)) return [...(items as Iterable<CreatedItem>)];

  return [];
}

function createdItemId(item: CreatedItem | undefined): string | null {
  return item?._id ?? item?.id ?? null;
}

function createdItemCategory(item: CreatedItem): string {
  const flagCategory = item.getFlag?.(MODULE_ID, "category");
  if (typeof flagCategory === "string") return flagCategory;

  const moduleFlags = item.flags?.[MODULE_ID];
  if (!moduleFlags || typeof moduleFlags !== "object") return "";

  const category = (moduleFlags as Record<string, unknown>).category;
  return typeof category === "string" ? category : "";
}

function featureType(item: CreatedItem): { value: string; subtype: string } {
  const type = item.system?.type;
  if (!type || typeof type !== "object") return { value: "", subtype: "" };

  const record = type as Record<string, unknown>;
  return {
    value: typeof record.value === "string" ? record.value : "",
    subtype: typeof record.subtype === "string" ? record.subtype : ""
  };
}

function sourceItem(
  actorData: FoundryActorSource,
  item: CreatedItem
): FoundryItemSource | undefined {
  const category = createdItemCategory(item);
  return actorData.items.find(
    (source) => source.flags[MODULE_ID].category === category && source.name === item.name
  );
}

function sourceSystemString(source: FoundryItemSource | undefined, key: string): string {
  const value = source?.system?.[key];
  return typeof value === "string" ? value : "";
}

function sourceSystemNumber(source: FoundryItemSource | undefined, key: string): number | null {
  const value = source?.system?.[key];
  return typeof value === "number" ? value : null;
}

function actualClassForSubclass(
  items: CreatedItem[],
  actorData: FoundryActorSource
): CreatedItem | undefined {
  const subclassSource = actorData.items.find(
    (item) => item.flags[MODULE_ID].category === "subclass"
  );
  const classIdentifier = sourceSystemString(subclassSource, "classIdentifier");
  const desiredClass = actorData.items.find(
    (item) =>
      item.flags[MODULE_ID].category === "class" &&
      sourceSystemString(item, "identifier") === classIdentifier
  );

  if (desiredClass) {
    const actual = items.find(
      (item) => createdItemCategory(item) === "class" && item.name === desiredClass.name
    );
    if (actual) return actual;
  }

  return items.find((item) => createdItemCategory(item) === "class");
}

function advancementRootForFeature(
  item: CreatedItem,
  roots: {
    classId: string | null;
    speciesId: string | null;
    backgroundId: string | null;
  }
): string | null {
  const type = featureType(item);
  if (type.value === "race" || type.subtype === "species") return roots.speciesId;
  if (type.value === "background" || type.subtype === "origin") return roots.backgroundId;

  return roots.classId;
}

export async function finalizeCreatedActor(
  actor: unknown,
  actorData: FoundryActorSource
): Promise<void> {
  const createdActor = actor as CreatedActor;
  if (!createdActor?.update || !createdActor.updateEmbeddedDocuments) return;

  const items = createdActorItems(createdActor);
  if (items.length === 0) return;

  const species = items.find((item) => createdItemCategory(item) === "species");
  const background = items.find((item) => createdItemCategory(item) === "background");
  const originalClass = items.find((item) => createdItemCategory(item) === "class");
  const subclassClass = actualClassForSubclass(items, actorData);
  const classRootId = createdItemId(subclassClass) ?? createdItemId(originalClass);
  const speciesId = createdItemId(species);
  const backgroundId = createdItemId(background);
  const itemUpdates: Array<Record<string, unknown>> = [];

  for (const item of items) {
    const id = createdItemId(item);
    if (!id) continue;

    const category = createdItemCategory(item);
    const source = sourceItem(actorData, item);

    if (category === "class") {
      const levels = sourceSystemNumber(source, "levels");
      const identifier = sourceSystemString(source, "identifier");
      itemUpdates.push({
        _id: id,
        ...(levels ? { "system.levels": levels } : {}),
        ...(identifier ? { "system.identifier": identifier } : {})
      });
    }

    if (category === "subclass") {
      const classIdentifier = sourceSystemString(source, "classIdentifier");
      if (classIdentifier) {
        itemUpdates.push({
          _id: id,
          "system.classIdentifier": classIdentifier
        });
      }
    }

    if (category === "feature" && item.type === "feat") {
      const type = featureType(item);
      itemUpdates.push({
        _id: id,
        "flags.dnd5e.advancementRoot": advancementRootForFeature(item, {
          classId: classRootId,
          speciesId,
          backgroundId
        }),
        ...(!type.value ? { "system.type.value": "class", "system.type.subtype": "" } : {}),
        ...(!item.system?.properties ? { "system.properties": ["trait"] } : {}),
        ...(!item.system?.activities ? { "system.activities": {} } : {})
      });
    }
  }

  if (itemUpdates.length > 0) await createdActor.updateEmbeddedDocuments("Item", itemUpdates);

  await createdActor.update({
    "system.details.race": speciesId,
    "system.details.background": backgroundId,
    "system.details.originalClass": createdItemId(originalClass)
  });
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
  await finalizeCreatedActor(actor, actorData);

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
