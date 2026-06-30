import { describe, expect, it } from 'vitest';
import {
  calculateBattleStat,
  calculatePerStatMaximumStats,
  natureMultiplierForStat,
} from './battleStats';
import { getSpeciesOption } from './pokemonData';

describe('battle stat helpers', () => {
  const charizard = getSpeciesOption('Charizard');
  const armarouge = getSpeciesOption('Armarouge');

  it('calculates Champions stats from nature and Stat Points', () => {
    expect(charizard).not.toBeNull();
    if (!charizard) return;

    expect(calculateBattleStat(charizard, 'hp', 'Serious', { hp: 0 })).toBe(153);
    expect(calculateBattleStat(charizard, 'spe', 'Timid', { spe: 32 })).toBe(167);
  });

  it('matches observed Champions stat point examples', () => {
    expect(armarouge).not.toBeNull();
    if (!armarouge) return;

    expect(calculateBattleStat(armarouge, 'hp', 'Modest', { hp: 0 })).toBe(160);
    expect(calculateBattleStat(armarouge, 'atk', 'Modest', { atk: 2 })).toBe(73);
    expect(calculateBattleStat(armarouge, 'def', 'Modest', { def: 32 })).toBe(152);
    expect(calculateBattleStat(armarouge, 'spa', 'Modest', { spa: 0 })).toBe(159);
    expect(calculateBattleStat(armarouge, 'spd', 'Modest', { spd: 32 })).toBe(132);
    expect(calculateBattleStat(armarouge, 'spe', 'Modest', { spe: 0 })).toBe(95);
  });

  it('applies nature modifiers to per-stat maximums', () => {
    expect(charizard).not.toBeNull();
    if (!charizard) return;

    const maximums = calculatePerStatMaximumStats(charizard, 'Modest');

    expect(natureMultiplierForStat('Modest', 'spa')).toBe(1.1);
    expect(natureMultiplierForStat('Modest', 'atk')).toBe(0.9);
    expect(maximums.atk).toBe(122);
    expect(maximums.spa).toBe(177);
  });
});
