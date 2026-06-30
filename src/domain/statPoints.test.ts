import { describe, expect, it } from 'vitest';
import { EMPTY_SPREAD } from './types';
import {
  STAT_POINT_PER_STAT_LIMIT,
  STAT_POINT_TOTAL_LIMIT,
  normalizeStatPoints,
  statPointsToEvs,
  totalStatPoints,
  updateStatPoint,
} from './statPoints';

describe('stat point helpers', () => {
  it('converts one Champions stat point to eight EVs', () => {
    const evs = statPointsToEvs({ atk: 31, spa: 12 });

    expect(evs.atk).toBe(248);
    expect(evs.spa).toBe(96);
  });

  it('maps 32 Champions stat points to the level 50 EV cap', () => {
    const evs = statPointsToEvs({ def: 32 });

    expect(evs.def).toBe(252);
  });

  it('caps each stat at 32 points', () => {
    const spread = normalizeStatPoints({ atk: 80 });

    expect(spread.atk).toBe(STAT_POINT_PER_STAT_LIMIT);
  });

  it('keeps the full spread under 66 total points', () => {
    const spread = normalizeStatPoints({ hp: 32, atk: 32, def: 32, spa: 32, spd: 32, spe: 32 });

    expect(totalStatPoints(spread)).toBeLessThanOrEqual(STAT_POINT_TOTAL_LIMIT);
  });

  it('caps a changed stat by the remaining total budget', () => {
    const current = { ...EMPTY_SPREAD, hp: 32, def: 32, spd: 2 };
    const next = updateStatPoint(current, 'spd', 32);

    expect(next.spd).toBe(2);
    expect(totalStatPoints(next)).toBe(STAT_POINT_TOTAL_LIMIT);
  });
});
