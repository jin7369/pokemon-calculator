import type { MoveOption } from './types';

export interface OffenseItemOption {
  id: string;
  label: string;
  multiplier: number;
  moveCategory?: MoveOption['category'];
  moveType?: string;
}

export const NO_OFFENSE_ITEM_ID = 'none';
export const LOADED_DICE_ITEM_ID = 'loaded-dice';

export const OFFENSE_ITEM_OPTIONS: OffenseItemOption[] = [
  { id: NO_OFFENSE_ITEM_ID, label: '없음', multiplier: 1 },
  { id: LOADED_DICE_ITEM_ID, label: '속임수주사위', multiplier: 1 },
  { id: 'life-orb', label: '생명의구슬', multiplier: 1.3 },
  { id: 'choice-band', label: '구애머리띠', multiplier: 1.5, moveCategory: 'Physical' },
  { id: 'choice-specs', label: '구애안경', multiplier: 1.5, moveCategory: 'Special' },
  { id: 'muscle-band', label: '힘의머리띠', multiplier: 1.1, moveCategory: 'Physical' },
  { id: 'wise-glasses', label: '박식안경', multiplier: 1.1, moveCategory: 'Special' },
  { id: 'silk-scarf', label: '실크스카프', multiplier: 1.2, moveType: 'Normal' },
  { id: 'black-belt', label: '검은띠', multiplier: 1.2, moveType: 'Fighting' },
  { id: 'sharp-beak', label: '예리한부리', multiplier: 1.2, moveType: 'Flying' },
  { id: 'poison-barb', label: '독바늘', multiplier: 1.2, moveType: 'Poison' },
  { id: 'soft-sand', label: '부드러운모래', multiplier: 1.2, moveType: 'Ground' },
  { id: 'hard-stone', label: '딱딱한돌', multiplier: 1.2, moveType: 'Rock' },
  { id: 'silver-powder', label: '은빛가루', multiplier: 1.2, moveType: 'Bug' },
  { id: 'spell-tag', label: '저주의부적', multiplier: 1.2, moveType: 'Ghost' },
  { id: 'metal-coat', label: '금속코트', multiplier: 1.2, moveType: 'Steel' },
  { id: 'charcoal', label: '목탄', multiplier: 1.2, moveType: 'Fire' },
  { id: 'mystic-water', label: '신비의물방울', multiplier: 1.2, moveType: 'Water' },
  { id: 'miracle-seed', label: '기적의씨', multiplier: 1.2, moveType: 'Grass' },
  { id: 'magnet', label: '자석', multiplier: 1.2, moveType: 'Electric' },
  { id: 'twisted-spoon', label: '휘어진스푼', multiplier: 1.2, moveType: 'Psychic' },
  { id: 'never-melt-ice', label: '녹지않는얼음', multiplier: 1.2, moveType: 'Ice' },
  { id: 'dragon-fang', label: '용의이빨', multiplier: 1.2, moveType: 'Dragon' },
  { id: 'black-glasses', label: '검은안경', multiplier: 1.2, moveType: 'Dark' },
  { id: 'fairy-feather', label: '요정의깃털', multiplier: 1.2, moveType: 'Fairy' },
];

const offenseItemById = new Map(OFFENSE_ITEM_OPTIONS.map((item) => [item.id, item]));

export function getOffenseItemOption(id: string | undefined): OffenseItemOption {
  return offenseItemById.get(id ?? NO_OFFENSE_ITEM_ID) ?? OFFENSE_ITEM_OPTIONS[0];
}

export function offenseItemMultiplierForMove(itemId: string | undefined, move: MoveOption | null): number {
  const item = getOffenseItemOption(itemId);
  if (!move || item.id === NO_OFFENSE_ITEM_ID) return 1;
  if (item.moveCategory && item.moveCategory !== move.category) return 1;
  if (item.moveType && item.moveType !== move.type) return 1;

  return item.multiplier;
}

export function combinedAttackMultiplier(itemId: string | undefined, move: MoveOption | null, directMultiplier: number): number {
  return offenseItemMultiplierForMove(itemId, move) * directMultiplier;
}

export function formatMultiplier(multiplier: number): string {
  return `${Number(multiplier.toFixed(2))}x`;
}
