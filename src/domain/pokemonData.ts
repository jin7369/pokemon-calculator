import { Generations, toID } from '@smogon/calc';
import { MOVE_KOREAN_NAMES } from '../data/moveKoreanNames';
import { MOVE_NAME_OVERRIDES } from '../data/moveNameOverrides';
import { POKEMON_KOREAN_NAMES } from '../data/pokemonKoreanNames';
import { CHAMPIONS_CURRENT_RULESET } from '../data/championsRulesets';
import { LEARNABLE_ATTACK_MOVE_IDS_BY_SPECIES } from '../data/learnableAttackMoves';
import { POKEMON_ABILITY_NAMES_BY_SPECIES } from '../data/pokemonAbilities';
import type { StatKey, SpeciesOption, MoveOption, MoveCategory, MoveMultiHitOption } from './types';
import { STAT_LABELS } from './types';

export const GEN = Generations.get(9);
export const BATTLE_LEVEL = 50;
export const POKEMON_RULESET = CHAMPIONS_CURRENT_RULESET;

interface CalcSpecies {
  id: string;
  name: string;
  baseSpecies?: string;
  types: string[];
  abilities?: Record<string, string>;
  baseStats: Record<StatKey, number>;
}

interface CalcMove {
  id: string;
  name: string;
  type: string;
  category?: string;
  basePower?: number;
  multihit?: number | number[];
  multiaccuracy?: boolean;
}

function compareByName<T extends { name: string }>(left: T, right: T): number {
  return left.name.localeCompare(right.name, 'en');
}

function compareByDisplayName<T extends { displayName: string; name: string }>(left: T, right: T): number {
  return left.displayName.localeCompare(right.displayName, 'ko') || left.name.localeCompare(right.name, 'en');
}

function koreanPokemonNameFor(name: string): string {
  return POKEMON_KOREAN_NAMES[name as keyof typeof POKEMON_KOREAN_NAMES] ?? name;
}

function koreanMoveNameFor(name: string): string {
  return MOVE_NAME_OVERRIDES[name] ?? MOVE_KOREAN_NAMES[name as keyof typeof MOVE_KOREAN_NAMES] ?? name;
}

function abilityOptionsForSpecies(species: CalcSpecies): string[] {
  const generatedAbilities =
    POKEMON_ABILITY_NAMES_BY_SPECIES[species.name as keyof typeof POKEMON_ABILITY_NAMES_BY_SPECIES];
  const abilities = generatedAbilities ?? Object.values(species.abilities ?? {});

  return [
    ...new Set(
      abilities.filter((ability) => typeof ability === 'string' && ability.length > 0),
    ),
  ]
    .sort((left, right) => left.localeCompare(right, 'en'));
}

function rangeInclusive(min: number, max: number): number[] {
  return Array.from({ length: max - min + 1 }, (_, index) => min + index);
}

function multiHitOptionForMove(move: CalcMove): MoveMultiHitOption | undefined {
  const multiHit = move.multihit;
  if (!multiHit) return undefined;

  if (Array.isArray(multiHit)) {
    const [min, max] = multiHit;

    return {
      min,
      max,
      defaultHits: min + 1,
      selectableHits: rangeInclusive(min, max),
      supportsSkillLink: min === 2 && max === 5,
      supportsLoadedDice: min === 2 && max === 5,
      multiAccuracy: Boolean(move.multiaccuracy),
    };
  }

  return {
    min: move.multiaccuracy ? 1 : multiHit,
    max: multiHit,
    defaultHits: multiHit,
    selectableHits: move.multiaccuracy ? rangeInclusive(1, multiHit) : [multiHit],
    supportsSkillLink: false,
    supportsLoadedDice: false,
    multiAccuracy: Boolean(move.multiaccuracy),
  };
}

const ALL_SPECIES = Array.from(GEN.species).map((species) => species as CalcSpecies);
const speciesDataByName = new Map(ALL_SPECIES.map((species) => [species.name, species]));
const championsBaseSpecies = new Set(POKEMON_RULESET.baseSpecies);
const championsSelectableSpecies = new Set([
  ...POKEMON_RULESET.baseSpecies,
  ...POKEMON_RULESET.exactSpecies,
  ...POKEMON_RULESET.derivedSpecies,
]);

function baseSpeciesFor(name: string): string {
  return speciesDataByName.get(name)?.baseSpecies ?? name;
}

function formSuffixFor(name: string): string | null {
  const baseSpecies = baseSpeciesFor(name);
  if (baseSpecies === name) return null;

  const prefix = `${baseSpecies}-`;
  return name.startsWith(prefix) ? name.slice(prefix.length) : null;
}

function isMegaSpecies(species: CalcSpecies): boolean {
  return species.name.includes('-Mega');
}

function isRulesetSpecies(species: CalcSpecies): boolean {
  if (championsSelectableSpecies.has(species.name)) return true;

  const baseSpecies = species.baseSpecies ?? species.name;
  return POKEMON_RULESET.includeMegaForms && isMegaSpecies(species) && championsBaseSpecies.has(baseSpecies);
}

export function displayNameForSpecies(name: string): string {
  const koreanName = koreanPokemonNameFor(name);
  const baseName = baseSpeciesFor(name);
  const baseKoreanName = koreanPokemonNameFor(baseName);
  const suffix = formSuffixFor(name);

  if (suffix && koreanName === baseKoreanName) {
    return `${koreanName} (${suffix})`;
  }

  return koreanName;
}

export function displayNameForMove(name: string): string {
  return koreanMoveNameFor(name);
}

function disambiguateDuplicateSpeciesDisplayNames(options: SpeciesOption[]): SpeciesOption[] {
  const displayNameCounts = new Map<string, number>();

  for (const option of options) {
    displayNameCounts.set(option.displayName, (displayNameCounts.get(option.displayName) ?? 0) + 1);
  }

  return options.map((option) => {
    if ((displayNameCounts.get(option.displayName) ?? 0) <= 1) return option;

    const suffix = formSuffixFor(option.name);
    return suffix ? { ...option, displayName: `${option.displayName} (${suffix})` } : option;
  });
}

const RAW_POKEMON_OPTIONS: SpeciesOption[] = ALL_SPECIES
  .filter((species) => Boolean(species.name && species.baseStats?.hp))
  .filter(isRulesetSpecies)
  .map((species) => ({
    id: species.id || toID(species.name),
    name: species.name,
    displayName: displayNameForSpecies(species.name),
    types: [...species.types],
    abilities: abilityOptionsForSpecies(species),
    baseStats: { ...species.baseStats },
  }));

export const POKEMON_OPTIONS: SpeciesOption[] = disambiguateDuplicateSpeciesDisplayNames(RAW_POKEMON_OPTIONS)
  .sort(compareByDisplayName);

export const MOVE_OPTIONS: MoveOption[] = Array.from(GEN.moves)
  .map((move) => move as CalcMove)
  .filter(
    (move) =>
      (move.category === 'Physical' || move.category === 'Special') &&
      (move.basePower ?? 0) > 0,
  )
  .map((move) => ({
    id: move.id || toID(move.name),
    name: move.name,
    displayName: displayNameForMove(move.name),
    type: move.type,
    category: move.category as MoveCategory,
    basePower: move.basePower ?? 0,
    multiHit: multiHitOptionForMove(move),
  }))
  .sort(compareByDisplayName);

export const NATURE_OPTIONS = Array.from(GEN.natures)
  .map((nature) => {
    const plus = nature.plus as StatKey | undefined;
    const minus = nature.minus as StatKey | undefined;
    const modifier = plus && minus && plus !== minus
      ? `+${STAT_LABELS[plus]} / -${STAT_LABELS[minus]}`
      : '보정 없음';

    return {
      id: nature.id,
      name: nature.name,
      label: `${nature.name} (${modifier})`,
    };
  })
  .sort(compareByName);

const speciesNameIndex = new Map<string, string>();

for (const species of POKEMON_OPTIONS) {
  for (const alias of [species.displayName, species.name, species.id]) {
    const normalized = alias.trim().toLowerCase();
    if (!speciesNameIndex.has(normalized)) {
      speciesNameIndex.set(normalized, species.name);
    }
  }
}

const moveNameIndex = new Map<string, string>();

for (const move of MOVE_OPTIONS) {
  for (const alias of [move.displayName, move.name, move.id]) {
    const normalized = alias.trim().toLowerCase();
    if (!moveNameIndex.has(normalized)) {
      moveNameIndex.set(normalized, move.name);
    }
  }
}

const moveByName = new Map(MOVE_OPTIONS.map((move) => [move.name, move]));
const moveById = new Map(MOVE_OPTIONS.map((move) => [move.id, move]));
const speciesByName = new Map(POKEMON_OPTIONS.map((species) => [species.name, species]));

export function resolveSpeciesName(input: string): string | null {
  return speciesNameIndex.get(input.trim().toLowerCase()) ?? null;
}

export function resolveMoveName(input: string): string | null {
  return moveNameIndex.get(input.trim().toLowerCase()) ?? null;
}

export function getMoveOption(name: string): MoveOption | null {
  return moveByName.get(name) ?? null;
}

export function getSpeciesOption(name: string): SpeciesOption | null {
  return speciesByName.get(name) ?? null;
}

export function getLearnableAttackMoveOptionsForSpecies(name: string | null): MoveOption[] {
  if (!name) return [];

  const moveIds = LEARNABLE_ATTACK_MOVE_IDS_BY_SPECIES[name as keyof typeof LEARNABLE_ATTACK_MOVE_IDS_BY_SPECIES] ?? [];
  return moveIds
    .map((moveId) => moveById.get(moveId))
    .filter((move): move is MoveOption => Boolean(move))
    .sort(compareByDisplayName);
}

