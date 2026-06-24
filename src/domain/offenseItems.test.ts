import { describe, expect, it } from 'vitest';
import { combinedAttackMultiplier, offenseItemMultiplierForMove } from './offenseItems';
import type { MoveOption } from './types';

const flamethrower: MoveOption = {
  id: 'flamethrower',
  name: 'Flamethrower',
  displayName: '화염방사',
  type: 'Fire',
  category: 'Special',
  basePower: 90,
};

const flareBlitz: MoveOption = {
  id: 'flareblitz',
  name: 'Flare Blitz',
  displayName: '플레어드라이브',
  type: 'Fire',
  category: 'Physical',
  basePower: 120,
};

describe('offense item multipliers', () => {
  it('applies type boosting items only to matching move types', () => {
    expect(offenseItemMultiplierForMove('charcoal', flamethrower)).toBe(1.2);
    expect(offenseItemMultiplierForMove('magnet', flamethrower)).toBe(1);
  });

  it('applies category boosting items only to matching move categories', () => {
    expect(offenseItemMultiplierForMove('choice-specs', flamethrower)).toBe(1.5);
    expect(offenseItemMultiplierForMove('choice-band', flamethrower)).toBe(1);
    expect(offenseItemMultiplierForMove('choice-band', flareBlitz)).toBe(1.5);
  });

  it('combines item and direct multipliers', () => {
    expect(combinedAttackMultiplier('life-orb', flamethrower, 2)).toBe(2.6);
  });
});
