import { describe, expect, it } from "vitest";
import { normalizeCharacter } from "../src/parser/normalize.js";

describe("normalizeCharacter", () => {
  it("normalizes Theron core fields", () => {
    const character = normalizeCharacter({
      "Character Name 1": "Theron",
      "Level 1": "5",
      "Class 1": "Vagabond",
      "Subclass 1": "Experiment X",
      "Species 1": "Star Gnome",
      "Background 1": "Salvager",
      "Hit Points 1": "36",
      "Max Hit Points 1": "36",
      "Str Score 1": "14",
      "Dex Score 1": "15",
      "Con Score 1": "16",
      "Int Score 1": "11",
      "Wis Score 1": "14",
      "Cha Score 1": "11",
      "ArmorClass 3": "17",
      "Speed 3": "30",
      "Prof. Bonus 1": "+3",
      "GP 13": "4100"
    });

    expect(character.name).toBe("Theron");
    expect(character.level).toBe(5);
    expect(character.className).toBe("Vagabond");
    expect(character.subclass).toBe("Experiment X");
    expect(character.species).toBe("Star Gnome");
    expect(character.background).toBe("Salvager");
    expect(character.abilities.con).toBe(16);
    expect(character.hp.value).toBe(36);
    expect(character.hp.max).toBe(36);
    expect(character.ac).toBe(17);
    expect(character.speed).toBe(30);
    expect(character.proficiencyBonus).toBe(3);
    expect(character.credits).toBe(4100);
  });

  it("collects Dark Matter feature fields", () => {
    const character = normalizeCharacter({
      "Features and Traits 4": "EXPERIMENT X\nBloody Rampage\nMutation",
      "Class Features 2": "Battle Tactics\nWeapon Mastery",
      "Class Features 3": "Intrepid Captain\nGambler",
      "Class Features 4": "Rampage\nIron Wall",
      "Class Features 5": "Axe of the Mother Tree\nSpacewalkers"
    });

    expect(character.features).toEqual([
      "EXPERIMENT X",
      "Bloody Rampage",
      "Mutation",
      "Battle Tactics",
      "Weapon Mastery",
      "Intrepid Captain",
      "Gambler",
      "Rampage",
      "Iron Wall",
      "Axe of the Mother Tree",
      "Spacewalkers"
    ]);
  });

  it("collects inventory fields", () => {
    const character = normalizeCharacter({
      "Inventory 1": "Engineer's Pack\nOmnitool\nVent Tape"
    });

    expect(character.inventory).toEqual([
      "Engineer's Pack",
      "Omnitool",
      "Vent Tape"
    ]);
  });

  it("collects Dark Matter spell fields", () => {
    const character = normalizeCharacter({
      "Cantrip 10": "TECHNOMANCY",
      "Spell 88": "TECHNICAL DIFFICULTIES",
      "Text Field 114": "CIRCUIT BREAKER"
    });

    expect(character.spells).toEqual([
      "TECHNOMANCY",
      "TECHNICAL DIFFICULTIES",
      "CIRCUIT BREAKER"
    ]);
  });
});