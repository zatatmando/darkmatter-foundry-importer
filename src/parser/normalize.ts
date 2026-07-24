import type {
  CharacterFeature,
  CharacterInventoryItem,
  CharacterModel
} from "../model/character.js";

type PdfFields = Record<string, string>;

function firstValue(fields: PdfFields, names: string[], fallback = ""): string {
  for (const name of names) {
    const value = fields[name];
    if (value !== undefined && value.trim() !== "") return value;
  }

  return fallback;
}

function normalizedLookupName(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[’‘]/g, "'")
    .toLowerCase()
    .replace(/[^a-z0-9+]+/g, " ")
    .trim();
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

function splitLines(value: string): string[] {
  return value
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function splitCommaList(value: string): string[] {
  return value
    .replace(/\r\n?/g, "\n")
    .split(/\n|,/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function listValue(fields: PdfFields, names: string[]): string[] {
  return splitLines(firstValue(fields, names));
}

function collectValues(
  fields: PdfFields,
  matches: (fieldName: string) => boolean
): string[] {
  return Object.entries(fields)
    .filter(([fieldName, value]) => matches(fieldName) && value.trim() !== "")
    .flatMap(([, value]) => splitLines(value));
}

function collectFieldText(
  fields: PdfFields,
  matches: (fieldName: string) => boolean
): string[] {
  return Object.entries(fields)
    .filter(([fieldName, value]) => matches(fieldName) && value.trim() !== "")
    .map(([, value]) => value.trim());
}

function cleanFeatureName(heading: string): string {
  return heading
    .replace(/^Level\s+\d+\s*:\s*/i, "")
    .replace(/^Gunslinger Subclass\s*:\s*/i, "")
    .replace(/^[^(]+\(Species Feat\)\s*:\s*/i, "")
    .replace(/\s*\((?:Origin|Ship|Species|General)\s+Feat\)\s*$/i, "")
    .replace(/\s*\[[^\]]+\]\s*$/i, "")
    .trim();
}

function isExplicitFeatureHeading(line: string): boolean {
  return (
    /^Level\s+\d+\s*:\s*/i.test(line) ||
    /^[^(]+\(Species Feat\)\s*:/i.test(line) ||
    /\((?:Origin|Ship|Species|General)\s+Feat\)\s*$/i.test(line)
  );
}

function wordCount(value: string): number {
  return value.match(/[A-Za-z0-9’'+-]+/g)?.length ?? 0;
}

function isSimpleTitleLine(line: string): boolean {
  const value = line.trim();
  if (!value || value.length > 90) return false;
  if (/^(MANEUVER OPTIONS|OPTIONS)$/i.test(value)) return false;
  if (value.endsWith(":")) return false;
  if (value.includes(";")) return false;
  if (/^[a-z]/.test(value)) return false;
  if (/[,;]$/.test(value)) return false;
  if (/[.!?]\s/.test(value)) return false;
  if (/^(Common|Uncommon|Rare|Very Rare|Legendary)$/i.test(value)) return false;
  if (/^(Construct Graft|General Feat|Weapon|Wondrous Item)\b/i.test(value)) return false;
  if (/^(Ability Scores|Feat|Skill Proficiencies|Tool Proficiency|Equipment|Weapon Category|Damage on a Hit|Properties|Mastery)\s*:/i.test(value)) return false;
  if (/^Level\s+\d+\s*:\s*/i.test(value)) return true;
  if (/^[^(]+\(Species Feat\)\s*:/i.test(value)) return true;
  if (/[.!?]$/.test(value)) return false;

  return wordCount(value) <= 7;
}

function isFeatureHeading(line: string, nextLine?: string): boolean {
  if (!isSimpleTitleLine(line)) return false;
  if (!nextLine) return false;

  return !/^[a-z]/.test(nextLine.trim());
}

function featureFromHeading(heading: string, descriptionLines: string[]): CharacterFeature {
  return {
    name: cleanFeatureName(heading),
    description: descriptionLines.join("\n").trim()
  };
}

function splitFeatureText(value: string): CharacterFeature[] {
  const lines = splitLines(value);
  if (lines.length === 0) return [];

  if (lines.every(isSimpleTitleLine)) {
    return lines.map((line) => featureFromHeading(line, []));
  }

  const rawHeadingIndexes = lines
    .map((line, index) => (isFeatureHeading(line, lines[index + 1]) ? index : -1))
    .filter((index) => index >= 0);
  const headingIndexes = rawHeadingIndexes.filter((headingIndex, index) => {
    const previousHeadingIndex = rawHeadingIndexes[index - 1];
    if (previousHeadingIndex === undefined) return true;
    if (headingIndex !== previousHeadingIndex + 1) return true;

    return isExplicitFeatureHeading(lines[headingIndex]);
  });

  if (headingIndexes.length === 0) {
    return [featureFromHeading(lines[0], lines.slice(1))];
  }

  return headingIndexes.map((start, index) => {
    const end = headingIndexes[index + 1] ?? lines.length;
    return featureFromHeading(lines[start], lines.slice(start + 1, end));
  });
}

function dedupeFeatures(features: CharacterFeature[]): CharacterFeature[] {
  const deduped = new Map<string, CharacterFeature>();

  for (const feature of features) {
    const key = normalizedLookupName(feature.name);
    const existing = deduped.get(key);
    if (!existing || (!existing.description && feature.description)) {
      deduped.set(key, feature);
    }
  }

  return [...deduped.values()];
}

function splitInventoryText(value: string): CharacterInventoryItem[] {
  return splitFeatureText(value).map((item) => ({
    name: item.name,
    description: item.description
  }));
}

function inventoryItemsFromCommaList(value: string): CharacterInventoryItem[] {
  return splitCommaList(value).map((name) => ({
    name,
    description: ""
  }));
}

function inventoryItemsFromWeaponRows(fields: PdfFields): CharacterInventoryItem[] {
  const rows = [
    ["Text Box_9", "Text Box_14"],
    ["Text Box_10", "Text Box_15"],
    ["Text Box_11", "Text Box_16"],
    ["Text Box_12", "Text Box_17"],
    ["Text Box_13", "Text Box_18"]
  ];

  return rows
    .map(([nameField, descriptionField]) => ({
      name: firstValue(fields, [nameField]),
      description: firstValue(fields, [descriptionField])
    }))
    .filter((item) => item.name !== "");
}

function dedupeInventory(items: CharacterInventoryItem[]): CharacterInventoryItem[] {
  const deduped = new Map<string, CharacterInventoryItem>();

  for (const item of items) {
    const key = normalizedLookupName(item.name);
    const existing = deduped.get(key);
    if (!existing || (!existing.description && item.description)) {
      deduped.set(key, item);
    }
  }

  return [...deduped.values()];
}

function collectFeatures(fields: PdfFields): CharacterFeature[] {
  const coreNames = [
    firstValue(fields, ["Class 1", "Class", "Class Box"]),
    firstValue(fields, ["Subclass 1", "Subclass", "Subclass Box"]),
    firstValue(fields, ["Species 1", "Race 1", "Species", "Race Box"]),
    firstValue(fields, ["Background 1", "Background", "Background Box"])
  ]
    .filter(Boolean)
    .map(normalizedLookupName);
  const features = collectFieldText(
    fields,
    (fieldName) =>
      /^Features and Traits(?: \d+)?$/i.test(fieldName) ||
      /^Class Features(?: \d+)?$/i.test(fieldName) ||
      /^Features Box$/i.test(fieldName) ||
      /^Features Box_(?:5|6|7)$/i.test(fieldName)
  ).flatMap(splitFeatureText);

  return dedupeFeatures(features).filter(
    (feature) => !coreNames.includes(normalizedLookupName(feature.name))
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
    "HP Max 1",
    "Hp Box",
    "HP Box"
  ]);

  const hpValue = numberValue(
    fields,
    ["Hit Points 1", "Current Hit Points 1", "HP 1", "HP Box", "Hp Box"],
    hpMax
  );

  return {
    name: firstValue(fields, ["Character Name 1", "Character Name"]),
    level: numberValue(fields, ["Level 1", "Character Level 1", "Level Box"]),
    className: firstValue(fields, ["Class 1", "Class", "Class Box"]),
    subclass: firstValue(fields, ["Subclass 1", "Subclass", "Subclass Box"]),
    species: firstValue(fields, ["Species 1", "Race 1", "Species", "Race Box"]),
    background: firstValue(fields, ["Background 1", "Background", "Background Box"]),
    abilities: {
      str: numberValue(fields, [
        "Str Score 1",
        "Strength Score 1",
        "STR Score 1",
        "Str Box"
      ]),
      dex: numberValue(fields, [
        "Dex Score 1",
        "Dexterity Score 1",
        "DEX Score 1",
        "Dex Box"
      ]),
      con: numberValue(fields, [
        "Con Score 1",
        "Constitution Score 1",
        "CON Score 1",
        "Con Box"
      ]),
      int: numberValue(fields, [
        "Int Score 1",
        "Intelligence Score 1",
        "INT Score 1",
        "Int Box"
      ]),
      wis: numberValue(fields, [
        "Wis Score 1",
        "Wisdom Score 1",
        "WIS Score 1",
        "Wis Box"
      ]),
      cha: numberValue(fields, [
        "Cha Score 1",
        "Charisma Score 1",
        "CHA Score 1",
        "Cha Box"
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
    ac: numberValue(fields, ["ArmorClass 3", "Armor Class 1", "AC 1", "AC Box"]),
    speed: numberValue(fields, ["Speed 3", "Speed 1", "Walking Speed 1", "Spd Box"]),
    proficiencyBonus: numberValue(fields, [
      "Prof. Bonus 1",
      "Proficiency Bonus 1",
      "Prof Box"
    ]),
    credits: numberValue(fields, [
      "GP 13",
      "Credits 1",
      "Credit 1",
      "Credits",
      "Text Box_48"
    ]),
    features: collectFeatures(fields),
    inventory: dedupeInventory([
      ...collectFieldText(fields, (fieldName) =>
        /^(Equipment|Inventory)(?: \d+)?$/i.test(fieldName)
      ).flatMap(splitInventoryText),
      ...collectFieldText(fields, (fieldName) => /^Features Box_3$/i.test(fieldName))
        .flatMap(inventoryItemsFromCommaList),
      ...collectFieldText(fields, (fieldName) => /^Features Box_9$/i.test(fieldName))
        .flatMap(splitInventoryText),
      ...inventoryItemsFromWeaponRows(fields)
    ]),
    spells: collectSpells(fields)
  };
}
