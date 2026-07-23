import { describe, expect, it, vi } from "vitest";
import {
  importCharacterPdf,
  importCharacterPdfFile,
  importCharacterPdfFiles
} from "../src/foundry/import-character.js";
import type { CharacterModel } from "../src/model/character.js";

const theron: CharacterModel = {
  name: "Theron",
  level: 5,
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
  inventory: ["Laser pistol"],
  spells: ["Jump"]
};

describe("importCharacterPdf", () => {
  it("parses PDF bytes, builds actor data, and creates a Foundry actor", async () => {
    const data = new Uint8Array([1, 2, 3]);
    const parse = vi.fn(async () => theron);
    const createActor = vi.fn(async (actorData) => ({
      id: "actor-1",
      name: actorData.name
    }));

    const result = await importCharacterPdf(data, { parse, createActor });

    expect(parse).toHaveBeenCalledWith(data);
    expect(createActor).toHaveBeenCalledOnce();
    expect(createActor.mock.calls[0]?.[0].name).toBe("Theron");
    expect(createActor.mock.calls[0]?.[0].type).toBe("character");
    expect(result.character).toBe(theron);
    expect(result.actorData.system.attributes.hp.max).toBe(36);
    expect(result.actor).toEqual({ id: "actor-1", name: "Theron" });
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
