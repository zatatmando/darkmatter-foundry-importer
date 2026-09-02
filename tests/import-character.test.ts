import { describe, expect, it, vi } from "vitest";
import {
  finalizeCreatedActor,
  importCharacterPdf,
  importCharacterPdfFile,
  importCharacterPdfFiles
} from "../src/foundry/import-character.js";
import { MODULE_ID, type FoundryActorSource } from "../src/foundry/actor-builder.js";
import type { CharacterModel } from "../src/model/character.js";

const theron: CharacterModel = {
  name: "Theron",
  level: 5,
  classes: [{ name: "Vagabond", level: 5 }],
  className: "Vagabond",
  subclass: "Experiment X",
  species: "Star Gnome",
  background: "Salvager",
  abilities: { str: 14, dex: 15, con: 16, int: 11, wis: 14, cha: 11 },
  hp: { value: 36, max: 36, temp: 0 },
  ac: 17,
  speed: 30,
  proficiencyBonus: 3,
  credits: 4100,
  features: [
    {
      name: "Scrappy",
      description: "You are unusually resourceful."
    }
  ],
  inventory: [
    {
      name: "Laser pistol",
      description: "A compact antimatter sidearm."
    }
  ],
  spells: ["Jump"]
};

describe("importCharacterPdf", () => {
  it("parses PDF bytes, builds actor data, and creates a Foundry actor", async () => {
    const data = new Uint8Array([1, 2, 3]);
    const parse = vi.fn(async () => theron);
    const resolveItems = vi.fn(async (actorData) => actorData);
    const createActor = vi.fn(async (actorData) => ({
      id: "actor-1",
      name: actorData.name
    }));

    const result = await importCharacterPdf(data, {
      parse,
      resolveItems,
      createActor
    });

    expect(parse).toHaveBeenCalledWith(data);
    expect(resolveItems).toHaveBeenCalledOnce();
    expect(createActor).toHaveBeenCalledOnce();
    expect(createActor.mock.calls[0]?.[0].name).toBe("Theron");
    expect(createActor.mock.calls[0]?.[0].type).toBe("character");
    expect(result.character).toBe(theron);
    expect(result.actorData.system.attributes.hp.max).toBe(36);
    expect(result.actor).toEqual({ id: "actor-1", name: "Theron" });
  });

  it("repairs created actor links using Foundry-assigned item ids", async () => {
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
          race: "race-source",
          background: "background-source",
          originalClass: "class-source"
        },
        currency: { pp: 0, gp: 4100, ep: 0, sp: 0, cp: 0 }
      },
      items: [
        {
          name: "Vagabond",
          type: "class",
          system: {
            levels: 5,
            identifier: "vagabonds"
          },
          flags: {
            [MODULE_ID]: {
              imported: true,
              category: "class"
            }
          }
        },
        {
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
        },
        {
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
          name: "Salvager",
          type: "background",
          flags: {
            [MODULE_ID]: {
              imported: true,
              category: "background"
            }
          }
        },
        {
          name: "Battle Tactics",
          type: "feat",
          system: {
            type: {
              value: "",
              subtype: ""
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
            features: [],
            inventory: [],
            spells: []
          }
        }
      }
    };
    const update = vi.fn(async () => undefined);
    const updateEmbeddedDocuments = vi.fn(async () => undefined);
    const actor = {
      items: [
        {
          id: "foundry-class",
          name: "Vagabond",
          type: "class",
          system: {},
          flags: {
            [MODULE_ID]: {
              category: "class"
            }
          }
        },
        {
          id: "foundry-subclass",
          name: "Experiment X",
          type: "subclass",
          system: {},
          flags: {
            [MODULE_ID]: {
              category: "subclass"
            }
          }
        },
        {
          id: "foundry-race",
          name: "Star Gnome",
          type: "race",
          flags: {
            [MODULE_ID]: {
              category: "species"
            }
          }
        },
        {
          id: "foundry-background",
          name: "Salvager",
          type: "background",
          flags: {
            [MODULE_ID]: {
              category: "background"
            }
          }
        },
        {
          id: "foundry-feature",
          name: "Battle Tactics",
          type: "feat",
          system: {
            type: {
              value: "",
              subtype: ""
            }
          },
          flags: {
            [MODULE_ID]: {
              category: "feature"
            }
          }
        }
      ],
      update,
      updateEmbeddedDocuments
    };

    await finalizeCreatedActor(actor, actorData);

    expect(updateEmbeddedDocuments).toHaveBeenCalledWith("Item", expect.arrayContaining([
      expect.objectContaining({
        _id: "foundry-class",
        "system.identifier": "vagabonds",
        "system.levels": 5
      }),
      expect.objectContaining({
        _id: "foundry-subclass",
        "system.classIdentifier": "vagabonds"
      }),
      expect.objectContaining({
        _id: "foundry-feature",
        "flags.dnd5e.advancementRoot": "foundry-class",
        "system.type.value": "class"
      })
    ]));
    expect(update).toHaveBeenCalledWith({
      "system.details.race": "foundry-race",
      "system.details.background": "foundry-background",
      "system.details.originalClass": "foundry-class"
    });
  });

  it("creates the actor with resolved item data", async () => {
    const parse = vi.fn(async () => theron);
    const createActor = vi.fn(async () => ({ id: "actor-4" }));
    const resolveItems = vi.fn(async (actorData) => ({
      ...actorData,
      items: actorData.items.map((item) =>
        item.name === "Scrappy"
          ? {
              ...item,
              name: "Resolved Scrappy"
            }
          : item
      )
    }));

    const result = await importCharacterPdf(new Uint8Array([10]), {
      parse,
      resolveItems,
      createActor
    });

    expect(result.actorData.items.some((item) => item.name === "Resolved Scrappy")).toBe(true);
    expect(createActor.mock.calls[0]?.[0].items.some((item) => item.name === "Resolved Scrappy")).toBe(true);
  });

  it("reads a browser File before importing", async () => {
    const file = new File([new Uint8Array([4, 5, 6])], "Theron.pdf", {
      type: "application/pdf"
    });
    const parse = vi.fn(async () => theron);
    const createActor = vi.fn(async () => ({ id: "actor-2" }));

    await importCharacterPdfFile(file, { parse, createActor });

    expect(parse).toHaveBeenCalledWith(new Uint8Array([4, 5, 6]));
    expect(createActor).toHaveBeenCalledOnce();
  });

  it("imports multiple browser Files in order", async () => {
    const first = new File([new Uint8Array([1])], "Theron.pdf", {
      type: "application/pdf"
    });
    const second = new File([new Uint8Array([2])], "Other Character.pdf", {
      type: "application/pdf"
    });
    const parse = vi.fn(async () => theron);
    const createActor = vi.fn(async (actorData) => ({
      name: actorData.name
    }));

    const results = await importCharacterPdfFiles([first, second], {
      parse,
      createActor
    });

    expect(parse).toHaveBeenNthCalledWith(1, new Uint8Array([1]));
    expect(parse).toHaveBeenNthCalledWith(2, new Uint8Array([2]));
    expect(createActor).toHaveBeenCalledTimes(2);
    expect(results).toHaveLength(2);
  });

  it("uses the Foundry v14 Actor implementation API by default", async () => {
    const actorGlobal = globalThis as typeof globalThis & {
      Actor?: {
        implementation: {
          create: (actorData: unknown) => Promise<unknown>;
        };
      };
    };
    const previousActor = actorGlobal.Actor;
    const create = vi.fn(async () => ({ id: "actor-3" }));

    actorGlobal.Actor = {
      implementation: {
        create
      }
    };

    try {
      await importCharacterPdf(new Uint8Array([7, 8, 9]), {
        parse: async () => theron
      });

      expect(create).toHaveBeenCalledOnce();
      expect(create.mock.calls[0]?.[0]).toMatchObject({
        name: "Theron",
        type: "character"
      });
    } finally {
      actorGlobal.Actor = previousActor;
    }
  });
});
