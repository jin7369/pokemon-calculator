import { describe, expect, it } from 'vitest';
import { calculateSpeedResults, classifySpeed, modifiedSpeed, sortSpeedResults } from './speed';
import { NO_SPEED_ITEM_ID } from './speedItems';
import { getSpeciesOption } from './pokemonData';
import type { SpeedConfig, SpeedResult } from './types';

const baseSpeedConfig: SpeedConfig = {
  pokemon: 'Charizard',
  nature: 'Timid',
  statPoints: { spe: 31 },
  boostStage: 0,
  item: NO_SPEED_ITEM_ID,
  directMultiplier: 1,
  targetNature: 'Jolly',
  targetStatPoints: { spe: 31 },
  targetBoostStage: 0,
  targetItem: NO_SPEED_ITEM_ID,
  targetDirectMultiplier: 1,
};

describe('speed helpers', () => {
  it('classifies speed comparisons', () => {
    expect(classifySpeed(101, 100)).toBe('outspeeds');
    expect(classifySpeed(100, 100)).toBe('tie');
    expect(classifySpeed(99, 100)).toBe('slower');
  });

  it('applies boost and item multipliers with integer speed flooring', () => {
    expect(modifiedSpeed(100, 1, 1.5, 1)).toBe(225);
    expect(modifiedSpeed(100, -1, 1, 1)).toBe(66);
  });

  it('calculates whether the selected pokemon outspeeds targets', () => {
    const garchomp = getSpeciesOption('Garchomp');
    const { results, summary } = calculateSpeedResults(
      { ...baseSpeedConfig, item: 'choice-scarf' },
      garchomp ? [garchomp] : [],
    );

    expect(results).toHaveLength(1);
    expect(results[0].name).toBe('Garchomp');
    expect(results[0].selfFinalSpeed).toBeGreaterThan(results[0].targetFinalSpeed);
    expect(results[0].category).toBe('outspeeds');
    expect(summary.outspeeds).toBe(1);
  });

  it('detects equal speed when both sides share the same setup', () => {
    const charizard = getSpeciesOption('Charizard');
    const { results } = calculateSpeedResults(baseSpeedConfig, charizard ? [charizard] : []);

    expect(results).toHaveLength(1);
    expect(results[0].category).toBe('tie');
    expect(results[0].margin).toBe(0);
  });

  it('sorts lowest outspeed margins before ties and slower targets', () => {
    const result = (name: string, margin: number): SpeedResult => ({
      id: name.toLowerCase(),
      name,
      displayName: name,
      types: [],
      selfBaseSpeed: 100,
      selfFinalSpeed: 100,
      targetBaseSpeed: 100 - margin,
      targetFinalSpeed: 100 - margin,
      margin,
      category: classifySpeed(100, 100 - margin),
    });

    expect(sortSpeedResults([
      result('SlowByThree', 3),
      result('Tie', 0),
      result('FasterByOne', -1),
      result('SlowByOne', 1),
    ], 'marginAsc').map((item) => item.name)).toEqual([
      'SlowByOne',
      'SlowByThree',
      'Tie',
      'FasterByOne',
    ]);
  });
});
