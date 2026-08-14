import type { MoveOption } from './types';

interface MoveAbilityEffect {
  overrides?: {
    basePower?: number;
    type?: string;
  };
  multiplier: number;
}

export function championsMoveAbilityEffect(
  ability: string,
  abilityEnabled: boolean,
  move: MoveOption,
): MoveAbilityEffect {
  if (!abilityEnabled) return { multiplier: 1 };

  if (ability === 'Dragonize' && move.type === 'Normal') {
    return {
      overrides: {
        basePower: Math.floor(move.basePower * 1.2),
        type: 'Dragon',
      },
      multiplier: 1,
    };
  }
  if (ability === 'Fire Mane' && move.type === 'Fire') return { multiplier: 1.5 };
  if (ability === 'Mega Sol') {
    if (move.type === 'Fire') return { multiplier: 1.5 };
    if (move.type === 'Water') return { multiplier: 0.5 };
  }

  return { multiplier: 1 };
}

export function championsAbilityGrantsImmunity(
  ability: string,
  abilityEnabled: boolean,
  move: MoveOption,
): boolean {
  return abilityEnabled && ability === 'Eelevate' && move.type === 'Ground';
}
