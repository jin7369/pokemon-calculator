import { describe, expect, it } from 'vitest';
import {
  calculateBattleStat,
  calculatePerStatMaximumStats,
  natureMultiplierForStat,
} from './battleStats';
import { getSpeciesOption } from './pokemonData';

describe('battle stat helpers', () => {
  const charizard = getSpeciesOption('Charizard');

  it('calculates level 50 stats from nature and Stat Points', () => {
    expect(charizard).not.toBeNull();
    if (!charizard) return;

    expect(calculateBattleStat(charizard, 'hp', 'Serious', { hp: 0 })).toBe(153);
    expect(calculateBattleStat(charizard, 'spe', 'Timid', { spe: 31 })).toBe(166);
  });

  it('applies nature modifiers to per-stat maximums', () => {
    expect(charizard).not.toBeNull();
    if (!charizard) return;

    const maximums = calculatePerStatMaximumStats(charizard, 'Modest');

    expect(natureMultiplierForStat('Modest', 'spa')).toBe(1.1);
    expect(natureMultiplierForStat('Modest', 'atk')).toBe(0.9);
    expect(maximums.atk).toBe(121);
    expect(maximums.spa).toBe(176);
  });
});
