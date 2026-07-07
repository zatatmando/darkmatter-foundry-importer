import { describe, expect, it } from "vitest";
import { normalizeCharacter } from "../src/parser/normalize.js";

describe("normalizeCharacter", () => {
  it("normalizes Theron core fields", () => {
    const character = normalizeCharacter({
      "Character Name 1": "Theron", "Level 1": "5", "Class 1": "Vagabond",
      "Subclass 1": "Experiment X", "Species 1": "Star Gnome", "Background 1": "Salvager",
      "Hit Points 1": "36", "Max Hit Points 1": "36", "Str Score 1": "14",
      "Dex Score 1": "15", "Con Score 1": "16", "Int Score 1": "11",
      "Wis Score 1": "14", "Cha Score 1": "11", "ArmorClass 3": "17",
      "Speed 3": "30", "Prof. Bonus 1": "+3", "GP 13": "4100"
    });
    expect(character.name).toBe("Theron");
    expect(character.className).toBe("Vagabond");
    expect(character.abilities.con).toBe(16);
    expect(character.credits).toBe(4100);
  });
});
