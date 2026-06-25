import type { AttackConfig, MoveOption } from './types';
import { LOADED_DICE_ITEM_ID } from './offenseItems';

export type HitCountSource = 'manual' | 'skill-link' | 'loaded-dice' | 'default' | 'fixed';

export interface ResolvedHitCount {
  hits: number;
  source: HitCountSource;
}

export function resolveAttackHitCount(
  attack: Pick<AttackConfig, 'ability' | 'abilityEnabled' | 'hitCount' | 'item'>,
  move: MoveOption | null,
): ResolvedHitCount | null {
  if (!move?.multiHit) return null;

  if (typeof attack.hitCount === 'number' && move.multiHit.selectableHits.includes(attack.hitCount)) {
    return { hits: attack.hitCount, source: 'manual' };
  }

  if (attack.abilityEnabled && attack.ability === 'Skill Link' && move.multiHit.supportsSkillLink) {
    return { hits: move.multiHit.max, source: 'skill-link' };
  }

  if (attack.item === LOADED_DICE_ITEM_ID && move.multiHit.supportsLoadedDice) {
    return { hits: Math.max(4, move.multiHit.min), source: 'loaded-dice' };
  }

  return {
    hits: move.multiHit.defaultHits,
    source: move.multiHit.min === move.multiHit.max ? 'fixed' : 'default',
  };
}

export function formatMoveHitRange(move: MoveOption): string | null {
  if (!move.multiHit) return null;
  if (move.multiHit.min === move.multiHit.max) return `${move.multiHit.max}히트`;
  return `${move.multiHit.min}-${move.multiHit.max}히트`;
}

export function describeHitCountSource(source: HitCountSource): string {
  switch (source) {
    case 'manual':
      return '수동 지정';
    case 'skill-link':
      return '스킬링크 적용';
    case 'loaded-dice':
      return '속임수주사위 최소 보정';
    case 'fixed':
      return '고정 히트';
    case 'default':
    default:
      return '기본 히트';
  }
}
