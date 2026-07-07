import type { CharacterModel } from "../model/character.js";

export function buildActorData(character: CharacterModel) {
  return {
    name: character.name,
    type: "character",
    system: {
      abilities: Object.fromEntries(
        Object.entries(character.abilities).map(([key, value]) => [key, { value }])
      ),
      attributes: {
        hp: character.hp,
        ac: { flat: character.ac, calc: "flat" },
        movement: { walk: character.speed }
      },
      details: {
        level: character.level,
        race: character.species,
        background: character.background
      },
      currency: { gp: character.credits }
    },
    items: [],
    flags: { "darkmatter-foundry-importer": { imported: true } }
  };
}
