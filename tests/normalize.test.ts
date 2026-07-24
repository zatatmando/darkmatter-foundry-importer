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
      "Features and Traits 4":
        "EXPERIMENT X\nWield Strange and Magical Mutations\nLevel 3: Bloody Rampage\nYou learn the Rampage maneuver. If you already know it, you learn a different maneuver.\nLevel 3: Mutation\nYou gain one mutation.",
      "Class Features 2":
        "Level 1: Battle Tactics\nYou learn maneuvers fueled by Battle Dice.\nLevel 1: Weapon Mastery\nYour training with weapons allows mastery properties.",
      "Class Features 3":
        "Intrepid Captain (Ship Feat)\nWith you at the bridge, the crew operates well.\nGambler (Origin Feat)\nYou gain benefits with games of chance.",
      "Class Features 4":
        "Rampage\nOnce on each turn, after reducing an enemy to 0 Hit Points, you can move and attack.\nIron Wall\nAs a Bonus Action, you can fortify yourself.",
      "Class Features 5":
        "Axe of the Mother Tree\nThis traditional axe regains Hit Points on a Critical Hit.\nSpacewalkers\nConstruct Graft (Legs Slot), Uncommon\nThis graft lets you breathe in space."
    });

    expect(character.features.map((feature) => feature.name)).toEqual([
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
    expect(character.features[1]).toEqual({
      name: "Bloody Rampage",
      description:
        "You learn the Rampage maneuver. If you already know it, you learn a different maneuver."
    });
    expect(character.features.at(-1)).toEqual({
      name: "Spacewalkers",
      description:
        "Construct Graft (Legs Slot), Uncommon\nThis graft lets you breathe in space."
    });
  });

  it("collects inventory fields", () => {
    const character = normalizeCharacter({
      "Inventory 1":
        "Engineer's Pack\nAn Engineer's Pack includes a Backpack, a Comm Set, and a Wristwatch.\nOmnitool"
    });

    expect(character.inventory).toEqual([
      {
        name: "Engineer's Pack",
        description:
          "An Engineer's Pack includes a Backpack, a Comm Set, and a Wristwatch.\nOmnitool"
      }
    ]);
  });

  it("normalizes HK-style Dark Matter sheet fields", () => {
    const character = normalizeCharacter({
      "Character Name": "HK-69",
      "Level Box": "6",
      "Class Box": "Gunslinger",
      "Subclass Box": "Laserist",
      "Race Box": "Vect",
      "Background Box": "Scoundrel",
      "Prof Box": "+3",
      "Str Box": "11",
      "Dex Box": "20",
      "Con Box": "13",
      "Int Box": "10",
      "Wis Box": "12",
      "Cha Box": "17",
      "Spd Box": "30",
      "AC Box": "18",
      "HP Box": "39",
      "Hp Box": "39",
      "Text Box_48": "100",
      "Text Box_9": "Repeater",
      "Text Box_14": "2d6 Radiant (60/240), Firearm Vex",
      "Text Box_10": "Magnus",
      "Text Box_15": "2d8 Radiant, Overheat",
      "Text Box_11": "Antimatter Dagger",
      "Text Box_16": "1d4 Necrotic, Nick",
      "Text Box_12": "Hardlight Dart",
      "Text Box_17": "1d6 Force/Vex",
      "Text Box_13": "Laser Eyes",
      "Text Box_18": "2d4 radiant/Vex",
      "Features Box":
        "Level 1: Quick Draw\nYou are adept at drawing and firing.\nLevel 2: Risk\nYou can perform incredible feats of daring.",
      "Features Box_3":
        "Antimatter Dagger, 2 Pouches, Thieves' Tools, Traveler's Clothes (streetwear), Bounty Hunter's Vest, Repeater, Magnus, Spacer's Pack, Hardlight Bracer.",
      "Features Box_5":
        "Gunslinger Subclass: Laserist\nMaster High-Tech Blaster Weapons\nLevel 3: Beam Shot [Maneuver]\nYou replace one attack with a laser shot.\nLevel 6: Charge Shot\nYour weapon charges.\nMANEUVER OPTIONS\nThe maneuvers are presented in alphabetical order.\nBite the Bullet\nYou gain Temporary Hit Points.",
      "Features Box_6":
        "Artillerist\nShip Feat\nYou know ship weapons.\nMarksman's Luck\nYou gain lucky benefits.\nMerc\nYou gain blaster benefits.\nVect: Upgraded\nSpecies Feat (Prerequisite: Level 1, Vect)\nYou improve your configuration.",
      "Features Box_7":
        "SCOUNDREL\nAbility Scores: Dexterity, Constitution, Charisma\nFeat: Gambler\nEquipment: Choose A or B: (A) 20 CR\nCR; or (B) 50 CR\nFrom an early age, the streets taught you to survive.\nGambler\nOrigin Feat\nYou gain benefits with games of chance.",
      "Features Box_9":
        "Bounty Hunter's Vest\nArmor (Tactical Nanofiber Vest/Studded Leather Armor), Uncommon\nThe vest hides weapons.\nHardlight Bracer\nWondrous Item, Uncommon\nThis bracer produces a Hardlight Dart.\nLaser Eyes\nConstruct Graft (Head Slot), Uncommon\nThese eyes contain laser emitters.\nThe Laser Eyes have the following traits:\nWeapon Category: Simple Ranged\nDamage on a Hit: 2d4 Radiant\nProperties: Blaster (Range 50/200 feet), Firearm"
    });

    expect(character.name).toBe("HK-69");
    expect(character.level).toBe(6);
    expect(character.className).toBe("Gunslinger");
    expect(character.subclass).toBe("Laserist");
    expect(character.species).toBe("Vect");
    expect(character.background).toBe("Scoundrel");
    expect(character.abilities.dex).toBe(20);
    expect(character.hp.value).toBe(39);
    expect(character.hp.max).toBe(39);
    expect(character.ac).toBe(18);
    expect(character.speed).toBe(30);
    expect(character.proficiencyBonus).toBe(3);
    expect(character.credits).toBe(100);

    const featureNames = character.features.map((feature) => feature.name);
    expect(featureNames).toEqual([
      "Quick Draw",
      "Risk",
      "Beam Shot",
      "Charge Shot",
      "Bite the Bullet",
      "Artillerist",
      "Marksman's Luck",
      "Merc",
      "Vect: Upgraded",
      "Gambler"
    ]);
    expect(featureNames).not.toContain("Laserist");
    expect(featureNames).not.toContain("SCOUNDREL");
    expect(featureNames).not.toContain("CR; or (B) 50 CR");
    expect(featureNames).not.toContain("MANEUVER OPTIONS");

    const inventoryNames = character.inventory.map((item) => item.name);
    expect(inventoryNames).toEqual([
      "Antimatter Dagger",
      "2 Pouches",
      "Thieves' Tools",
      "Traveler's Clothes (streetwear)",
      "Bounty Hunter's Vest",
      "Repeater",
      "Magnus",
      "Spacer's Pack",
      "Hardlight Bracer",
      "Laser Eyes",
      "Hardlight Dart"
    ]);
    expect(inventoryNames).not.toContain("The Laser Eyes have the following traits:");
    expect(inventoryNames).not.toContain("Damage on a Hit: 2d4 Radiant");
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
