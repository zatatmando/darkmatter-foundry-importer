import { describe, expect, it, vi } from "vitest";
import {
  importCharacterPdf,
  importCharacterPdfFile
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
});
