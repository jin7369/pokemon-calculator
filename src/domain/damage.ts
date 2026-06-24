import { calculate, Move, Pokemon } from '@smogon/calc';
import type { StatsTable } from '@smogon/calc';
import type {
  AttackConfig,
  DamageResult,
  DamageSummary,
  DefenderBulkConfig,
  MoveCategory,
  SortKey,
  SpeciesOption,
  StatKey,
  SurvivalCategory,
} from './types';
import { BATTLE_LEVEL, GEN, getMoveOption, POKEMON_OPTIONS } from './pokemonData';
import { combinedAttackMultiplier } from './offenseItems';
import { statPointsToEvs } from './statPoints';

const EMPTY_BOOSTS: StatsTable = {
  hp: 0,
  atk: 0,
  def: 0,
  spa: 0,
  spd: 0,
  spe: 0,
};

export function offensiveStatForCategory(category: MoveCategory): 'atk' | 'spa' {
  return category === 'Physical' ? 'atk' : 'spa';
}

export function defensiveStatForCategory(category: MoveCategory): 'def' | 'spd' {
  return category === 'Physical' ? 'def' : 'spd';
}

export function classifyDamage(
  minDamage: number,
  maxDamage: number,
  hp: number,
): SurvivalCategory {
  if (maxDamage < hp) return 'survives';
  if (minDamage >= hp) return 'ko';
  return 'roll';
}

export function applyDirectMultiplier(
  range: [number, number],
  multiplier: number,
): [number, number] {
  if (multiplier === 1) return range;

  return range.map((damage) => {
    if (damage <= 0) return 0;
    return Math.max(1, Math.floor(damage * multiplier));
  }) as [number, number];
}

export function summarizeResults(results: DamageResult[]): DamageSummary {
  return results.reduce<DamageSummary>(
    (summary, result) => ({
      ...summary,
      [result.category]: summary[result.category] + 1,
      total: summary.total + 1,
    }),
    { survives: 0, roll: 0, ko: 0, total: 0 },
  );
}

export function sortResults(results: DamageResult[], sortKey: SortKey): DamageResult[] {
  const sorted = [...results];

  switch (sortKey) {
    case 'maxPercentAsc':
      return sorted.sort((left, right) => left.maxPercent - right.maxPercent);
    case 'nameAsc':
      return sorted.sort((left, right) => (left.displayName ?? left.name).localeCompare(right.displayName ?? right.name, 'ko'));
    case 'hpDesc':
      return sorted.sort((left, right) => right.hp - left.hp || (left.displayName ?? left.name).localeCompare(right.displayName ?? right.name, 'ko'));
    case 'maxPercentDesc':
    default:
      return sorted.sort((left, right) => right.maxPercent - left.maxPercent || (left.displayName ?? left.name).localeCompare(right.displayName ?? right.name, 'ko'));
  }
}

function buildBoosts(stat: StatKey, stage: number): StatsTable {
  return { ...EMPTY_BOOSTS, [stat]: stage };
}

export function calculateAttackResults(
  attack: AttackConfig,
  defenderBulk: DefenderBulkConfig,
  targets: SpeciesOption[] = POKEMON_OPTIONS,
): { results: DamageResult[]; summary: DamageSummary } {
  const moveOption = getMoveOption(attack.move);
  if (!moveOption) return { results: [], summary: summarizeResults([]) };

  const offensiveStat = offensiveStatForCategory(moveOption.category);
  const finalMultiplier = combinedAttackMultiplier(attack.item, moveOption, attack.directMultiplier);
  const attackerEvs = statPointsToEvs({
    [offensiveStat]: attack.attackStatPoints[offensiveStat],
  });
  const defenderEvs = statPointsToEvs(defenderBulk.statPoints);
  const move = new Move(GEN, moveOption.name);
  const attacker = new Pokemon(GEN, attack.attacker, {
    level: BATTLE_LEVEL,
    nature: attack.nature,
    evs: attackerEvs,
    boosts: buildBoosts(offensiveStat, attack.boostStage),
  });

  const results: DamageResult[] = [];

  for (const target of targets) {
    try {
      const defender = new Pokemon(GEN, target.name, {
        level: BATTLE_LEVEL,
        nature: defenderBulk.nature,
        evs: defenderEvs,
      });
      const rawRange = calculate(GEN, attacker, defender, move).range();
      const [minDamage, maxDamage] = applyDirectMultiplier(rawRange, finalMultiplier);
      const hp = defender.maxHP();
      const minPercent = hp > 0 ? (minDamage / hp) * 100 : 0;
      const maxPercent = hp > 0 ? (maxDamage / hp) * 100 : 0;

      results.push({
        id: target.id,
        name: target.name,
        displayName: target.displayName ?? target.name,
        types: target.types,
        hp,
        minDamage,
        maxDamage,
        minPercent,
        maxPercent,
        category: classifyDamage(minDamage, maxDamage, hp),
      });
    } catch {
      // Some legacy or special forms in the data set can be incompatible with a move calculation.
    }
  }

  return { results, summary: summarizeResults(results) };
}


