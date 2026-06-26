import { Pokemon } from '@smogon/calc';
import type {
  SpeedCategory,
  SpeedConfig,
  SpeedResult,
  SpeedSortKey,
  SpeedSummary,
  SpeciesOption,
} from './types';
import { BATTLE_LEVEL, GEN, getSpeciesOption, POKEMON_OPTIONS } from './pokemonData';
import { statPointsToEvs } from './statPoints';
import { speedItemMultiplier } from './speedItems';

function speedStageMultiplier(stage: number): number {
  if (stage >= 0) return (2 + stage) / 2;
  return 2 / (2 - stage);
}

export function modifiedSpeed(
  baseSpeed: number,
  boostStage: number,
  itemMultiplier: number,
  directMultiplier: number,
): number {
  const afterBoost = Math.floor(baseSpeed * speedStageMultiplier(boostStage));
  return Math.floor(afterBoost * itemMultiplier * directMultiplier);
}

export function classifySpeed(selfSpeed: number, targetSpeed: number): SpeedCategory {
  if (selfSpeed > targetSpeed) return 'outspeeds';
  if (selfSpeed < targetSpeed) return 'slower';
  return 'tie';
}

function summarizeSpeedResults(results: SpeedResult[]): SpeedSummary {
  return results.reduce<SpeedSummary>(
    (summary, result) => ({
      ...summary,
      [result.category]: summary[result.category] + 1,
      total: summary.total + 1,
    }),
    { outspeeds: 0, tie: 0, slower: 0, total: 0 },
  );
}

export function sortSpeedResults(results: SpeedResult[], sortKey: SpeedSortKey): SpeedResult[] {
  const sorted = [...results];
  const byName = (left: SpeedResult, right: SpeedResult) =>
    left.displayName.localeCompare(right.displayName, 'ko') || left.name.localeCompare(right.name, 'en');

  switch (sortKey) {
    case 'targetSpeedDesc':
      return sorted.sort((left, right) => right.targetFinalSpeed - left.targetFinalSpeed || byName(left, right));
    case 'targetSpeedAsc':
      return sorted.sort((left, right) => left.targetFinalSpeed - right.targetFinalSpeed || byName(left, right));
    case 'nameAsc':
      return sorted.sort(byName);
    case 'marginDesc':
    default:
      return sorted.sort((left, right) => right.margin - left.margin || byName(left, right));
  }
}

function speedStatForSpecies(speciesName: string, nature: string, speedPoints: number): number {
  const pokemon = new Pokemon(GEN, speciesName, {
    level: BATTLE_LEVEL,
    nature,
    evs: statPointsToEvs({ spe: speedPoints }),
  });

  return pokemon.stats.spe;
}

export function calculateSpeedResults(
  speed: SpeedConfig,
  targets: SpeciesOption[] = POKEMON_OPTIONS,
): { results: SpeedResult[]; summary: SpeedSummary } {
  const selfOption = getSpeciesOption(speed.pokemon);
  if (!selfOption) return { results: [], summary: summarizeSpeedResults([]) };

  const selfBaseSpeed = speedStatForSpecies(selfOption.name, speed.nature, speed.statPoints.spe);
  const selfFinalSpeed = modifiedSpeed(
    selfBaseSpeed,
    speed.boostStage,
    speedItemMultiplier(speed.item),
    speed.directMultiplier,
  );
  const results: SpeedResult[] = [];

  for (const target of targets) {
    try {
      const targetBaseSpeed = speedStatForSpecies(target.name, speed.targetNature, speed.targetStatPoints.spe);
      const targetFinalSpeed = modifiedSpeed(
        targetBaseSpeed,
        speed.targetBoostStage,
        speedItemMultiplier(speed.targetItem),
        speed.targetDirectMultiplier,
      );
      const margin = selfFinalSpeed - targetFinalSpeed;

      results.push({
        id: target.id,
        name: target.name,
        displayName: target.displayName ?? target.name,
        types: target.types,
        selfBaseSpeed,
        selfFinalSpeed,
        targetBaseSpeed,
        targetFinalSpeed,
        margin,
        category: classifySpeed(selfFinalSpeed, targetFinalSpeed),
      });
    } catch {
      // Some calculation-only forms can be incompatible with stat construction.
    }
  }

  return { results, summary: summarizeSpeedResults(results) };
}
