import type { CharacterModel } from "../model/character.js";

export const MODULE_ID = "darkmatter-foundry-importer";

type AbilityKey = keyof CharacterModel["abilities"];

export interface FoundryItemSource {
  _id?: string;
  name: string;
  type: string;
  system?: Record<string, unknown>;
  flags: {
    dnd5e?: Record<string, unknown>;
    [MODULE_ID]: {
      imported: true;
      category:
        | "class"
        | "subclass"
        | "species"
        | "background"
        | "feature"
        | "inventory"
        | "spell";
      resolved?: boolean;
      resolver?: "fallback" | "world" | "compendium";
      pack?: string;
      documentId?: string;
    };
    [key: string]: unknown;
  };
}

type CharacterClassEntry = CharacterModel["classes"][number];

export interface FoundryActorSource {
  name: string;
  type: "character";
  system: {
    abilities: Record<AbilityKey, { value: number; proficient: 0 }>;
    attributes: {
      hp: CharacterModel["hp"];
      ac: { calc: "flat"; flat: number };
      movement: { walk: number; units: "ft" };
      prof: number;
    };
    details: {
      level: number;
      race: string | null;
      background: string | null;
      originalClass: string | null;
    };
    currency: {
      pp: 0;
      gp: number;
      ep: 0;
      sp: 0;
      cp: 0;
    };
  };
  items: FoundryItemSource[];
  flags: {
    [MODULE_ID]: {
      imported: true;
      importerVersion: 1;
      source: {
        className: string;
        classes: CharacterModel["classes"];
        subclass: string;
        species: string;
        background: string;
        credits: number;
        features: CharacterModel["features"];
        inventory: CharacterModel["inventory"];
        spells: string[];
      };
    };
  };
}

function abilityEntries(abilities: CharacterModel["abilities"]): FoundryActorSource["system"]["abilities"] {
  return Object.fromEntries(
    Object.entries(abilities).map(([key, value]) => [key, { value, proficient: 0 }])
  ) as FoundryActorSource["system"]["abilities"];
}

function itemSource(
  name: string,
  type: string,
  category: FoundryItemSource["flags"][typeof MODULE_ID]["category"],
  system: Record<string, unknown> = {},
  id?: string
): FoundryItemSource | null {
  const trimmedName = name.trim();
  if (!trimmedName) return null;

  return {
    ...(id ? { _id: id } : {}),
    name: trimmedName,
    type,
    system,
    flags: {
      [MODULE_ID]: {
        imported: true,
        category
      }
    }
  };
}

function compactItems(items: Array<FoundryItemSource | null>): FoundryItemSource[] {
  return items.filter((item): item is FoundryItemSource => item !== null);
}

function stableItemId(category: string, name: string): string {
  const input = `${category}:${name}`;
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let hash = 0x811c9dc5;
  let id = "";

  for (let index = 0; index < 16; index++) {
    const charCode = input.charCodeAt(index % input.length) + index;
    hash ^= charCode;
    hash = Math.imul(hash, 0x01000193);
    id += alphabet[(hash >>> 0) % alphabet.length];
  }

  return id;
}

function identifierFromName(name: string): string {
  const identifier = name
    .normalize("NFKD")
    .replace(/[’‘]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  if (identifier === "vagabond") return "vagabonds";
  return identifier;
}

function itemId(item: FoundryItemSource | undefined): string | null {
  return item?._id ?? null;
}

function systemString(item: FoundryItemSource | undefined, key: string): string {
  const value = item?.system?.[key];
  return typeof value === "string" ? value : "";
}

function classIdentifier(item: FoundryItemSource | undefined): string {
  return systemString(item, "identifier") || identifierFromName(item?.name ?? "");
}

function numericSystemValue(item: FoundryItemSource | undefined, key: string): number {
  const value = item?.system?.[key];
  return typeof value === "number" ? value : 0;
}

function classEntries(character: CharacterModel): CharacterClassEntry[] {
  if (character.classes.length > 0) return character.classes;

  return character.className
    ? [{ name: character.className, level: character.level }]
    : [];
}

function subclassClassHint(subclass: string): string {
  const name = identifierFromName(subclass);
  const hints: Record<string, string> = {
    "experiment-x": "vagabonds",
    futurist: "gadgeteer",
    lasterist: "gunslinger",
    laserist: "gunslinger",
    mastermaker: "gadgeteer",
    "master-maker": "gadgeteer",
    "oath-of-the-gamma-knight": "paladin",
    "red-magic": "witch",
    "warrior-of-gravity": "monk"
  };

  if (name.startsWith("oath-of-")) return "paladin";
  return hints[name] ?? "";
}

function classIdentifierForSubclass(
  subclass: string,
  entries: CharacterClassEntry[]
): string {
  const hintedIdentifier = subclassClassHint(subclass);
  if (hintedIdentifier && entries.some((entry) => identifierFromName(entry.name) === hintedIdentifier)) {
    return hintedIdentifier;
  }

  const highestLevelClass = [...entries].sort((a, b) => b.level - a.level)[0];
  return identifierFromName(highestLevelClass?.name ?? "");
}

function classItemForSubclass(
  classItems: FoundryItemSource[],
  subclass: FoundryItemSource | undefined
): FoundryItemSource | undefined {
  const subclassClassIdentifier = systemString(subclass, "classIdentifier");
  if (subclassClassIdentifier) {
    const matchingClass = classItems.find((item) => classIdentifier(item) === subclassClassIdentifier);
    if (matchingClass) return matchingClass;
  }

  return [...classItems].sort(
    (left, right) => numericSystemValue(right, "levels") - numericSystemValue(left, "levels")
  )[0];
}

function featureType(item: FoundryItemSource): { value: string; subtype: string } {
  const type = item.system?.type;
  if (!type || typeof type !== "object") return { value: "", subtype: "" };

  const record = type as Record<string, unknown>;
  return {
    value: typeof record.value === "string" ? record.value : "",
    subtype: typeof record.subtype === "string" ? record.subtype : ""
  };
}

function featureAdvancementRoot(
  item: FoundryItemSource,
  roots: {
    classId: string | null;
    speciesId: string | null;
    backgroundId: string | null;
  }
): string | null {
  if (item.flags[MODULE_ID].category !== "feature") return null;

  const type = featureType(item);
  if (type.value === "race" || type.subtype === "species") return roots.speciesId;
  if (type.value === "background" || type.subtype === "origin") return roots.backgroundId;
  if (type.value === "" || type.value === "class") return roots.classId;

  return null;
}

function withAdvancementRoot(item: FoundryItemSource, rootId: string | null): FoundryItemSource {
  if (!rootId) return item;

  return {
    ...item,
    flags: {
      ...item.flags,
      dnd5e: {
        ...(item.flags.dnd5e ?? {}),
        advancementRoot: rootId
      }
    }
  };
}

export function linkActorOriginItems(actorData: FoundryActorSource): FoundryActorSource {
  const species = actorData.items.find(
    (item) => item.flags[MODULE_ID].category === "species"
  );
  const background = actorData.items.find(
    (item) => item.flags[MODULE_ID].category === "background"
  );
  const classItem = actorData.items.find(
    (item) => item.flags[MODULE_ID].category === "class"
  );
  const classItems = actorData.items.filter(
    (item) => item.flags[MODULE_ID].category === "class"
  );
  const subclass = actorData.items.find(
    (item) => item.flags[MODULE_ID].category === "subclass"
  );
  const subclassClassItem = classItemForSubclass(classItems, subclass);
  const linkedClassIdentifier =
    systemString(subclass, "classIdentifier") || classIdentifier(subclassClassItem);
  const items = actorData.items.map((item) => {
    if (item.flags[MODULE_ID].category === "class") {
      const identifier =
        item === subclassClassItem && linkedClassIdentifier
          ? linkedClassIdentifier
          : classIdentifier(item);

      return {
        ...item,
        system: {
          ...(item.system ?? {}),
          identifier
        }
      };
    }

    if (item === subclass && linkedClassIdentifier && !systemString(item, "classIdentifier")) {
      return {
        ...item,
        system: {
          ...(item.system ?? {}),
          classIdentifier: linkedClassIdentifier
        }
      };
    }

    return item;
  });
  const linkedClass = items.find(
    (item) => item === subclassClassItem || item._id === subclassClassItem?._id
  );
  const originalClass = items.find(
    (item) => item.flags[MODULE_ID].category === "class"
  );
  const linkedSpecies = items.find(
    (item) => item.flags[MODULE_ID].category === "species"
  );
  const linkedBackground = items.find(
    (item) => item.flags[MODULE_ID].category === "background"
  );
  const classId = itemId(linkedClass);
  const originalClassId = itemId(originalClass);
  const speciesId = itemId(linkedSpecies);
  const backgroundId = itemId(linkedBackground);
  const linkedItems = items.map((item) =>
    withAdvancementRoot(
      item,
      featureAdvancementRoot(item, {
        classId: classId ?? originalClassId,
        speciesId,
        backgroundId
      })
    )
  );

  return {
    ...actorData,
    items: linkedItems,
    system: {
      ...actorData.system,
      details: {
        ...actorData.system.details,
        race: speciesId ?? actorData.system.details.race,
        background: backgroundId ?? actorData.system.details.background,
        originalClass: originalClassId ?? actorData.system.details.originalClass
      }
    }
  };
}

function featureSystem(description: string): Record<string, unknown> {
  return {
    description: {
      value: description
    },
    type: {
      value: "class",
      subtype: ""
    },
    properties: ["trait"],
    activities: {}
  };
}

export function buildActorData(character: CharacterModel): FoundryActorSource {
  const classes = classEntries(character);
  const originalClassId = classes[0] ? stableItemId("class", classes[0].name) : null;
  const subclassClassIdentifier = classIdentifierForSubclass(character.subclass, classes);
  const items = compactItems([
    ...classes.map((entry) =>
      itemSource(
        entry.name,
        "class",
        "class",
        {
          levels: entry.level,
          identifier: identifierFromName(entry.name)
        },
        stableItemId("class", entry.name)
      )
    ),
    itemSource(
      character.subclass,
      "subclass",
      "subclass",
      {
        classIdentifier: subclassClassIdentifier
      },
      stableItemId("subclass", character.subclass)
    ),
    itemSource(
      character.species,
      "race",
      "species",
      {},
      stableItemId("species", character.species)
    ),
    itemSource(
      character.background,
      "background",
      "background",
      {},
      stableItemId("background", character.background)
    ),
    ...character.features.map((feature) =>
      itemSource(
        feature.name,
        "feat",
        "feature",
        featureSystem(feature.description),
        stableItemId("feature", feature.name)
      )
    ),
    ...character.inventory.map((inventory) =>
      itemSource(inventory.name, "loot", "inventory", {
        description: {
          value: inventory.description
        }
      })
    ),
    ...character.spells.map((spell) => itemSource(spell, "spell", "spell"))
  ]);

  return linkActorOriginItems({
    name: character.name,
    type: "character",
    system: {
      abilities: abilityEntries(character.abilities),
      attributes: {
        hp: character.hp,
        ac: { flat: character.ac, calc: "flat" },
        movement: { walk: character.speed, units: "ft" },
        prof: character.proficiencyBonus
      },
      details: {
        level: character.level,
        race: character.species || null,
        background: character.background || null,
        originalClass: originalClassId
      },
      currency: { pp: 0, gp: character.credits, ep: 0, sp: 0, cp: 0 }
    },
    items,
    flags: {
      [MODULE_ID]: {
        imported: true,
        importerVersion: 1,
        source: {
          className: character.className,
          classes: character.classes,
          subclass: character.subclass,
          species: character.species,
          background: character.background,
          credits: character.credits,
          features: character.features,
          inventory: character.inventory,
          spells: character.spells
        }
      }
    }
  });
}
