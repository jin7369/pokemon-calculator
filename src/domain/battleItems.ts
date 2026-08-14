import type { MoveOption } from './types';
import {
  NO_OFFENSE_ITEM_ID,
  OFFENSE_ITEM_OPTIONS,
  offenseItemMultiplierForMove,
} from './offenseItems';
import {
  SPEED_ITEM_OPTIONS,
  speedItemMultiplier,
} from './speedItems';

export interface BattleItemOption {
  id: string;
  label: string;
  held: boolean;
  offenseMultiplier: number;
  speedMultiplier: number;
}

export const NO_BATTLE_ITEM_ID = NO_OFFENSE_ITEM_ID;
export const MEGA_STONE_ITEM_ID = 'mega-stone';

const itemIds = [
  ...new Set([
    ...OFFENSE_ITEM_OPTIONS.map((item) => item.id),
    ...SPEED_ITEM_OPTIONS.map((item) => item.id),
  ]),
];

export const BATTLE_ITEM_OPTIONS: BattleItemOption[] = [
  ...itemIds.map((id) => {
    const offense = OFFENSE_ITEM_OPTIONS.find((item) => item.id === id);
    const speed = SPEED_ITEM_OPTIONS.find((item) => item.id === id);
    return {
      id,
      label: offense?.label ?? speed?.label ?? id,
      held: id !== NO_BATTLE_ITEM_ID,
      offenseMultiplier: offense?.multiplier ?? 1,
      speedMultiplier: speed?.multiplier ?? 1,
    };
  }),
  {
    id: MEGA_STONE_ITEM_ID,
    label: '메가스톤',
    held: true,
    offenseMultiplier: 1,
    speedMultiplier: 1,
  },
];

const battleItemById = new Map(BATTLE_ITEM_OPTIONS.map((item) => [item.id, item]));

export function getBattleItemOption(id: string | undefined): BattleItemOption {
  return battleItemById.get(id ?? NO_BATTLE_ITEM_ID) ?? BATTLE_ITEM_OPTIONS[0];
}

export function isBattleItemId(id: unknown): id is string {
  return typeof id === 'string' && battleItemById.has(id);
}

export function battleItemOffenseMultiplier(itemId: string | undefined, move: MoveOption | null): number {
  return offenseItemMultiplierForMove(itemId, move);
}

export function battleItemSpeedMultiplier(itemId: string | undefined): number {
  return speedItemMultiplier(itemId);
}

export function itemForSpecies(speciesName: string, requestedItem: string | undefined): string {
  if (speciesName.includes('-Mega')) return MEGA_STONE_ITEM_ID;
  return isBattleItemId(requestedItem) && requestedItem !== MEGA_STONE_ITEM_ID
    ? requestedItem
    : NO_BATTLE_ITEM_ID;
}
