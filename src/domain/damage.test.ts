import { describe, expect, it } from 'vitest';
import { calculateAttackResults, applyDirectMultiplier, classifyDamage } from './damage';
import { getSpeciesOption } from './pokemonData';
import type { AttackConfig, DefenderBulkConfig } from './types';

const neutralBulk: DefenderBulkConfig = {
  nature: 'Serious',
  statPoints: { hp: 0, def: 0, spd: 0 },
};

describe('damage helpers', () => {
  it('classifies survival buckets from a damage range', () => {
    expect(classifyDamage(80, 90, 100)).toBe('survives');
    expect(classifyDamage(100, 120, 100)).toBe('ko');
    expect(classifyDamage(90, 110, 100)).toBe('roll');
  });

  it('applies a direct multiplier after the calculated range', () => {
    expect(applyDirectMultiplier([50, 60], 2)).toEqual([100, 120]);
    expect(applyDirectMultiplier([0, 0], 4)).toEqual([0, 0]);
  });

  it('calculates a guaranteed KO for a strong super-effective attack', () => {
    const pikachu = getSpeciesOption('Pikachu');
    const attack: AttackConfig = {
      attacker: 'Charizard',
      move: 'Flamethrower',
      item: 'none',
      ability: 'Blaze',
      abilityEnabled: false,
      nature: 'Modest',
      attackStatPoints: { atk: 0, spa: 31 },
      boostStage: 0,
      directMultiplier: 1,
    };

    const { results } = calculateAttackResults(attack, neutralBulk, pikachu ? [pikachu] : []);

    expect(results).toHaveLength(1);
    expect(results[0].category).toBe('ko');
    expect(results[0].minPercent).toBeGreaterThan(100);
  });

  it('keeps immune targets in the survival bucket', () => {
    const stunfisk = getSpeciesOption('Stunfisk');
    const attack: AttackConfig = {
      attacker: 'Pikachu',
      move: 'Thunderbolt',
      item: 'none',
      ability: 'Static',
      abilityEnabled: false,
      nature: 'Modest',
      attackStatPoints: { atk: 0, spa: 31 },
      boostStage: 0,
      directMultiplier: 1,
    };

    const { results } = calculateAttackResults(attack, neutralBulk, stunfisk ? [stunfisk] : []);

    expect(results).toHaveLength(1);
    expect(results[0].maxDamage).toBe(0);
    expect(results[0].category).toBe('survives');
  });

  it('does not apply default abilities implicitly', () => {
    const ceruledge = getSpeciesOption('Ceruledge');
    const attack: AttackConfig = {
      attacker: 'Charizard',
      move: 'Flamethrower',
      item: 'none',
      ability: 'Blaze',
      abilityEnabled: false,
      nature: 'Modest',
      attackStatPoints: { atk: 0, spa: 31 },
      boostStage: 0,
      directMultiplier: 1,
    };

    const { results } = calculateAttackResults(attack, neutralBulk, ceruledge ? [ceruledge] : []);

    expect(results).toHaveLength(1);
    expect(results[0].maxDamage).toBeGreaterThan(0);
  });

  it('applies the selected attacker ability only when enabled', () => {
    const charizard = getSpeciesOption('Charizard');
    const attack: AttackConfig = {
      attacker: 'Azumarill',
      move: 'Liquidation',
      item: 'none',
      ability: 'Huge Power',
      abilityEnabled: false,
      nature: 'Adamant',
      attackStatPoints: { atk: 31, spa: 0 },
      boostStage: 0,
      directMultiplier: 1,
    };

    const disabled = calculateAttackResults(attack, neutralBulk, charizard ? [charizard] : []).results[0];
    const enabled = calculateAttackResults(
      { ...attack, abilityEnabled: true },
      neutralBulk,
      charizard ? [charizard] : [],
    ).results[0];

    expect(disabled.maxDamage).toBeGreaterThan(0);
    expect(enabled.maxDamage).toBeGreaterThan(disabled.maxDamage);
  });
});
