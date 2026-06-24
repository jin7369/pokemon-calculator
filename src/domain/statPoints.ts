import type { StatsTable } from '@smogon/calc';
import type { StatKey, StatPointSpread } from './types';
import { EMPTY_SPREAD, STAT_KEYS } from './types';

export const STAT_POINT_TOTAL_LIMIT = 66;
export const STAT_POINT_PER_STAT_LIMIT = 31;
export const STAT_POINT_EV_RATIO = 8;

export function clampStatPoint(value: number): number {
  if (Number.isNaN(value)) return 0;
  return Math.min(STAT_POINT_PER_STAT_LIMIT, Math.max(0, Math.trunc(value)));
}

export function totalStatPoints(spread: Partial<StatPointSpread>): number {
  return STAT_KEYS.reduce((total, stat) => total + (spread[stat] ?? 0), 0);
}

export function normalizeStatPoints(input: Partial<StatPointSpread>): StatPointSpread {
  const normalized: StatPointSpread = { ...EMPTY_SPREAD };

  for (const stat of STAT_KEYS) {
    normalized[stat] = clampStatPoint(input[stat] ?? 0);
  }

  let overflow = totalStatPoints(normalized) - STAT_POINT_TOTAL_LIMIT;
  for (const stat of [...STAT_KEYS].reverse()) {
    if (overflow <= 0) break;
    const reduction = Math.min(normalized[stat], overflow);
    normalized[stat] -= reduction;
    overflow -= reduction;
  }

  return normalized;
}

export function updateStatPoint(
  spread: StatPointSpread,
  stat: StatKey,
  rawValue: number,
): StatPointSpread {
  const next = { ...spread, [stat]: clampStatPoint(rawValue) };
  const totalWithoutChanged = totalStatPoints(next) - next[stat];
  const remaining = Math.max(0, STAT_POINT_TOTAL_LIMIT - totalWithoutChanged);
  next[stat] = Math.min(next[stat], remaining, STAT_POINT_PER_STAT_LIMIT);
  return next;
}

export function statPointsToEvs(spread: Partial<StatPointSpread>): StatsTable {
  const normalized = normalizeStatPoints(spread);

  return {
    hp: normalized.hp * STAT_POINT_EV_RATIO,
    atk: normalized.atk * STAT_POINT_EV_RATIO,
    def: normalized.def * STAT_POINT_EV_RATIO,
    spa: normalized.spa * STAT_POINT_EV_RATIO,
    spd: normalized.spd * STAT_POINT_EV_RATIO,
    spe: normalized.spe * STAT_POINT_EV_RATIO,
  };
}
