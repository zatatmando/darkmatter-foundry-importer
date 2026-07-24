import { describe, expect, it } from "vitest";
import { buildActorData } from "../src/foundry/actor-builder.js";
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
    },
    {
      name: "Spacewise",
      description: "You know your way around the galaxy."
    }
  ],
  inventory: [
    {
      name: "Laser pistol",
      description: "A compact antimatter sidearm."
    },
    {
      name: "Salvage kit",
      description: "Tools for recovering useful parts."
    }
  ],
  spells: ["Jump"]
};

describe("buildActorData", () => {
  it("maps core character data into a dnd5e actor source", () => {
    const actor = buildActorData(theron);

    expect(actor.name).toBe("Theron");
    expect(actor.type).toBe("character");
    expect(actor.system.abilities.con.value).toBe(16);
    expect(actor.system.attributes.hp).toEqual({ value: 36, max: 36, temp: 0 });
    expect(actor.system.attributes.ac).toEqual({ calc: "flat", flat: 17 });
    expect(actor.system.attributes.movement.walk).toBe(30);
    expect(actor.system.attributes.prof).toBe(3);
    expect(actor.system.details.level).toBe(5);
    expect(actor.system.details.race).toBe(
      actor.items.find((item) => item.name === "Star Gnome")?._id
    );
    expect(actor.system.details.background).toBe(
      actor.items.find((item) => item.name === "Salvager")?._id
    );
    expect(actor.system.currency.gp).toBe(4100);
  });

  it("creates placeholder items and preserves source data in module flags", () => {
    const actor = buildActorData(theron);

    expect(actor.items.map((item) => [item.type, item.name])).toEqual([
      ["class", "Vagabond"],
      ["subclass", "Experiment X"],
      ["race", "Star Gnome"],
      ["background", "Salvager"],
      ["feat", "Scrappy"],
      ["feat", "Spacewise"],
      ["loot", "Laser pistol"],
      ["loot", "Salvage kit"],
      ["spell", "Jump"]
    ]);
    expect(actor.flags["darkmatter-foundry-importer"].source).toEqual({
      className: "Vagabond",
      subclass: "Experiment X",
      species: "Star Gnome",
      background: "Salvager",
      credits: 4100,
      features: [
        {
          name: "Scrappy",
          description: "You are unusually resourceful."
        },
        {
          name: "Spacewise",
          description: "You know your way around the galaxy."
        }
      ],
      inventory: [
        {
          name: "Laser pistol",
          description: "A compact antimatter sidearm."
        },
        {
          name: "Salvage kit",
          description: "Tools for recovering useful parts."
        }
      ],
      spells: ["Jump"]
    });
  });
});
