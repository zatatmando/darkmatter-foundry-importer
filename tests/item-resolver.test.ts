import { describe, expect, it, vi } from "vitest";
import { MODULE_ID, type FoundryActorSource } from "../src/foundry/actor-builder.js";
import {
  defaultDarkMatterItemResolver,
  resolveActorItems
} from "../src/foundry/item-resolver.js";

const actorData: FoundryActorSource = {
  name: "Theron",
  type: "character",
  system: {
    abilities: {
      str: { value: 14, proficient: 0 },
      dex: { value: 15, proficient: 0 },
      con: { value: 16, proficient: 0 },
      int: { value: 11, proficient: 0 },
      wis: { value: 14, proficient: 0 },
      cha: { value: 11, proficient: 0 }
    },
    attributes: {
      hp: { value: 36, max: 36, temp: 0 },
      ac: { calc: "flat", flat: 17 },
      movement: { walk: 30, units: "ft" },
      prof: 3
    },
    details: {
      level: 5,
      race: "Star Gnome",
      background: "Salvager"
    },
    currency: { pp: 0, gp: 4100, ep: 0, sp: 0, cp: 0 }
  },
  items: [
    {
      name: "Rampage",
      type: "feat",
      system: {
        description: {
          value: "Fallback Rampage text from the PDF."
        }
      },
      flags: {
        [MODULE_ID]: {
          imported: true,
          category: "feature"
        }
      }
    }
  ],
  flags: {
    [MODULE_ID]: {
      imported: true,
      importerVersion: 1,
      source: {
        className: "Vagabond",
        subclass: "Experiment X",
        species: "Star Gnome",
        background: "Salvager",
        credits: 4100,
        features: [{ name: "Rampage", description: "Fallback Rampage text from the PDF." }],
        inventory: [],
        spells: []
      }
    }
  }
};

describe("resolveActorItems", () => {
  it("keeps fallback PDF items when no Foundry item is resolved", async () => {
    const resolved = await resolveActorItems(actorData, async () => null);

    expect(resolved.items[0]).toMatchObject({
      name: "Rampage",
      system: {
        description: {
          value: "Fallback Rampage text from the PDF."
        }
      },
      flags: {
        [MODULE_ID]: {
          resolved: false,
          resolver: "fallback"
        }
      }
    });
  });

  it("replaces fallback items with matching Dark Matter compendium items", async () => {
    const gameGlobal = globalThis as typeof globalThis & { game?: unknown };
    const previousGame = gameGlobal.game;
    const getDocument = vi.fn(async () => ({
      id: "abc123",
      name: "Rampage",
      type: "feat",
      toObject: () => ({
        name: "Rampage",
        type: "feat",
        system: {
          description: {
            value: "Resolved Rampage text from the Dark Matter pack."
          }
        },
        flags: {
          existing: true
        }
      })
    }));

    gameGlobal.game = {
      packs: [
        {
          collection: "mage-hand-press-dark-matter.features",
          documentName: "Item",
          metadata: {
            packageName: "mage-hand-press-dark-matter",
            type: "Item"
          },
          getIndex: vi.fn(async () => [{ _id: "abc123", name: "Rampage", type: "feat" }]),
          getDocument
        }
      ]
    };

    try {
      const resolved = await defaultDarkMatterItemResolver(actorData.items[0]);

      expect(getDocument).toHaveBeenCalledWith("abc123");
      expect(resolved).toMatchObject({
        name: "Rampage",
        system: {
          description: {
            value: "Resolved Rampage text from the Dark Matter pack."
          }
        },
        flags: {
          [MODULE_ID]: {
            resolved: true,
            resolver: "compendium",
            pack: "mage-hand-press-dark-matter.features",
            documentId: "abc123"
          }
        }
      });
    } finally {
      gameGlobal.game = previousGame;
    }
  });

  it("matches imported species to race items", async () => {
    const raceItem: FoundryActorSource["items"][number] = {
      name: "Vect",
      type: "race",
      flags: {
        [MODULE_ID]: {
          imported: true,
          category: "species"
        }
      }
    };
    const getDocument = vi.fn(async () => ({
      id: "race123",
      name: "Vect",
      type: "race",
      toObject: () => ({
        name: "Vect",
        type: "race"
      })
    }));
    const gameGlobal = globalThis as typeof globalThis & { game?: unknown };
    const previousGame = gameGlobal.game;

    gameGlobal.game = {
      packs: [
        {
          collection: "mage-hand-press-dark-matter.species",
          documentName: "Item",
          metadata: {
            packageName: "mage-hand-press-dark-matter",
            type: "Item"
          },
          getIndex: vi.fn(async () => [{ _id: "race123", name: "Vect", type: "race" }]),
          getDocument
        }
      ]
    };

    try {
      const resolved = await defaultDarkMatterItemResolver(raceItem);

      expect(getDocument).toHaveBeenCalledWith("race123");
      expect(resolved).toMatchObject({
        name: "Vect",
        type: "race",
        flags: {
          [MODULE_ID]: {
            resolved: true,
            resolver: "compendium"
          }
        }
      });
    } finally {
      gameGlobal.game = previousGame;
    }
  });
});
