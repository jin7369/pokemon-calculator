import { calculate, Move, Pokemon } from '@smogon/calc';
import type { StatsTable } from '@smogon/calc';
import type {
  AttackConfig,
  DamageResult,
  DamageSummary,
  DefenseConfig,
  DefenderBulkConfig,
  MoveCategory,
  SortKey,
  SpeciesOption,
  StatKey,
  SurvivalCategory,
} from './types';
import {
  BATTLE_LEVEL,
  GEN,
  getMoveOption,
  getSpeciesCalcOverrides,
  getSpeciesOption,
  POKEMON_OPTIONS,
} from './pokemonData';
import { combinedAttackMultiplier } from './offenseItems';
import { resolveAttackHitCount } from './multiHit';
import { statPointsToEvs } from './statPoints';
import { getBattleItemOption } from './battleItems';
import { championsAbilityGrantsImmunity, championsMoveAbilityEffect } from './championsAbilityEffects';

const EMPTY_BOOSTS: StatsTable = {
  hp: 0,
  atk: 0,
  def: 0,
  spa: 0,
  spd: 0,
  spe: 0,
};
const NO_ABILITY = 'No Ability';
const NEUTRAL_HELD_ITEM = 'Leftovers';

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
  const abilityEffect = championsMoveAbilityEffect(attack.ability, attack.abilityEnabled, moveOption);
  const finalMultiplier = combinedAttackMultiplier(attack.item, moveOption, attack.directMultiplier)
    * abilityEffect.multiplier;
  const attackerAbility = attack.abilityEnabled && attack.ability ? attack.ability : NO_ABILITY;
  const resolvedHitCount = resolveAttackHitCount(attack, moveOption);
  const attackerEvs = statPointsToEvs({
    [offensiveStat]: attack.attackStatPoints[offensiveStat],
  });
  const defenderEvs = statPointsToEvs(defenderBulk.statPoints);
  const move = new Move(GEN, moveOption.name, {
    ability: attackerAbility,
    hits: resolvedHitCount?.hits,
  });
  if (abilityEffect.overrides?.basePower !== undefined) move.bp = abilityEffect.overrides.basePower;
  if (abilityEffect.overrides?.type) move.type = abilityEffect.overrides.type as typeof move.type;
  const attacker = new Pokemon(GEN, attack.attacker, {
    overrides: getSpeciesCalcOverrides(attack.attacker),
    level: BATTLE_LEVEL,
    ability: attackerAbility,
    nature: attack.nature,
    evs: attackerEvs,
    boosts: buildBoosts(offensiveStat, attack.boostStage),
  });

  const results: DamageResult[] = [];

  for (const target of targets) {
    try {
      const defender = new Pokemon(GEN, target.name, {
        overrides: getSpeciesCalcOverrides(target.name),
        level: BATTLE_LEVEL,
        ability: NO_ABILITY,
        item: defenderBulk.targetHasHeldItem ? NEUTRAL_HELD_ITEM : undefined,
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

export function calculateDefenseResults(
  defense: DefenseConfig,
  attackers: SpeciesOption[],
): { results: DamageResult[]; summary: DamageSummary } {
  const moveOption = getMoveOption(defense.move);
  const defenderOption = getSpeciesOption(defense.defender);
  if (!moveOption || !defenderOption) return { results: [], summary: summarizeResults([]) };

  const offensiveStat = offensiveStatForCategory(moveOption.category);
  const finalMultiplier = combinedAttackMultiplier(
    defense.attackerItem,
    moveOption,
    defense.attackerDirectMultiplier,
  );
  const resolvedHitCount = resolveAttackHitCount(
    {
      ability: NO_ABILITY,
      abilityEnabled: false,
      hitCount: defense.hitCount,
      item: defense.attackerItem,
    },
    moveOption,
  );
  const attackerEvs = statPointsToEvs({
    [offensiveStat]: defense.attackerStatPoints[offensiveStat],
  });
  const defenderEvs = statPointsToEvs(defense.statPoints);
  const defenderAbility = defense.defenderAbilityEnabled && defense.defenderAbility
    ? defense.defenderAbility
    : NO_ABILITY;
  const defenderHasHeldItem = defense.defenderItem
    ? getBattleItemOption(defense.defenderItem).held
    : defense.defenderHasHeldItem;
  const move = new Move(GEN, moveOption.name, {
    ability: NO_ABILITY,
    hits: resolvedHitCount?.hits,
  });
  const defender = new Pokemon(GEN, defenderOption.name, {
    overrides: getSpeciesCalcOverrides(defenderOption.name),
    level: BATTLE_LEVEL,
    ability: defenderAbility,
    item: defenderHasHeldItem ? NEUTRAL_HELD_ITEM : undefined,
    nature: defense.nature,
    evs: defenderEvs,
  });
  const hp = defender.maxHP();

  const results: DamageResult[] = [];

  for (const attackerOption of attackers) {
    try {
      const attacker = new Pokemon(GEN, attackerOption.name, {
        overrides: getSpeciesCalcOverrides(attackerOption.name),
        level: BATTLE_LEVEL,
        ability: NO_ABILITY,
        nature: defense.attackerNature,
        evs: attackerEvs,
        boosts: buildBoosts(offensiveStat, defense.attackerBoostStage),
      });
      const rawRange: [number, number] = championsAbilityGrantsImmunity(
        defenderAbility,
        defense.defenderAbilityEnabled ?? false,
        moveOption,
      )
        ? [0, 0]
        : calculate(GEN, attacker, defender, move).range();
      const [minDamage, maxDamage] = applyDirectMultiplier(rawRange, finalMultiplier);
      const minPercent = hp > 0 ? (minDamage / hp) * 100 : 0;
      const maxPercent = hp > 0 ? (maxDamage / hp) * 100 : 0;

      results.push({
        id: attackerOption.id,
        name: attackerOption.name,
        displayName: attackerOption.displayName ?? attackerOption.name,
        types: attackerOption.types,
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


