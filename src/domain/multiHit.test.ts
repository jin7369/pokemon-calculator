import { describe, expect, it } from 'vitest';
import { getMoveOption } from './pokemonData';
import { resolveAttackHitCount } from './multiHit';
import type { AttackConfig } from './types';

const baseAttack: AttackConfig = {
  attacker: 'Cloyster',
  move: 'Icicle Spear',
  item: 'none',
  ability: 'Skill Link',
  abilityEnabled: false,
  hitCount: 'auto',
  nature: 'Adamant',
  attackStatPoints: { atk: 31, spa: 0 },
  boostStage: 0,
  directMultiplier: 1,
};

describe('multi-hit resolution', () => {
  it('uses the calc default hit count for variable multi-hit moves', () => {
    expect(resolveAttackHitCount(baseAttack, getMoveOption('Icicle Spear'))).toEqual({
      hits: 3,
      source: 'default',
    });
  });

  it('uses Skill Link on automatic 2-5 hit moves only when enabled', () => {
    expect(resolveAttackHitCount(
      { ...baseAttack, abilityEnabled: true },
      getMoveOption('Icicle Spear'),
    )).toEqual({
      hits: 5,
      source: 'skill-link',
    });
  });

  it('uses Loaded Dice as an automatic minimum 4-hit modifier', () => {
    expect(resolveAttackHitCount(
      { ...baseAttack, item: 'loaded-dice' },
      getMoveOption('Icicle Spear'),
    )).toEqual({
      hits: 4,
      source: 'loaded-dice',
    });
  });

  it('lets manual hit count override automatic modifiers', () => {
    expect(resolveAttackHitCount(
      { ...baseAttack, item: 'loaded-dice', hitCount: 5 },
      getMoveOption('Icicle Spear'),
    )).toEqual({
      hits: 5,
      source: 'manual',
    });
  });

  it('allows multiaccuracy moves to be set below their maximum hit count', () => {
    expect(getMoveOption('Population Bomb')?.multiHit?.selectableHits).toContain(1);
    expect(getMoveOption('Population Bomb')?.multiHit?.selectableHits).toContain(10);
  });
});
