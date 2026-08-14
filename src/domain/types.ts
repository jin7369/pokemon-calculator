import type { StatID } from '@smogon/calc';

export type StatKey = StatID;
export type CombatStatKey = Exclude<StatKey, 'hp'>;
export type NatureStatKey = CombatStatKey;
export type MoveCategory = 'Physical' | 'Special';
export type SortKey = 'maxPercentDesc' | 'maxPercentAsc' | 'nameAsc' | 'hpDesc';
export type SurvivalCategory = 'survives' | 'roll' | 'ko';
export type SpeedSortKey = 'marginAsc' | 'marginDesc' | 'targetSpeedDesc' | 'targetSpeedAsc' | 'nameAsc';
export type SpeedCategory = 'outspeeds' | 'tie' | 'slower';
export type HitCountSetting = 'auto' | number;

export type StatPointSpread = Record<StatKey, number>;

export interface SpeciesOption {
  id: string;
  name: string;
  displayName: string;
  types: string[];
  abilities: string[];
  baseStats: Record<StatKey, number>;
}

export interface MoveOption {
  id: string;
  name: string;
  displayName: string;
  type: string;
  category: MoveCategory;
  basePower: number;
  multiHit?: MoveMultiHitOption;
}

export interface MoveMultiHitOption {
  min: number;
  max: number;
  defaultHits: number;
  selectableHits: number[];
  supportsSkillLink: boolean;
  supportsLoadedDice: boolean;
  multiAccuracy: boolean;
}

export interface AttackConfig {
  attacker: string;
  move: string;
  item: string;
  ability: string;
  abilityEnabled: boolean;
  hitCount: HitCountSetting;
  nature: string;
  attackStatPoints: Pick<StatPointSpread, 'atk' | 'spa'>;
  boostStage: number;
  directMultiplier: number;
}

export interface DefenseConfig {
  defender: string;
  move: string;
  nature: string;
  statPoints: Pick<StatPointSpread, 'hp' | 'def' | 'spd'>;
  defenderHasHeldItem: boolean;
  defenderAbility?: string;
  defenderAbilityEnabled?: boolean;
  defenderItem?: string;
  attackerNature: string;
  attackerStatPoints: Pick<StatPointSpread, 'atk' | 'spa'>;
  attackerBoostStage: number;
  attackerItem: string;
  attackerDirectMultiplier: number;
  hitCount: HitCountSetting;
}

export interface SpeedConfig {
  pokemon: string;
  nature: string;
  statPoints: Pick<StatPointSpread, 'spe'>;
  boostStage: number;
  item: string;
  directMultiplier: number;
  targetNature: string;
  targetStatPoints: Pick<StatPointSpread, 'spe'>;
  targetBoostStage: number;
  targetItem: string;
  targetDirectMultiplier: number;
}

export interface DefenderBulkConfig {
  nature: string;
  statPoints: Pick<StatPointSpread, 'hp' | 'def' | 'spd'>;
  targetHasHeldItem: boolean;
}

export interface DamageResult {
  id: string;
  name: string;
  displayName: string;
  types: string[];
  hp: number;
  minDamage: number;
  maxDamage: number;
  minPercent: number;
  maxPercent: number;
  category: SurvivalCategory;
}

export interface DamageSummary {
  survives: number;
  roll: number;
  ko: number;
  total: number;
}

export interface SpeedResult {
  id: string;
  name: string;
  displayName: string;
  types: string[];
  selfBaseSpeed: number;
  selfFinalSpeed: number;
  targetBaseSpeed: number;
  targetFinalSpeed: number;
  margin: number;
  category: SpeedCategory;
}

export interface SpeedSummary {
  outspeeds: number;
  tie: number;
  slower: number;
  total: number;
}

export const STAT_KEYS: StatKey[] = ['hp', 'atk', 'def', 'spa', 'spd', 'spe'];
export const NATURE_STAT_KEYS: NatureStatKey[] = ['atk', 'def', 'spa', 'spd', 'spe'];

export const STAT_LABELS: Record<StatKey, string> = {
  hp: 'HP',
  atk: '공격',
  def: '방어',
  spa: '특공',
  spd: '특방',
  spe: '스피드',
};

export const CATEGORY_LABELS: Record<SurvivalCategory, string> = {
  survives: '확정 생존',
  roll: '난수',
  ko: '확정 KO',
};

export const SPEED_CATEGORY_LABELS: Record<SpeedCategory, string> = {
  outspeeds: '추월',
  tie: '동속',
  slower: '추월당함',
};

export const EMPTY_SPREAD: StatPointSpread = {
  hp: 0,
  atk: 0,
  def: 0,
  spa: 0,
  spd: 0,
  spe: 0,
};



