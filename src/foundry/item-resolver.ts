import {
  MODULE_ID,
  type FoundryActorSource,
  type FoundryItemSource
} from "./actor-builder.js";

type ItemCategory = FoundryItemSource["flags"][typeof MODULE_ID]["category"];

type ItemIndexEntry = {
  _id?: string;
  id?: string;
  name?: string;
  type?: string;
};

type FoundryItemDocument = {
  id?: string;
  name?: string;
  type?: string;
  toObject?: () => Record<string, unknown>;
  toJSON?: () => Record<string, unknown>;
};

type FoundryPack = {
  collection?: string;
  documentName?: string;
  metadata?: {
    id?: string;
    label?: string;
    packageName?: string;
    type?: string;
  };
  getIndex?: (options?: { fields?: string[] }) => Promise<Iterable<ItemIndexEntry>>;
  index?: Iterable<ItemIndexEntry>;
  getDocument?: (id: string) => Promise<FoundryItemDocument | null>;
};

type FoundryWorldItems = {
  getName?: (name: string) => FoundryItemDocument | undefined;
  values?: () => IterableIterator<FoundryItemDocument>;
};

type FoundryGameApi = {
  items?: FoundryWorldItems;
  packs?: Iterable<FoundryPack>;
};

export type ItemResolver = (item: FoundryItemSource) => Promise<FoundryItemSource | null>;

function lookupName(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[’‘]/g, "'")
    .toLowerCase()
    .replace(/[^a-z0-9+]+/g, " ")
    .trim();
}

function packText(pack: FoundryPack): string {
  return [
    pack.collection,
    pack.documentName,
    pack.metadata?.id,
    pack.metadata?.label,
    pack.metadata?.packageName,
    pack.metadata?.type
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function isItemPack(pack: FoundryPack): boolean {
  const documentName = pack.documentName?.toLowerCase();
  const type = pack.metadata?.type?.toLowerCase();
  return documentName === "item" || type === "item";
}

function isDarkMatterPack(pack: FoundryPack): boolean {
  const text = packText(pack);
  return (
    text.includes("dark matter") ||
    text.includes("dark-matter") ||
    text.includes("darkmatter") ||
    text.includes("mage-hand-press") ||
    text.includes("mage hand press")
  );
}

function categoryMatchesType(category: ItemCategory, type?: string): boolean {
  if (!type) return false;
  if (category === "species") return type === "race";
  if (category === "background") return type === "background";
  if (category === "inventory") return ["equipment", "loot", "weapon", "consumable", "tool"].includes(type);
  if (category === "feature") return ["feat", "equipment", "loot", "weapon", "consumable"].includes(type);

  return category === type;
}

function sourceFromDocument(
  document: FoundryItemDocument,
  fallback: FoundryItemSource,
  resolver: "world" | "compendium",
  pack?: FoundryPack,
  documentId?: string
): FoundryItemSource | null {
  const source = (document.toObject?.() ?? document.toJSON?.() ?? document) as Record<string, unknown>;
  const name = typeof source.name === "string" ? source.name : document.name;
  const type = typeof source.type === "string" ? source.type : document.type;
  if (!name || !type) return null;

  return {
    ...source,
    name,
    type,
    flags: {
      ...((source.flags as Record<string, unknown> | undefined) ?? {}),
      [MODULE_ID]: {
        ...fallback.flags[MODULE_ID],
        resolved: true,
        resolver,
        pack: pack?.collection,
        documentId: documentId ?? document.id
      }
    }
  } as FoundryItemSource;
}

async function resolveWorldItem(item: FoundryItemSource, game: FoundryGameApi): Promise<FoundryItemSource | null> {
  const exactMatch = game.items?.getName?.(item.name);
  if (exactMatch) return sourceFromDocument(exactMatch, item, "world");

  const normalizedName = lookupName(item.name);
  for (const document of game.items?.values?.() ?? []) {
    if (document.name && lookupName(document.name) === normalizedName) {
      return sourceFromDocument(document, item, "world");
    }
  }

  return null;
}

async function resolvePackItem(item: FoundryItemSource, pack: FoundryPack): Promise<FoundryItemSource | null> {
  if (!isItemPack(pack) || !pack.getDocument) return null;

  const index = pack.getIndex
    ? await pack.getIndex({ fields: ["name", "type"] })
    : pack.index;
  const normalizedName = lookupName(item.name);
  const matches = [...(index ?? [])]
    .filter((entry) => entry.name && lookupName(entry.name) === normalizedName)
    .sort((a, b) => Number(categoryMatchesType(item.flags[MODULE_ID].category, b.type)) - Number(categoryMatchesType(item.flags[MODULE_ID].category, a.type)));
  const match = matches[0];
  const documentId = match?._id ?? match?.id;
  if (!documentId) return null;

  const document = await pack.getDocument(documentId);
  return document ? sourceFromDocument(document, item, "compendium", pack, documentId) : null;
}

export async function defaultDarkMatterItemResolver(item: FoundryItemSource): Promise<FoundryItemSource | null> {
  const game = (globalThis as typeof globalThis & { game?: FoundryGameApi }).game;
  if (!game) return null;

  const worldItem = await resolveWorldItem(item, game);
  if (worldItem) return worldItem;

  const packs = [...(game.packs ?? [])].filter(isItemPack);
  const sortedPacks = [
    ...packs.filter(isDarkMatterPack),
    ...packs.filter((pack) => !isDarkMatterPack(pack))
  ];

  for (const pack of sortedPacks) {
    const resolved = await resolvePackItem(item, pack);
    if (resolved) return resolved;
  }

  return null;
}

export async function resolveActorItems(
  actorData: FoundryActorSource,
  resolver: ItemResolver = defaultDarkMatterItemResolver
): Promise<FoundryActorSource> {
  const items = await Promise.all(
    actorData.items.map(async (item) => {
      const resolved = await resolver(item);
      return resolved ?? {
        ...item,
        flags: {
          ...item.flags,
          [MODULE_ID]: {
            ...item.flags[MODULE_ID],
            resolved: false,
            resolver: "fallback" as const
          }
        }
      };
    })
  );

  return {
    ...actorData,
    items
  };
}
