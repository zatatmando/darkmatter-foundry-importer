import type {
  CharacterClass,
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
  return numberFromText(value, fallback);
}

function numberFromText(value: string, fallback = 0): number {
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
    .replace(/\n+/g, " ")
    .split(",")
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

function isIndexedSpdSpellField(fieldName: string): boolean {
  const match = fieldName.match(/^Spd Box_(\d+)$/i);
  if (!match) return false;

  const index = Number.parseInt(match[1] ?? "", 10);
  return index >= 16;
}

function isSpellNameCandidate(value: string): boolean {
  const normalized = value.trim();
  if (!/[A-Za-z]/.test(normalized)) return false;
  if (/^[+-]?\d/.test(normalized)) return false;

  return !/^(Off|On|Yes|No|None|N\/A|Insert(?:\s+.+)?)$/i.test(normalized);
}

function cleanFeatureName(heading: string): string {
  return heading
    .replace(/^Level\s+\d+\s*:\s*/i, "")
    .replace(/^Gunslinger Subclass\s*:\s*/i, "")
    .replace(/^Gadgeteer Subclass\s*:\s*/i, "")
    .replace(/^Subclass\s*:\s*/i, "")
    .replace(/^Feature\s*:\s*/i, "")
    .replace(/^[^(]+\(Species Feat\)\s*:\s*/i, "")
    .replace(/\s*\((?:Origin|Ship|Species|General|Faction)\s+Feat\)\s*$/i, "")
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
  if (/^\d+(?:\s|$)/.test(value)) return false;
  if (/^\(/.test(value)) return false;
  if (/^(MANEUVER OPTIONS|OPTIONS)$/i.test(value)) return false;
  if (/^(?:\d+\/)?(?:Short|Long) Rest$/i.test(value)) return false;
  if (value.endsWith(":")) return false;
  if (value.includes(";")) return false;
  if (/(?:^|\s)or$/i.test(value)) return false;
  if ((value.match(/,/g)?.length ?? 0) >= 2) return false;
  if (/:\s*(?:\d+\s+)?(?:Action|Bonus Action|Reaction|Special|Short Rest|Long Rest)$/i.test(value)) return false;
  if (/\)$/.test(value) && !/\((?:Origin|Ship|Species|General|Faction)\s+Feat\)$/i.test(value)) return false;
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

function expandedInlineFeatureLines(lines: string[]): string[] {
  const metadataLabels = /^(Ability Scores|Feat|Skill Proficiencies|Tool Proficiency|Equipment|Weapon Category|Damage on a Hit|Properties|Mastery|Slot|AC|Sense|Move|PP|STR|DEX|CON|INT|WIS|CHA)\s*:/i;

  return lines.flatMap((line) => {
    if (metadataLabels.test(line)) return [line];
    if (/^Level\s+\d+\s*:/i.test(line)) return [line];

    const match = line.match(/^([A-Z][A-Za-z0-9’' +/.-]{1,60}):\s*(\S.+)$/);
    if (!match) return [line];

    const [, heading, description] = match;
    if (!heading || !description) return [line];
    if (wordCount(heading) > 5) return [line];
    if (wordCount(description) <= 2) return [line];

    return [heading.trim(), description.trim()];
  });
}

function splitFeatureText(value: string): CharacterFeature[] {
  const lines = expandedInlineFeatureLines(splitLines(value));
  if (lines.length === 0) return [];

  if (/^Ability Scores\s*:/i.test(lines[0] ?? "")) {
    const featLine = lines.find((line) => /^Feat\s*:/i.test(line));
    const featName = featLine?.replace(/^Feat\s*:\s*/i, "").trim();
    return featName ? [featureFromHeading(featName, [])] : [];
  }

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

function isGenericSubclassFeature(name: string): boolean {
  const normalized = normalizedLookupName(name);
  return normalized === "subclass" || normalized.endsWith(" subclass");
}

function splitInventoryText(value: string): CharacterInventoryItem[] {
  return splitFeatureText(value).map((item) => ({
    name: item.name,
    description: item.description
  }));
}

function inventoryItemsFromCommaList(value: string): CharacterInventoryItem[] {
  return splitCommaList(value).map((name) => ({
    name: name.replace(/^Equipment:\s*/i, "").replace(/[.:]\s*$/g, ""),
    description: ""
  })).filter((item) => !/^(and|and a|and an|a|an)$/i.test(item.name));
}

function inventoryItemsFromEquipmentText(value: string): CharacterInventoryItem[] {
  const normalized = value.replace(/\r\n?/g, "\n");
  if (!/\n\s*\n/.test(normalized)) return inventoryItemsFromCommaList(normalized);

  const itemBlocks = splitInventoryText(normalized).filter(
    (item) =>
      !/^Equipment\b/i.test(item.name) &&
      !/^[+-]?\d+/.test(item.name) &&
      (item.name.match(/,/g)?.length ?? 0) < 2 &&
      !/^(and|and a|and an|a|an)$/i.test(item.name)
  );

  if (itemBlocks.length > 0) return itemBlocks;

  return normalized
    .split(/\n\s*\n/)
    .flatMap(inventoryItemsFromCommaList);
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
    firstValue(fields, ["Class 1", "Class", "Class Box", "Class 3"]),
    firstValue(fields, ["Subclass 1", "Subclass", "Subclass Box", "Subclass 3"]),
    firstValue(fields, ["Species 1", "Race 1", "Species", "Race Box", "Race/Subrace 5"]),
    firstValue(fields, ["Background 1", "Background", "Background Box", "Background 5"])
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

  return dedupeFeatures(features).filter((feature) => {
    const name = normalizedLookupName(feature.name);
    return !isGenericSubclassFeature(feature.name) && !coreNames.some(
      (coreName) =>
        name === coreName ||
        name.endsWith(` ${coreName}`)
    );
  });
}

function parseLevelParts(levelText: string): number[] {
  return levelText
    .split("/")
    .map((part) => numberFromText(part))
    .filter((level) => level > 0);
}

function parseClassPart(value: string): { name: string; level?: number } {
  const trimmed = value.trim();
  const match = trimmed.match(/^(.+?)\s+(\d+)$/);
  if (!match) return { name: trimmed };

  return {
    name: match[1]?.trim() ?? trimmed,
    level: Number.parseInt(match[2] ?? "", 10)
  };
}

function parseClasses(className: string, levelText: string, fallbackLevel: number): CharacterClass[] {
  const parts = className
    .split("/")
    .map(parseClassPart)
    .filter((entry) => entry.name !== "");
  if (parts.length === 0) return [];

  const levelParts = parseLevelParts(levelText);
  const classes = parts.map((entry, index) => ({
    name: entry.name,
    level: entry.level ?? levelParts[index] ?? (parts.length === 1 ? fallbackLevel : 0)
  }));

  return classes.filter((entry) => entry.level > 0);
}

function totalClassLevel(classes: CharacterClass[], fallbackLevel: number): number {
  const total = classes.reduce((sum, entry) => sum + entry.level, 0);
  return total || fallbackLevel;
}

function collectSpells(fields: PdfFields): string[] {
  const namedSpellFields = collectValues(
    fields,
    (fieldName) =>
      /^Cantrip \d+$/i.test(fieldName) ||
      /^Spell \d+$/i.test(fieldName)
  );

  const knownDarkMatterSpellFields = listValue(fields, ["Text Field 114"]);
  const indexedDarkMatterSpellFields = collectValues(fields, isIndexedSpdSpellField)
    .filter(isSpellNameCandidate);

  return [...new Set([
    ...namedSpellFields,
    ...knownDarkMatterSpellFields,
    ...indexedDarkMatterSpellFields
  ])];
}

export function normalizeCharacter(fields: PdfFields): CharacterModel {
  const levelText = firstValue(fields, [
    "Level 1",
    "Character Level 1",
    "Level Box",
    "Level 3"
  ]);
  const className = firstValue(fields, ["Class 1", "Class", "Class Box", "Class 3"]);
  const fallbackLevel = numberFromText(levelText);
  const classes = parseClasses(className, levelText, fallbackLevel);
  const level = totalClassLevel(classes, fallbackLevel);
  const hpMax = numberValue(fields, [
    "Max Hit Points 1",
    "Max Hit Points 3",
    "Hit Point Maximum 1",
    "HP Max 1",
    "Hp Box",
    "HP Box"
  ]);

  const hpValue = numberValue(
    fields,
    ["Hit Points 1", "Hit Points 6", "Current Hit Points 1", "HP 1", "HP Box", "Hp Box"],
    hpMax
  );

  return {
    name: firstValue(fields, ["Character Name 1", "Character Name", "Character Name 3"]),
    level,
    classes,
    className,
    subclass: firstValue(fields, ["Subclass 1", "Subclass", "Subclass Box", "Subclass 3"]),
    species: firstValue(fields, ["Species 1", "Race 1", "Species", "Race Box", "Race/Subrace 5"]),
    background: firstValue(fields, ["Background 1", "Background", "Background Box", "Background 5"]),
    abilities: {
      str: numberValue(fields, [
        "Str Score 1",
        "Str Score 3",
        "Strength Score 1",
        "STR Score 1",
        "Str Box"
      ]),
      dex: numberValue(fields, [
        "Dex Score 1",
        "Dex Score 3",
        "Dexterity Score 1",
        "DEX Score 1",
        "Dex Box"
      ]),
      con: numberValue(fields, [
        "Con Score 1",
        "Con Score 3",
        "Constitution Score 1",
        "CON Score 1",
        "Con Box"
      ]),
      int: numberValue(fields, [
        "Int Score 1",
        "Int Score 3",
        "Intelligence Score 1",
        "INT Score 1",
        "Int Box"
      ]),
      wis: numberValue(fields, [
        "Wis Score 1",
        "Wis Score 3",
        "Wisdom Score 1",
        "WIS Score 1",
        "Wis Box"
      ]),
      cha: numberValue(fields, [
        "Cha Score 1",
        "Cha Score 3",
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
    ac: numberValue(fields, [
      "ArmorClass 3",
      "Armor Class 9",
      "Armor Class 1",
      "AC 1",
      "AC Box"
    ]),
    speed: numberValue(fields, ["Speed 3", "Speed 1", "Walking Speed 1", "Spd Box"]),
    proficiencyBonus: numberValue(fields, [
      "Prof. Bonus 1",
      "Prof. Bonus 3",
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
        .flatMap(inventoryItemsFromEquipmentText),
      ...collectFieldText(fields, (fieldName) => /^Features Box_9$/i.test(fieldName))
        .flatMap(splitInventoryText),
      ...inventoryItemsFromWeaponRows(fields)
    ]),
    spells: collectSpells(fields)
  };
}
