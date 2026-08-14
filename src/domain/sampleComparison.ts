import { calculate, Move, Pokemon } from '@smogon/calc';
import type { StatsTable } from '@smogon/calc';
import type { BattleSample } from './battleSamples';
import {
  battleItemOffenseMultiplier,
  battleItemSpeedMultiplier,
  getBattleItemOption,
} from './battleItems';
import { applyDirectMultiplier, classifyDamage, defensiveStatForCategory, offensiveStatForCategory } from './damage';
import { resolveAttackHitCount } from './multiHit';
import { BATTLE_LEVEL, GEN, getMoveOption, getSpeciesCalcOverrides, getSpeciesOption } from './pokemonData';
import { classifySpeed, modifiedSpeed } from './speed';
import {
  STAT_POINT_PER_STAT_LIMIT,
  STAT_POINT_TOTAL_LIMIT,
  statPointsToEvs,
  totalStatPoints,
} from './statPoints';
import { CATEGORY_LABELS, EMPTY_SPREAD, type MoveOption, type StatKey, type SurvivalCategory } from './types';
import { championsAbilityGrantsImmunity, championsMoveAbilityEffect } from './championsAbilityEffects';

const NO_ABILITY = 'No Ability';
const NEUTRAL_HELD_ITEM = 'Leftovers';
const EMPTY_BOOSTS: StatsTable = { ...EMPTY_SPREAD };

export interface SampleDamageResult {
  move: MoveOption;
  hp: number;
  minDamage: number;
  maxDamage: number;
  minPercent: number;
  maxPercent: number;
  category: SurvivalCategory;
}

export interface SingleStatPointRecommendation {
  stat: 'atk' | 'spa' | 'spe';
  currentPoints: number;
  currentAddRequired: number | null;
  redistributedRequired: number | null;
  pointsToReallocate: number;
}

export interface DefensePointOption {
  hp: number;
  bulk: number;
  total: number;
  pointsToReallocate: number;
}

export interface DefensePointRecommendation {
  stat: 'def' | 'spd';
  currentAddOptions: DefensePointOption[];
  redistributedOptions: DefensePointOption[];
  maximumInvestment: SampleDamageResult;
}

export interface OutgoingMoveComparison {
  damage: SampleDamageResult;
  recommendation: SingleStatPointRecommendation;
}

export interface IncomingMoveComparison {
  damage: SampleDamageResult;
  recommendation: DefensePointRecommendation;
}

export interface SampleSpeedComparison {
  selfBaseSpeed: number;
  selfFinalSpeed: number;
  targetBaseSpeed: number;
  targetFinalSpeed: number;
  margin: number;
  category: ReturnType<typeof classifySpeed>;
  recommendation: SingleStatPointRecommendation;
}

export interface SampleMatchupResult {
  benchmark: BattleSample;
  outgoing: OutgoingMoveComparison[];
  incoming: IncomingMoveComparison[];
  speed: SampleSpeedComparison;
  strongestOutgoing: OutgoingMoveComparison | null;
  mostDangerousIncoming: IncomingMoveComparison | null;
}

function activeAbility(sample: BattleSample): string {
  return sample.abilityEnabled && sample.ability ? sample.ability : NO_ABILITY;
}

function withStatPoints(sample: BattleSample, updates: Partial<Record<StatKey, number>>, reset = false): BattleSample {
  return {
    ...sample,
    statPoints: {
      ...(reset ? EMPTY_SPREAD : sample.statPoints),
      ...updates,
    },
  };
}

export function calculateSampleDamage(
  attacker: BattleSample,
  defender: BattleSample,
  moveName: string,
): SampleDamageResult | null {
  const moveOption = getMoveOption(moveName);
  const attackerOption = getSpeciesOption(attacker.species);
  const defenderOption = getSpeciesOption(defender.species);
  if (!moveOption || !attackerOption || !defenderOption) return null;

  const attackerAbility = activeAbility(attacker);
  const defenderAbility = activeAbility(defender);
  const abilityEffect = championsMoveAbilityEffect(attacker.ability, attacker.abilityEnabled, moveOption);
  const hitCount = resolveAttackHitCount(
    {
      ability: attacker.ability,
      abilityEnabled: attacker.abilityEnabled,
      hitCount: 'auto',
      item: attacker.item,
    },
    moveOption,
  );
  const move = new Move(GEN, moveOption.name, {
    ability: attackerAbility,
    hits: hitCount?.hits,
  });
  if (abilityEffect.overrides?.basePower !== undefined) move.bp = abilityEffect.overrides.basePower;
  if (abilityEffect.overrides?.type) move.type = abilityEffect.overrides.type as typeof move.type;
  const attackerPokemon = new Pokemon(GEN, attacker.species, {
    overrides: getSpeciesCalcOverrides(attacker.species),
    level: BATTLE_LEVEL,
    ability: attackerAbility,
    nature: attacker.nature,
    evs: statPointsToEvs(attacker.statPoints),
    boosts: EMPTY_BOOSTS,
  });
  const defenderPokemon = new Pokemon(GEN, defender.species, {
    overrides: getSpeciesCalcOverrides(defender.species),
    level: BATTLE_LEVEL,
    ability: defenderAbility,
    item: getBattleItemOption(defender.item).held ? NEUTRAL_HELD_ITEM : undefined,
    nature: defender.nature,
    evs: statPointsToEvs(defender.statPoints),
    boosts: EMPTY_BOOSTS,
  });
  const rawRange: [number, number] = championsAbilityGrantsImmunity(
    defender.ability,
    defender.abilityEnabled,
    moveOption,
  )
    ? [0, 0]
    : calculate(GEN, attackerPokemon, defenderPokemon, move).range();
  const range = applyDirectMultiplier(
    rawRange,
    battleItemOffenseMultiplier(attacker.item, moveOption) * abilityEffect.multiplier,
  );
  const hp = defenderPokemon.maxHP();
  const minPercent = hp > 0 ? (range[0] / hp) * 100 : 0;
  const maxPercent = hp > 0 ? (range[1] / hp) * 100 : 0;

  return {
    move: moveOption,
    hp,
    minDamage: range[0],
    maxDamage: range[1],
    minPercent,
    maxPercent,
    category: classifyDamage(range[0], range[1], hp),
  };
}

function findOffenseRecommendation(
  attacker: BattleSample,
  defender: BattleSample,
  move: MoveOption,
): SingleStatPointRecommendation {
  const stat = offensiveStatForCategory(move.category);
  const currentPoints = attacker.statPoints[stat];
  const remaining = Math.max(0, STAT_POINT_TOTAL_LIMIT - totalStatPoints(attacker.statPoints));
  const currentMaximum = Math.min(STAT_POINT_PER_STAT_LIMIT, currentPoints + remaining);
  let currentAddRequired: number | null = null;
  let redistributedRequired: number | null = null;

  for (let points = currentPoints; points <= currentMaximum; points += 1) {
    const result = calculateSampleDamage(withStatPoints(attacker, { [stat]: points }), defender, move.name);
    if (result?.category === 'ko') {
      currentAddRequired = points;
      break;
    }
  }

  for (let points = 0; points <= STAT_POINT_PER_STAT_LIMIT; points += 1) {
    const result = calculateSampleDamage(withStatPoints(attacker, { [stat]: points }, true), defender, move.name);
    if (result?.category === 'ko') {
      redistributedRequired = points;
      break;
    }
  }

  return {
    stat,
    currentPoints,
    currentAddRequired,
    redistributedRequired,
    pointsToReallocate: redistributedRequired === null
      ? 0
      : Math.max(0, redistributedRequired - currentPoints - remaining),
  };
}

function takeMinimumDefenseOptions(
  options: DefensePointOption[],
  currentHp: number,
  currentBulk: number,
  useAddedTotal: boolean,
): DefensePointOption[] {
  if (options.length === 0) return [];
  const score = (option: DefensePointOption) => useAddedTotal
    ? (option.hp - currentHp) + (option.bulk - currentBulk)
    : option.total;
  const minimum = Math.min(...options.map(score));

  return options
    .filter((option) => score(option) === minimum)
    .sort((left, right) => {
      const leftDistance = Math.abs(left.hp - currentHp) + Math.abs(left.bulk - currentBulk);
      const rightDistance = Math.abs(right.hp - currentHp) + Math.abs(right.bulk - currentBulk);
      return leftDistance - rightDistance || right.hp - left.hp || right.bulk - left.bulk;
    })
    .slice(0, 3);
}

function findDefenseRecommendation(
  defender: BattleSample,
  attacker: BattleSample,
  move: MoveOption,
): DefensePointRecommendation {
  const stat = defensiveStatForCategory(move.category);
  const currentHp = defender.statPoints.hp;
  const currentBulk = defender.statPoints[stat];
  const currentTotal = totalStatPoints(defender.statPoints);
  const remaining = Math.max(0, STAT_POINT_TOTAL_LIMIT - currentTotal);
  const currentCandidates: DefensePointOption[] = [];
  const redistributedCandidates: DefensePointOption[] = [];

  for (let hp = currentHp; hp <= STAT_POINT_PER_STAT_LIMIT; hp += 1) {
    for (let bulk = currentBulk; bulk <= STAT_POINT_PER_STAT_LIMIT; bulk += 1) {
      const added = (hp - currentHp) + (bulk - currentBulk);
      if (added > remaining) continue;
      const result = calculateSampleDamage(attacker, withStatPoints(defender, { hp, [stat]: bulk }), move.name);
      if (result?.category === 'survives') {
        currentCandidates.push({ hp, bulk, total: hp + bulk, pointsToReallocate: 0 });
      }
    }
  }

  for (let hp = 0; hp <= STAT_POINT_PER_STAT_LIMIT; hp += 1) {
    for (let bulk = 0; bulk <= STAT_POINT_PER_STAT_LIMIT; bulk += 1) {
      const result = calculateSampleDamage(
        attacker,
        withStatPoints(defender, { hp, [stat]: bulk }, true),
        move.name,
      );
      if (result?.category === 'survives') {
        redistributedCandidates.push({
          hp,
          bulk,
          total: hp + bulk,
          pointsToReallocate: Math.max(0, hp + bulk - currentHp - currentBulk - remaining),
        });
      }
    }
  }

  const maximumInvestment = calculateSampleDamage(
    attacker,
    withStatPoints(defender, { hp: STAT_POINT_PER_STAT_LIMIT, [stat]: STAT_POINT_PER_STAT_LIMIT }, true),
    move.name,
  );

  return {
    stat,
    currentAddOptions: takeMinimumDefenseOptions(currentCandidates, currentHp, currentBulk, true),
    redistributedOptions: takeMinimumDefenseOptions(redistributedCandidates, currentHp, currentBulk, false),
    maximumInvestment: maximumInvestment ?? {
      move,
      hp: 0,
      minDamage: 0,
      maxDamage: 0,
      minPercent: 0,
      maxPercent: 0,
      category: 'survives',
    },
  };
}

export function calculateSampleSpeed(sample: BattleSample): { base: number; final: number } {
  const pokemon = new Pokemon(GEN, sample.species, {
    overrides: getSpeciesCalcOverrides(sample.species),
    level: BATTLE_LEVEL,
    nature: sample.nature,
    evs: statPointsToEvs({ spe: sample.statPoints.spe }),
  });
  const base = pokemon.stats.spe;
  return { base, final: modifiedSpeed(base, 0, battleItemSpeedMultiplier(sample.item), 1) };
}

function calculateSpeedComparison(self: BattleSample, target: BattleSample): SampleSpeedComparison {
  const selfSpeed = calculateSampleSpeed(self);
  const targetSpeed = calculateSampleSpeed(target);
  const currentPoints = self.statPoints.spe;
  const remaining = Math.max(0, STAT_POINT_TOTAL_LIMIT - totalStatPoints(self.statPoints));
  const currentMaximum = Math.min(STAT_POINT_PER_STAT_LIMIT, currentPoints + remaining);
  let currentAddRequired: number | null = null;
  let redistributedRequired: number | null = null;

  for (let points = currentPoints; points <= currentMaximum; points += 1) {
    if (calculateSampleSpeed(withStatPoints(self, { spe: points })).final > targetSpeed.final) {
      currentAddRequired = points;
      break;
    }
  }

  for (let points = 0; points <= STAT_POINT_PER_STAT_LIMIT; points += 1) {
    if (calculateSampleSpeed(withStatPoints(self, { spe: points }, true)).final > targetSpeed.final) {
      redistributedRequired = points;
      break;
    }
  }

  const margin = selfSpeed.final - targetSpeed.final;
  return {
    selfBaseSpeed: selfSpeed.base,
    selfFinalSpeed: selfSpeed.final,
    targetBaseSpeed: targetSpeed.base,
    targetFinalSpeed: targetSpeed.final,
    margin,
    category: classifySpeed(selfSpeed.final, targetSpeed.final),
    recommendation: {
      stat: 'spe',
      currentPoints,
      currentAddRequired,
      redistributedRequired,
      pointsToReallocate: redistributedRequired === null
        ? 0
        : Math.max(0, redistributedRequired - currentPoints - remaining),
    },
  };
}

function byMaximumPercent<T extends { damage: SampleDamageResult }>(left: T, right: T): number {
  return right.damage.maxPercent - left.damage.maxPercent;
}

export function calculateSampleMatchup(self: BattleSample, benchmark: BattleSample): SampleMatchupResult {
  const outgoing = self.moves
    .map((moveName) => {
      const damage = calculateSampleDamage(self, benchmark, moveName);
      return damage ? { damage, recommendation: findOffenseRecommendation(self, benchmark, damage.move) } : null;
    })
    .filter((result): result is OutgoingMoveComparison => Boolean(result))
    .sort(byMaximumPercent);
  const incoming = benchmark.moves
    .map((moveName) => {
      const damage = calculateSampleDamage(benchmark, self, moveName);
      return damage ? { damage, recommendation: findDefenseRecommendation(self, benchmark, damage.move) } : null;
    })
    .filter((result): result is IncomingMoveComparison => Boolean(result))
    .sort(byMaximumPercent);

  return {
    benchmark,
    outgoing,
    incoming,
    speed: calculateSpeedComparison(self, benchmark),
    strongestOutgoing: outgoing[0] ?? null,
    mostDangerousIncoming: incoming[0] ?? null,
  };
}

export function describeDamageCategory(category: SurvivalCategory): string {
  return CATEGORY_LABELS[category];
}
