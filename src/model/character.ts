export interface AbilityScores {
  str: number;
  dex: number;
  con: number;
  int: number;
  wis: number;
  cha: number;
}

export interface CharacterFeature {
  name: string;
  description: string;
}

export interface CharacterInventoryItem {
  name: string;
  description: string;
}

export interface CharacterModel {
  name: string;
  level: number;
  className: string;
  subclass: string;
  species: string;
  background: string;
  abilities: AbilityScores;
  hp: {
    value: number;
    max: number;
    temp: number;
  };
  ac: number;
  speed: number;
  proficiencyBonus: number;
  credits: number;
  features: CharacterFeature[];
  inventory: CharacterInventoryItem[];
  spells: string[];
}
