import { Generations, toID } from '@smogon/calc';
import { MOVE_KOREAN_NAMES } from '../data/moveKoreanNames';
import { MOVE_NAME_OVERRIDES } from '../data/moveNameOverrides';
import { POKEMON_KOREAN_NAMES } from '../data/pokemonKoreanNames';
import { CHAMPIONS_CURRENT_RULESET } from '../data/championsRulesets';
import type { StatKey, SpeciesOption, MoveOption, MoveCategory } from './types';
import { STAT_LABELS } from './types';

export const GEN = Generations.get(9);
export const BATTLE_LEVEL = 50;
export const POKEMON_RULESET = CHAMPIONS_CURRENT_RULESET;

interface CalcSpecies {
  id: string;
  name: string;
  baseSpecies?: string;
  types: string[];
  baseStats: Record<StatKey, number>;
}

interface CalcMove {
  id: string;
  name: string;
  type: string;
  category?: string;
  basePower?: number;
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

const ALL_SPECIES = Array.from(GEN.species).map((species) => species as CalcSpecies);
const speciesDataByName = new Map(ALL_SPECIES.map((species) => [species.name, species]));
const championsBaseSpecies = new Set(POKEMON_RULESET.baseSpecies);
const championsExactSpecies = new Set([
  ...POKEMON_RULESET.baseSpecies,
  ...POKEMON_RULESET.exactSpecies,
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
  if (championsExactSpecies.has(species.name)) return true;

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

