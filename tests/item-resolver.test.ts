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
      background: "Salvager",
      originalClass: null
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
        classes: [{ name: "Vagabond", level: 5 }],
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
        _id: "race123",
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

  it("preserves imported class levels when resolving a compendium class", async () => {
    const classItem: FoundryActorSource["items"][number] = {
      name: "Gadgeteer",
      type: "class",
      system: {
        levels: 6,
        identifier: "gadgeteer"
      },
      flags: {
        [MODULE_ID]: {
          imported: true,
          category: "class"
        }
      }
    };
    const gameGlobal = globalThis as typeof globalThis & { game?: unknown };
    const previousGame = gameGlobal.game;

    gameGlobal.game = {
      packs: [
        {
          collection: "mage-hand-press-dark-matter.classes",
          documentName: "Item",
          metadata: {
            packageName: "mage-hand-press-dark-matter",
            type: "Item"
          },
          getIndex: vi.fn(async () => [{ _id: "gadgeteer", name: "Gadgeteer", type: "class" }]),
          getDocument: vi.fn(async () => ({
            id: "gadgeteer",
            name: "Gadgeteer",
            type: "class",
            toObject: () => ({
              _id: "gadgeteer",
              name: "Gadgeteer",
              type: "class",
              system: {
                levels: 1,
                identifier: "gadgeteer"
              }
            })
          }))
        }
      ]
    };

    try {
      const resolved = await defaultDarkMatterItemResolver(classItem);

      expect(resolved?.system).toMatchObject({
        levels: 6,
        identifier: "gadgeteer"
      });
    } finally {
      gameGlobal.game = previousGame;
    }
  });

  it("does not resolve feature names to incompatible item types or monster feature packs", async () => {
    const featureItem: FoundryActorSource["items"][number] = {
      name: "Darkvision",
      type: "feat",
      flags: {
        [MODULE_ID]: {
          imported: true,
          category: "feature"
        }
      }
    };
    const gameGlobal = globalThis as typeof globalThis & { game?: unknown };
    const previousGame = gameGlobal.game;

    gameGlobal.game = {
      packs: [
        {
          collection: "dnd5e.spells",
          documentName: "Item",
          metadata: {
            packageName: "dnd5e",
            type: "Item"
          },
          getIndex: vi.fn(async () => [{ _id: "darkvisionSpell", name: "Darkvision", type: "spell" }]),
          getDocument: vi.fn(async () => ({
            id: "darkvisionSpell",
            name: "Darkvision",
            type: "spell"
          }))
        },
        {
          collection: "dnd5e.monsterfeatures",
          documentName: "Item",
          metadata: {
            packageName: "dnd5e",
            type: "Item"
          },
          getIndex: vi.fn(async () => [{ _id: "rampageMonster", name: "Darkvision", type: "feat" }]),
          getDocument: vi.fn(async () => ({
            id: "rampageMonster",
            name: "Darkvision",
            type: "feat"
          }))
        }
      ]
    };

    try {
      await expect(defaultDarkMatterItemResolver(featureItem)).resolves.toBeNull();
    } finally {
      gameGlobal.game = previousGame;
    }
  });

  it("links resolved species and background items into actor details", async () => {
    const actorWithOrigins: FoundryActorSource = {
      ...actorData,
      items: [
        {
          _id: "localRace",
          name: "Star Gnome",
          type: "race",
          flags: {
            [MODULE_ID]: {
              imported: true,
              category: "species"
            }
          }
        },
        {
          _id: "localBackground",
          name: "Salvager",
          type: "background",
          flags: {
            [MODULE_ID]: {
              imported: true,
              category: "background"
            }
          }
        }
      ]
    };

    const resolved = await resolveActorItems(actorWithOrigins, async (item) => {
      if (item.flags[MODULE_ID].category === "species") {
        return {
          ...item,
          _id: "mhpStarGnome0000"
        };
      }
      if (item.flags[MODULE_ID].category === "background") {
        return {
          ...item,
          _id: "mhpSalvager00000"
        };
      }

      return null;
    });

    expect(resolved.system.details.race).toBe("mhpStarGnome0000");
    expect(resolved.system.details.background).toBe("mhpSalvager00000");
  });

  it("links resolved subclasses to the imported class item", async () => {
    const actorWithClass: FoundryActorSource = {
      ...actorData,
      items: [
        {
          _id: "vagabondClass",
          name: "Vagabond",
          type: "class",
          system: {
            levels: 5
          },
          flags: {
            [MODULE_ID]: {
              imported: true,
              category: "class"
            }
          }
        },
        {
          _id: "mhpExperimentX00",
          name: "Experiment X",
          type: "subclass",
          system: {
            classIdentifier: "vagabonds"
          },
          flags: {
            [MODULE_ID]: {
              imported: true,
              category: "subclass"
            }
          }
        }
      ]
    };

    const resolved = await resolveActorItems(actorWithClass, async () => null);
    const classItem = resolved.items.find((item) => item.type === "class");
    const subclass = resolved.items.find((item) => item.type === "subclass");

    expect(classItem?.system).toMatchObject({
      identifier: "vagabonds"
    });
    expect(subclass?.system).toMatchObject({
      classIdentifier: "vagabonds"
    });
    expect(resolved.system.details.originalClass).toBe("vagabondClass");
  });
});
