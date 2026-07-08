import type { CharacterModel } from "../model/character.js";

type PdfFields = Record<string, string>;

function firstValue(fields: PdfFields, names: string[], fallback = ""): string {
  for (const name of names) {
    const value = fields[name];
    if (value !== undefined && value.trim() !== "") return value;
  }

  return fallback;
}

function numberValue(fields: PdfFields, names: string[], fallback = 0): number {
  const value = firstValue(fields, names);
  if (!value) return fallback;

  const normalized = value.replace(/,/g, "");
  const match = normalized.match(/[+-]?\d+/);
  if (!match) return fallback;

  const parsed = Number.parseInt(match[0], 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function splitValue(value: string): string[] {
  return value
    .split(/\r?\n|,/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function listValue(fields: PdfFields, names: string[]): string[] {
  return splitValue(firstValue(fields, names));
}

function collectValues(
  fields: PdfFields,
  matches: (fieldName: string) => boolean
): string[] {
  return Object.entries(fields)
    .filter(([fieldName, value]) => matches(fieldName) && value.trim() !== "")
    .flatMap(([, value]) => splitValue(value));
}

function collectFeatures(fields: PdfFields): string[] {
  return collectValues(
    fields,
    (fieldName) =>
      /^Features and Traits(?: \d+)?$/i.test(fieldName) ||
      /^Class Features(?: \d+)?$/i.test(fieldName)
  );
}

function collectSpells(fields: PdfFields): string[] {
  const namedSpellFields = collectValues(
    fields,
    (fieldName) =>
      /^Cantrip \d+$/i.test(fieldName) ||
      /^Spell \d+$/i.test(fieldName)
  );

  const knownDarkMatterSpellFields = listValue(fields, ["Text Field 114"]);

  return [...namedSpellFields, ...knownDarkMatterSpellFields];
}

export function normalizeCharacter(fields: PdfFields): CharacterModel {
  const hpMax = numberValue(fields, [
    "Max Hit Points 1",
    "Hit Point Maximum 1",
    "HP Max 1"
  ]);

  const hpValue = numberValue(
    fields,
    ["Hit Points 1", "Current Hit Points 1", "HP 1"],
    hpMax
  );

  return {
    name: firstValue(fields, ["Character Name 1", "Character Name"]),
    level: numberValue(fields, ["Level 1", "Character Level 1"]),
    className: firstValue(fields, ["Class 1", "Class"]),
    subclass: firstValue(fields, ["Subclass 1", "Subclass"]),
    species: firstValue(fields, ["Species 1", "Race 1", "Species"]),
    background: firstValue(fields, ["Background 1", "Background"]),
    abilities: {
      str: numberValue(fields, [
        "Str Score 1",
        "Strength Score 1",
        "STR Score 1"
      ]),
      dex: numberValue(fields, [
        "Dex Score 1",
        "Dexterity Score 1",
        "DEX Score 1"
      ]),
      con: numberValue(fields, [
        "Con Score 1",
        "Constitution Score 1",
        "CON Score 1"
      ]),
      int: numberValue(fields, [
        "Int Score 1",
        "Intelligence Score 1",
        "INT Score 1"
      ]),
      wis: numberValue(fields, [
        "Wis Score 1",
        "Wisdom Score 1",
        "WIS Score 1"
      ]),
      cha: numberValue(fields, [
        "Cha Score 1",
        "Charisma Score 1",
        "CHA Score 1"
      ])
    },
    hp: {
      value: hpValue,
      max: hpMax,
      temp: numberValue(fields, [
        "Temporary Hit Points 1",
        "Temp Hit Points 1",
        "Temp HP 1"
      ])
    },
    ac: numberValue(fields, ["ArmorClass 3", "Armor Class 1", "AC 1"]),
    speed: numberValue(fields, ["Speed 3", "Speed 1", "Walking Speed 1"]),
    proficiencyBonus: numberValue(fields, [
      "Prof. Bonus 1",
      "Proficiency Bonus 1"
    ]),
    credits: numberValue(fields, [
      "GP 13",
      "Credits 1",
      "Credit 1",
      "Credits"
    ]),
    features: collectFeatures(fields),
    inventory: listValue(fields, ["Equipment 1", "Inventory 1"]),
    spells: collectSpells(fields)
  };
}