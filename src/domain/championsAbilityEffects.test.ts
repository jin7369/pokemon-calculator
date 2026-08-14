import { describe, expect, it } from 'vitest';
import { getMoveOption } from './pokemonData';
import { championsAbilityGrantsImmunity, championsMoveAbilityEffect } from './championsAbilityEffects';

describe('Pokemon Champions ability effects', () => {
  it('applies Fire Mane and Mega Sol type multipliers only when enabled', () => {
    const flamethrower = getMoveOption('Flamethrower');
    const surf = getMoveOption('Surf');
    expect(flamethrower).not.toBeNull();
    expect(surf).not.toBeNull();

    expect(championsMoveAbilityEffect('Fire Mane', true, flamethrower!).multiplier).toBe(1.5);
    expect(championsMoveAbilityEffect('Fire Mane', false, flamethrower!).multiplier).toBe(1);
    expect(championsMoveAbilityEffect('Mega Sol', true, surf!).multiplier).toBe(0.5);
  });

  it('changes Dragonize Normal attacks into boosted Dragon attacks', () => {
    const bodySlam = getMoveOption('Body Slam');
    expect(bodySlam).not.toBeNull();

    const effect = championsMoveAbilityEffect('Dragonize', true, bodySlam!);
    expect(effect.overrides).toEqual({ basePower: 102, type: 'Dragon' });
  });

  it('gives Eelevate a Ground immunity only while enabled', () => {
    const earthquake = getMoveOption('Earthquake');
    expect(earthquake).not.toBeNull();

    expect(championsAbilityGrantsImmunity('Eelevate', true, earthquake!)).toBe(true);
    expect(championsAbilityGrantsImmunity('Eelevate', false, earthquake!)).toBe(false);
  });
});
