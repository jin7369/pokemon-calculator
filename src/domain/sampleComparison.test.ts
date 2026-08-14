import { describe, expect, it } from 'vitest';
import { createDefaultBattleSample, type BattleSample } from './battleSamples';
import { calculateSampleDamage, calculateSampleMatchup } from './sampleComparison';

function sample(overrides: Partial<BattleSample>): BattleSample {
  return { ...createDefaultBattleSample(overrides.id ?? 'sample'), ...overrides };
}

describe('sample comparison', () => {
  it('compares every saved attacking move in both directions', () => {
    const self = sample({ id: 'self', moves: ['Flamethrower', 'Air Slash'] });
    const target = sample({
      id: 'target',
      species: 'Venusaur',
      name: '이상해꽃',
      ability: 'Overgrow',
      moves: ['Sludge Bomb'],
    });
    const result = calculateSampleMatchup(self, target);

    expect(result.outgoing.map((entry) => entry.damage.move.name)).toEqual(expect.arrayContaining(['Flamethrower', 'Air Slash']));
    expect(result.incoming.map((entry) => entry.damage.move.name)).toEqual(['Sludge Bomb']);
    expect(result.strongestOutgoing?.damage.maxDamage).toBeGreaterThan(0);
    expect(result.mostDangerousIncoming?.damage.maxDamage).toBeGreaterThan(0);
  });

  it('applies attacker and defender ability toggles independently', () => {
    const megaStarmie = sample({
      id: 'starmie',
      species: 'Starmie-Mega',
      nature: 'Serious',
      ability: 'Huge Power',
      abilityEnabled: false,
      item: 'mega-stone',
      moves: ['Liquidation'],
    });
    const charizard = sample({ id: 'charizard', moves: [] });

    const disabled = calculateSampleDamage(megaStarmie, charizard, 'Liquidation');
    const enabled = calculateSampleDamage({ ...megaStarmie, abilityEnabled: true }, charizard, 'Liquidation');

    expect(disabled?.maxDamage).toBe(140);
    expect(enabled?.maxDamage).toBe(278);

    const dragonite = sample({
      id: 'dragonite',
      species: 'Dragonite',
      nature: 'Serious',
      ability: 'Multiscale',
      abilityEnabled: false,
      moves: [],
    });
    const noDefenseAbility = calculateSampleDamage(charizard, dragonite, 'Flamethrower');
    const withDefenseAbility = calculateSampleDamage(charizard, { ...dragonite, abilityEnabled: true }, 'Flamethrower');

    expect(withDefenseAbility?.maxDamage).toBeLessThan(noDefenseAbility?.maxDamage ?? 0);
  });

  it('applies Champions-only Fire Mane and Eelevate effects', () => {
    const megaPyroar = sample({
      id: 'pyroar',
      species: 'Pyroar-Mega',
      ability: 'Fire Mane',
      abilityEnabled: false,
      item: 'mega-stone',
      moves: ['Flamethrower'],
    });
    const target = sample({ id: 'target', moves: [] });
    const disabled = calculateSampleDamage(megaPyroar, target, 'Flamethrower');
    const enabled = calculateSampleDamage({ ...megaPyroar, abilityEnabled: true }, target, 'Flamethrower');
    expect(enabled?.maxDamage).toBeGreaterThan(disabled?.maxDamage ?? 0);

    const megaEelektross = sample({
      id: 'eelektross',
      species: 'Eelektross-Mega',
      ability: 'Eelevate',
      abilityEnabled: true,
      item: 'mega-stone',
      moves: [],
    });
    const earthquake = calculateSampleDamage(target, megaEelektross, 'Earthquake');
    expect(earthquake?.maxDamage).toBe(0);
  });

  it('finds the minimum Speed points needed to move first', () => {
    const charizard = sample({ id: 'charizard', nature: 'Serious', moves: [] });
    const garchomp = sample({
      id: 'garchomp',
      species: 'Garchomp',
      nature: 'Serious',
      ability: 'Rough Skin',
      moves: [],
    });
    const result = calculateSampleMatchup(charizard, garchomp);

    expect(result.speed.selfFinalSpeed).toBe(120);
    expect(result.speed.targetFinalSpeed).toBe(122);
    expect(result.speed.recommendation.currentAddRequired).toBe(3);
    expect(result.speed.recommendation.redistributedRequired).toBe(3);
  });

  it('reports an impossible Speed threshold at the 32-point cap', () => {
    const slow = sample({ id: 'slow', species: 'Abomasnow', nature: 'Serious', ability: 'Snow Warning', moves: [] });
    const fast = sample({ id: 'fast', species: 'Dragapult', nature: 'Timid', ability: 'Infiltrator', moves: [] });
    const result = calculateSampleMatchup(slow, fast);

    expect(result.speed.recommendation.currentAddRequired).toBeNull();
    expect(result.speed.recommendation.redistributedRequired).toBeNull();
  });

  it('returns bounded defense redistribution options or a maximum-investment result', () => {
    const defender = sample({ id: 'defender', moves: [] });
    const attacker = sample({ id: 'attacker', moves: ['Flamethrower'] });
    const result = calculateSampleMatchup(defender, attacker);
    const recommendation = result.incoming[0].recommendation;

    expect(recommendation.redistributedOptions.length).toBeLessThanOrEqual(3);
    expect(recommendation.maximumInvestment.hp).toBeGreaterThan(0);
  });
});
