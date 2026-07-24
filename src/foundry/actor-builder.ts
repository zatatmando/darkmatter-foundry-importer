import type { CharacterModel } from "../model/character.js";

export const MODULE_ID = "darkmatter-foundry-importer";

type AbilityKey = keyof CharacterModel["abilities"];

export interface FoundryItemSource {
  name: string;
  type: string;
  system?: Record<string, unknown>;
  flags: {
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
  };
}

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
      race: string;
      background: string;
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
  system: Record<string, unknown> = {}
): FoundryItemSource | null {
  const trimmedName = name.trim();
  if (!trimmedName) return null;

  return {
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

export function buildActorData(character: CharacterModel): FoundryActorSource {
  const items = compactItems([
    itemSource(character.className, "class", "class", { levels: character.level }),
    itemSource(character.subclass, "subclass", "subclass"),
    itemSource(character.species, "race", "species"),
    itemSource(character.background, "background", "background"),
    ...character.features.map((feature) =>
      itemSource(feature.name, "feat", "feature", {
        description: {
          value: feature.description
        }
      })
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

  return {
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
        race: character.species,
        background: character.background
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
  };
}
